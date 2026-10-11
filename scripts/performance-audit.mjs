import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Use a production preview. CPU throttling approximates a slower phone's CPU;
// it cannot emulate its GPU, thermal limits, or storage.
const BASE = process.env.AUDIT_URL ?? 'http://127.0.0.1:4180';
const baseline = process.env.PERF_BASELINE === '1';
const results = [];
const errors = [];
const browser = await chromium.launch({ channel: 'chrome' });

async function open(path, workers = true) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    ({ workers }) => {
      Math.random = () => 0.25;
      localStorage.setItem(
        'dooz.preferences',
        JSON.stringify({
          onboarded: true,
          sound: false,
          music: false,
          hints: true,
        }),
      );
      window.auditPerformance = { tasks: [], taps: [], created: 0, active: 0 };
      const metrics = window.auditPerformance;
      new PerformanceObserver((list) => {
        for (const task of list.getEntries()) metrics.tasks.push(task.duration);
      }).observe({ type: 'longtask', buffered: true });
      document.addEventListener(
        'click',
        (event) => {
          const cell = event.target.closest?.('[data-cell]');
          if (!cell || cell.getAttribute('aria-disabled') === 'true') return;
          const started = performance.now();
          const before = cell.getAttribute('aria-label');
          const observer = new MutationObserver(() => {
            if (cell.getAttribute('aria-label') === before) return;
            metrics.taps.push(performance.now() - started);
            observer.disconnect();
          });
          observer.observe(cell, { attributes: true, attributeFilter: ['aria-label'] });
        },
        true,
      );
      if (!workers) {
        window.Worker = undefined;
      } else {
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args);
            metrics.created++;
            metrics.active++;
            this.auditTerminated = false;
          }
          terminate() {
            if (!this.auditTerminated) metrics.active--;
            this.auditTerminated = true;
            super.terminate();
          }
        };
      }
    },
    { workers },
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getTiming().iterations === Infinity,
      ),
  );
  return { context, page };
}

async function report(page, name) {
  const metrics = await page.evaluate(() => window.auditPerformance);
  const taps = [...metrics.taps].sort((a, b) => a - b);
  const row = {
    name,
    taps: taps.length,
    tapP95Ms: Math.round(taps[Math.max(0, Math.ceil(taps.length * 0.95) - 1)] ?? 0),
    maxLongTaskMs: Math.round(Math.max(0, ...metrics.tasks)),
    workersCreated: metrics.created,
    workersActive: metrics.active,
  };
  results.push(row);
  if (!baseline) {
    assert(row.tapP95Ms < 200, `${name}: slow tap-to-board update (${row.tapP95Ms}ms)`);
    assert(row.maxLongTaskMs < 300, `${name}: main thread blocked for ${row.maxLongTaskMs}ms`);
  }
}

try {
  const home = await open('/');
  results.push(
    await home.page.evaluate(() => ({
      name: 'home-startup',
      javascriptBytes: performance
        .getEntriesByType('resource')
        .filter((resource) => resource.name.endsWith('.js'))
        .reduce((total, resource) => total + resource.decodedBodySize, 0),
      maxLongTaskMs: Math.round(Math.max(0, ...window.auditPerformance.tasks)),
    })),
  );
  await home.context.close();

  for (const mode of [
    'classic',
    'grid-6',
    'grid-9',
    'gomoku-15',
    'gravity',
    'vanish',
    'ultimate',
  ]) {
    const { page, context } = await open(`/play/local?mode=${mode}`);
    await page.locator('[role="grid"]').waitFor();
    await page.evaluate(() => {
      window.auditPerformance.tasks = [];
    });
    for (let turn = 0; turn < 4; turn++) {
      const cell =
        mode === 'classic'
          ? page.locator(`[data-cell="${[0, 4, 1, 8][turn]}"]`)
          : page.locator('[data-cell][aria-disabled="false"]').first();
      const label = await cell.getAttribute('aria-label');
      await cell.tap();
      await page.waitForFunction(
        ({ index, label }) =>
          document.querySelector(`[data-cell="${index}"]`)?.getAttribute('aria-label') !== label,
        { index: await cell.getAttribute('data-cell'), label },
      );
      await page.waitForTimeout(180);
    }
    await report(page, `local-${mode}`);
    await context.close();
  }

  for (const workers of [true, false]) {
    const { page, context } = await open('/play/bot?mode=gomoku-15&difficulty=master', workers);
    await page.locator('[role="grid"]').waitFor();
    await page.evaluate(() => {
      window.auditPerformance.tasks = [];
    });
    await page.locator('[data-cell="112"]').tap();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-cell] [role="img"]').length >= 2,
    );
    await report(page, workers ? 'bot-master-worker' : 'bot-master-fallback');
    if (!baseline && workers) {
      assert.equal(
        await page.evaluate(() => window.auditPerformance.created),
        1,
        'ordinary bot play should not start a suggestion worker',
      );
    }
    await page.getByRole('link', { name: 'Back to home' }).click();
    await page.waitForURL(`${BASE}/`);
    if (!baseline)
      assert.equal(
        await page.evaluate(() => window.auditPerformance.active),
        0,
        'workers must stop when leaving the game',
      );
    await context.close();
  }
  assert.deepEqual(errors, [], 'browser errors');
  await mkdir('build/performance', { recursive: true });
  await writeFile(
    `build/performance/${baseline ? 'baseline' : 'latest'}.json`,
    JSON.stringify({ cpuSlowdown: 6, results }, null, 2),
  );
  console.table(results);
} finally {
  await browser.close();
}
