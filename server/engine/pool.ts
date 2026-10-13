import { Worker } from 'node:worker_threads';
import { log } from '../log.js';
import { type EngineJob, type JobResult, runJob } from './jobs.js';

/**
 * Somewhere to run engine jobs without blocking the event loop.
 *
 * A search can take seconds; run on the main thread it would freeze every
 * clock, every socket and every other game on the server for that long. So the
 * lobby only ever asks for a result and is told later.
 */
export interface EngineRunner {
  run<J extends EngineJob>(job: J): Promise<JobResult<J>>;
  /** Jobs waiting or running. */
  readonly load: number;
  close(): Promise<void>;
}

export class EngineBusyError extends Error {
  constructor() {
    super('Engine queue is full');
    this.name = 'EngineBusyError';
  }
}

/**
 * Runs jobs on the calling thread, asynchronously.
 *
 * For tests and tools only: it keeps the same promise-shaped contract as the
 * worker pool, so code under test cannot quietly depend on a result arriving
 * synchronously, but it does block while a job runs.
 */
export class InlineEngine implements EngineRunner {
  private running = 0;

  get load(): number {
    return this.running;
  }

  async run<J extends EngineJob>(job: J): Promise<JobResult<J>> {
    this.running++;
    try {
      await Promise.resolve();
      return runJob(job);
    } finally {
      this.running--;
    }
  }

  async close(): Promise<void> {}
}

export interface WorkerPoolOptions {
  /** Worker threads. Keep below the core count so the event loop keeps one. */
  readonly size?: number;
  /** Jobs that may wait for a free worker before new ones are refused. */
  readonly maxQueue?: number;
  /**
   * Longest a job may run before its worker is killed and replaced. Searches
   * are budgeted far below this; it exists for the job that never returns.
   */
  readonly timeoutMs?: number;
}

interface Pending {
  readonly id: number;
  readonly job: EngineJob;
  readonly resolve: (value: never) => void;
  readonly reject: (error: Error) => void;
}

interface Slot {
  worker: Worker;
  current: Pending | null;
  timer: ReturnType<typeof setTimeout> | null;
}

const WORKER_URL = new URL('./worker.ts', import.meta.url);

/**
 * A bounded pool of worker threads running the shared engine.
 *
 * Bounded three ways - threads, queue length and time per job - because each
 * is something a busy hour or a hostile client could otherwise grow: a bot in
 * every room, a flood of finished games to analyse, a pathological position.
 * When the queue is full a job is refused straight away and the caller falls
 * back (a bot plays a quick move; an analysis is skipped), which is better
 * than every job getting slower.
 */
export class WorkerPool implements EngineRunner {
  private readonly size: number;
  private readonly maxQueue: number;
  private readonly timeoutMs: number;
  private readonly slots: Slot[] = [];
  private readonly queue: Pending[] = [];
  private nextId = 0;
  private closed = false;

  constructor(options: WorkerPoolOptions = {}) {
    this.size = Math.max(1, options.size ?? 2);
    this.maxQueue = Math.max(0, options.maxQueue ?? 128);
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  get load(): number {
    return this.queue.length + this.slots.filter((slot) => slot.current).length;
  }

  run<J extends EngineJob>(job: J): Promise<JobResult<J>> {
    if (this.closed) return Promise.reject(new Error('Engine pool is closed'));
    if (this.queue.length >= this.maxQueue && !this.idleSlot()) {
      return Promise.reject(new EngineBusyError());
    }
    return new Promise<JobResult<J>>((resolve, reject) => {
      this.queue.push({
        id: ++this.nextId,
        job,
        resolve,
        reject,
      });
      this.pump();
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const pending of this.queue.splice(0)) pending.reject(new Error('Engine pool closed'));
    await Promise.all(
      this.slots.splice(0).map(async (slot) => {
        if (slot.timer) clearTimeout(slot.timer);
        slot.current?.reject(new Error('Engine pool closed'));
        await slot.worker.terminate();
      }),
    );
  }

  private idleSlot(): Slot | null {
    const idle = this.slots.find((slot) => slot.current === null);
    if (idle) return idle;
    if (this.slots.length < this.size) return this.spawn();
    return null;
  }

  private pump(): void {
    while (this.queue.length > 0) {
      const slot = this.idleSlot();
      if (!slot) return;
      const pending = this.queue.shift()!;
      slot.current = pending;
      slot.timer = setTimeout(() => this.timedOut(slot), this.timeoutMs);
      slot.worker.postMessage({ id: pending.id, job: pending.job });
    }
  }

  private spawn(): Slot {
    // Under tsx the parent's own loader flags are inherited; anywhere else (a
    // test runner) the worker needs telling how to read TypeScript.
    const execArgv = process.execArgv.some((flag) => flag.includes('tsx'))
      ? process.execArgv
      : [...process.execArgv, '--import', 'tsx'];
    const worker = new Worker(WORKER_URL, { execArgv });
    // A worker thread must never be what keeps the process alive at shutdown.
    worker.unref();
    const slot: Slot = { worker, current: null, timer: null };

    worker.on('message', (message: { id: number; ok: boolean; result?: never; error?: string }) => {
      const pending = slot.current;
      if (!pending || pending.id !== message.id) return;
      if (slot.timer) clearTimeout(slot.timer);
      slot.timer = null;
      slot.current = null;
      if (message.ok) pending.resolve(message.result as never);
      else pending.reject(new Error(message.error ?? 'Engine job failed'));
      this.pump();
    });

    worker.on('error', (error) => {
      log.exception('engine.worker.error', error);
      this.replace(slot, error);
    });
    worker.on('exit', (code) => {
      if (this.closed || !this.slots.includes(slot)) return;
      this.replace(slot, new Error(`Engine worker exited with code ${code}`));
    });

    this.slots.push(slot);
    return slot;
  }

  private timedOut(slot: Slot): void {
    log.warn('engine.job.timeout', { type: slot.current?.job.type ?? null });
    const pending = slot.current;
    slot.current = null;
    pending?.reject(new Error('Engine job timed out'));
    this.replace(slot, null);
    void slot.worker.terminate();
  }

  /** Drop a worker that failed, failing its job, and carry on with a fresh one. */
  private replace(slot: Slot, error: Error | null): void {
    const index = this.slots.indexOf(slot);
    if (index < 0) return;
    this.slots.splice(index, 1);
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = null;
    if (slot.current && error) slot.current.reject(error);
    slot.current = null;
    if (!this.closed) this.pump();
  }
}
