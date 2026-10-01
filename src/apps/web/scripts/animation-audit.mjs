import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Run against the dev server: npm run audit:animations --workspace @dooz/web.
const BASE = process.env.AUDIT_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
const errors = [];
const out = await mkdtemp(join(tmpdir(), 'dooz-animation-qa-'));
async function open(mode = 'classic', width = 390, motion = 'no-preference', bot = false) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: width < 600,
    hasTouch: width < 600,
    reducedMotion: motion,
  });
  await ctx.addInitScript(() => {
    Math.random = () => 0.25;
    localStorage.setItem(
      'dooz.preferences',
      JSON.stringify({ onboarded: true, sound: false, theme: 'dark' }),
    );
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(
    `${BASE}/play/${bot ? 'bot' : 'local'}?mode=${mode}${bot ? '&difficulty=easy' : ''}`,
  );
  await p.locator('[role="grid"]').waitFor();
  await p.waitForTimeout(1800);
  return { p, ctx };
}
async function move(p, i) {
  await p.locator(`[data-cell="${i}"]`).click();
}
async function has(p, name) {
  assert(
    await p.evaluate((n) => document.getAnimations().some((a) => a.animationName === n), name),
    `Missing ${name}`,
  );
}
async function shot(p, name) {
  await p.screenshot({ path: `${out}/${name}.png` });
}
async function checkLayout(p) {
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'horizontal overflow',
  );
}
try {
  for (const width of [320, 390, 1024]) {
    const { p, ctx } = await open('classic', width);
    await checkLayout(p);
    await move(p, 0);
    await has(p, 'mark-x');
    await has(p, 'piece-trace');
    await has(p, 'cell-impact');
    const old = await p
      .locator('[data-cell="0"] .animate-mark-x')
      .evaluate((e) => e.getAnimations()[0].currentTime);
    await move(p, 4);
    await has(p, 'mark-o');
    const after = await p
      .locator('[data-cell="0"] .animate-mark-x')
      .evaluate((e) => e.getAnimations()[0].currentTime);
    assert(after >= old, 'old mark restarted');
    const occupied = await p.locator('[data-cell="0"]').boundingBox();
    await p.mouse.click(occupied.x + occupied.width / 2, occupied.y + occupied.height / 2);
    await has(p, 'cell-reject');
    await p.getByRole('button', { name: 'Take back the last move' }).click();
    assert((await p.locator('[data-cell="4"]').getAttribute('aria-label')).includes('empty'));
    await move(p, 3);
    await move(p, 1);
    await move(p, 4);
    await move(p, 2);
    await has(p, 'draw-line');
    await has(p, 'win-tip');
    await has(p, 'board-settle');
    await has(p, 'victory-burst');
    if (width === 390) {
      await p.waitForTimeout(350);
      await shot(p, 'win');
    }
    await p.getByRole('dialog', { name: 'Player 1 wins!' }).waitFor();
    await has(p, 'result-in');
    if (width === 390) {
      await p.waitForTimeout(500);
      await shot(p, 'result');
    }
    await p.getByRole('button', { name: 'Next game', exact: true }).click();
    assert((await p.locator('[data-cell="0"]').getAttribute('aria-label')).includes('empty'));
    results.push(
      `classic ${width}px: placements, invalid tap, undo, win, modal and rematch passed`,
    );
    await ctx.close();
  }
  {
    const { p, ctx } = await open();
    for (const i of [0, 1, 2, 4, 3, 5, 7, 6, 8]) await move(p, i);
    await has(p, 'board-draw');
    await p.getByRole('dialog', { name: 'Draw', exact: true }).waitFor();
    results.push('draw passed');
    await ctx.close();
  }
  {
    const { p, ctx } = await open('gravity');
    await move(p, 0);
    await has(p, 'drop');
    await p.waitForTimeout(100);
    await shot(p, 'gravity');
    assert((await p.locator('[data-cell="42"]').getAttribute('aria-label')).endsWith('X'));
    await p.waitForTimeout(650);
    await move(p, 0);
    assert((await p.locator('[data-cell="35"]').getAttribute('aria-label')).endsWith('O'));
    await checkLayout(p);
    results.push('gravity fall and stacked landing passed');
    await ctx.close();
  }
  {
    const { p, ctx } = await open('vanish');
    for (const i of [0, 1, 2, 3, 4, 6, 5]) await move(p, i);
    await has(p, 'vanish-out');
    assert((await p.locator('[data-cell="0"]').getAttribute('aria-label')).includes('empty'));
    await shot(p, 'vanish');
    results.push('vanish removal passed');
    await ctx.close();
  }
  {
    const { p, ctx } = await open('ultimate');
    await move(p, 0);
    await move(p, 1);
    await move(p, 3);
    await has(p, 'subboard-in');
    await checkLayout(p);
    await shot(p, 'ultimate');
    results.push('ultimate target transitions passed');
    await ctx.close();
  }
  {
    const { p, ctx } = await open('gomoku-15');
    await move(p, 0);
    await has(p, 'mark-x');
    await move(p, 1);
    assert.equal(await p.locator('[role="grid"] .piece-trace').count(), 1);
    await checkLayout(p);
    results.push('225-cell board: newest move only passed');
    await ctx.close();
  }
  {
    const { p, ctx } = await open('classic', 390, 'reduce');
    await move(p, 0);
    await p.waitForTimeout(150);
    assert(
      await p
        .locator('[data-cell="0"] .animate-mark-x')
        .evaluate((e) => parseFloat(getComputedStyle(e).animationDuration) >= 0.6),
    );
    await checkLayout(p);
    await has(p, 'mark-x');
    results.push('full animation remains enabled with system reduced motion passed');
    await ctx.close();
  }
  {
    const { p, ctx } = await open('classic', 390, 'no-preference', true);
    await move(p, 0);
    await p.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('[role="gridcell"]')).filter((e) =>
          /column \d+, [XO]$/.test(e.getAttribute('aria-label')),
        ).length >= 2,
    );
    results.push('bot response passed');
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors, screenshots: out }, null, 2));
} finally {
  await browser.close();
}
