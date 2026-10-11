import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.AUDIT_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: 'chrome' });
const screenshots = await mkdtemp(join(tmpdir(), 'dooz-graphics-qa-'));
const errors = [];
const results = [];

try {
  for (const width of [320, 390, 1024]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: width < 600,
      hasTouch: width < 600,
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() => {
      Math.random = () => 0.25;
      if (!localStorage.getItem('dooz.preferences')) {
        localStorage.setItem('dooz.preferences', JSON.stringify({ onboarded: true, sound: false }));
      }
      window.graphicsTransitions = 0;
      const start = document.startViewTransition?.bind(document);
      if (start)
        document.startViewTransition = (...args) => {
          window.graphicsTransitions++;
          return start(...args);
        };
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    const graphics = dialog.getByRole('radiogroup', { name: 'Graphics quality' });
    for (const quality of ['Low', 'Balanced', 'High', 'Low']) {
      await graphics.getByRole('radio', { name: quality, exact: true }).click();
      assert.equal(await page.locator('html').getAttribute('data-graphics'), quality.toLowerCase());
      assert.equal(
        await graphics.getByRole('radio', { name: quality }).getAttribute('aria-checked'),
        'true',
      );
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (quality !== 'High') {
        assert.equal(
          await dialog.evaluate((e) => getComputedStyle(e.parentElement).backdropFilter),
          'none',
        );
      }
    }
    await page.screenshot({ path: join(screenshots, `settings-low-${width}.png`) });
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-graphics'), 'low');

    for (const quality of ['low', 'balanced', 'high']) {
      await page.goto(BASE);
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page
        .getByRole('radiogroup', { name: 'Graphics quality' })
        .getByRole('radio', {
          name: quality === 'low' ? 'Low' : quality === 'balanced' ? 'Balanced' : 'High',
          exact: true,
        })
        .click();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('dialog', { name: 'Settings' }).waitFor({ state: 'detached' });
      // A direct load also verifies applying the saved preset before rendering.
      await page.goto(`${BASE}/play/local?mode=classic`);
      await page.getByRole('grid').waitFor();
      assert.equal(await page.locator('html').getAttribute('data-graphics'), quality);
      await page.locator('[data-cell="0"]').click();
      const mark = page.locator('[data-cell="0"] .w-full.origin-center');
      const duration = await mark.evaluate((e) => getComputedStyle(e).animationDuration);
      if (quality === 'low') {
        assert.equal(duration, '0s');
        assert.equal(await page.locator('.animate-spark').count(), 0);
        assert.equal(
          await page.locator('.last-move-ring').evaluate((e) => getComputedStyle(e).borderTopWidth),
          '2px',
        );
        assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      } else {
        assert(parseFloat(duration) >= 0.6);
        assert.equal(await page.locator('.animate-spark').count(), quality === 'high' ? 8 : 0);
      }
      for (const cell of [3, 1, 4, 2]) await page.locator(`[data-cell="${cell}"]`).click();
      await page.getByRole('dialog', { name: 'Player 1 wins!' }).waitFor();
      assert.equal(
        await page.locator('.animate-confetti-y').count(),
        quality === 'high' ? 56 : quality === 'balanced' ? 16 : 0,
      );
      await page.getByRole('button', { name: 'Review board', exact: true }).click();
      await page.getByRole('dialog', { name: 'Player 1 wins!' }).waitFor({ state: 'detached' });
      const line = page.locator('svg line').last();
      assert.equal(await line.evaluate((e) => getComputedStyle(e).strokeDashoffset), '0px');
      await page.screenshot({ path: join(screenshots, `win-${quality}-${width}.png`) });
      const transitionsBeforeReturn = await page.evaluate(() => window.graphicsTransitions);
      await page.getByRole('link', { name: /home/i }).click();
      await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
      const transitions = await page.evaluate(() => window.graphicsTransitions);
      assert.equal(transitions - transitionsBeforeReturn, quality === 'high' ? 1 : 0);
    }
    // Chalk uses SVG dash animations; its marks must remain visible on Low.
    await page.evaluate(() => {
      const preferences = JSON.parse(localStorage.getItem('dooz.preferences'));
      localStorage.setItem(
        'dooz.preferences',
        JSON.stringify({ ...preferences, graphics: 'low', skin: 'chalk' }),
      );
    });
    await page.goto(`${BASE}/play/local?mode=gravity`);
    await page.getByRole('grid').waitFor();
    await page.locator('[data-cell="0"]').click();
    assert((await page.locator('[data-cell="42"]').getAttribute('aria-label')).endsWith('X'));
    assert.equal(
      await page
        .locator('[data-cell="42"] .chalk-stroke')
        .first()
        .evaluate((e) => getComputedStyle(e).strokeDashoffset),
      '0px',
    );
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    results.push(
      `${width}px: live presets, persistence, placements, win lines, results, particles, navigation and static gravity/chalk passed`,
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors, screenshots }, null, 2));
} finally {
  await browser.close();
}
