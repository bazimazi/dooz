import { parentPort } from 'node:worker_threads';
import { type EngineJob, runJob } from './jobs.js';

/**
 * Worker-thread entry point for engine jobs.
 *
 * One job at a time: the pool only hands a worker its next job after the last
 * answer has come back, so there is no queue in here to bound. A job that
 * throws answers with an error rather than killing the thread.
 */
parentPort?.on('message', (message: { id: number; job: EngineJob }) => {
  try {
    parentPort?.postMessage({ id: message.id, ok: true, result: runJob(message.job) });
  } catch (error) {
    parentPort?.postMessage({
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
