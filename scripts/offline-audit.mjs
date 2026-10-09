import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Run against the production preview to verify the installed app offline.
const BASE = process.env.AUDIT_URL ?? 'http://127.0.0.1:4173';
const out = await mkdtemp(join(tmpdir(), 'dooz-offline-qa-'));
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const errors = [];
let apiRequests = 0;
await ctx.addInitScript(() => {
  Math.random = () => 0.25;
  localStorage.setItem(
    'dooz.preferences',
    JSON.stringify({ onboarded: true, sound: false, theme: 'dark' }),
  );
});
await ctx.route('**/api/**', (route) => {
  apiRequests++;
  return route.abort();
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
try {
  await page.goto(`${BASE}/profile`);
  await page.getByRole('heading', { name: 'Player', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Change avatar' }).click();
  await page.getByRole('button', { name: 'cat', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Offline Player');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('heading', { name: 'Offline Player', exact: true }).waitFor();
  assert.equal(apiRequests, 0, 'Local identity required the API');
  results.push('Fresh profile, name and avatar work with no server account');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Offline Player', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Change avatar' }).click();
  assert.equal(
    await page.getByRole('button', { name: 'cat', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  results.push('Production profile reloads fully offline with saved identity');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${BASE}/play/bot?mode=classic&difficulty=easy`);
    await page.waitForTimeout(2000);
    const cards = page.locator('header > div');
    const left = await cards.first().boundingBox();
    const right = await cards.last().boundingBox();
    assert(
      Math.abs(left.height - right.height) < 1 && Math.abs(left.width - right.width) < 1,
      'Unequal player frames',
    );
    assert.equal(
      await cards.first().locator('svg[viewBox="0 0 40 40"] g').getAttribute('fill'),
      '#f43f5e',
      'Selected avatar did not reach the game',
    );
    assert.equal(
      await cards.last().locator('svg[viewBox="0 0 40 40"]').count(),
      1,
      'Missing bot avatar',
    );
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Horizontal overflow',
    );
    await page.screenshot({ path: `${out}/player-cards-${width}.png` });
    await page.locator('header').screenshot({ path: `${out}/player-header-${width}.png` });
    const available = page.locator('[role="gridcell"][aria-disabled="false"]').first();
    await available.click();
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('[role="gridcell"]')).filter((e) =>
          /column \d+, [XO]$/.test(e.getAttribute('aria-label')),
        ).length >= 2,
    );
  }
  results.push('Equal frames, selected avatar, bot fallback and worker work offline at 320/390px');
  await page.goto(`${BASE}/play/local?mode=classic`);
  await page.locator('[data-cell="0"]').click();
  await page.locator('[data-cell="4"]').click();
  await page.reload();
  await page.locator('[role="grid"]').waitFor();
  assert((await page.locator('[data-cell="0"]').getAttribute('aria-label')).endsWith('X'));
  assert((await page.locator('[data-cell="4"]').getAttribute('aria-label')).endsWith('O'));
  await page.getByRole('button', { name: 'Take back the last move' }).click();
  assert((await page.locator('[data-cell="4"]').getAttribute('aria-label')).includes('empty'));
  results.push('Local game resumes and undo works after an offline reload');
  for (const path of ['/journey', '/puzzles', '/learn', '/']) {
    await page.goto(`${BASE}${path}`);
    await page.locator('#root button, #root a').first().waitFor();
    assert(await page.locator('#root').innerText(), 'Empty offline page');
  }
  results.push('Journey, puzzles, learning and home open offline');
  assert.equal(apiRequests, 0, 'A local page called the server API');
  const connected = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const publicProfile = {
    accountId: 'saved-account',
    displayName: 'Cached Player',
    avatar: 'owl',
    rating: 1234,
  };
  const profile = {
    ...publicProfile,
    createdAt: 1700000000000,
    claimed: false,
    stats: [],
    achievements: [],
  };
  const opponent = {
    ...publicProfile,
    accountId: 'opponent',
    displayName: 'Opponent',
    avatar: 'fox',
  };
  const match = {
    matchId: 'saved-match',
    mode: 'classic',
    config: { variant: 'classic', size: 3, winLength: 3 },
    kind: 'ranked',
    opponent,
    outcome: 'win',
    reason: 'line',
    ratingDelta: 16,
    playedAt: 1700000000000,
    durationMs: 42000,
    moveCount: 5,
    startingPlayer: 1,
    moves: [0, 3, 1, 4, 2],
    moveTimesMs: [1000, 2000, 1500, 3000, 900],
    players: { x: publicProfile, o: opponent },
    winner: 1,
  };
  await connected.addInitScript(
    ({ profile }) => {
      localStorage.setItem(
        'dooz.account',
        JSON.stringify({ accountId: profile.accountId, token: 'test-token' }),
      );
      localStorage.setItem('dooz.local-profile', JSON.stringify({ profile, changes: {} }));
      localStorage.setItem('dooz.preferences', JSON.stringify({ onboarded: true, sound: false }));
    },
    { profile },
  );
  await connected.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data =
      path === '/api/profile'
        ? { profile, ranks: [] }
        : path === '/api/matches'
          ? { matches: [match] }
          : path === '/api/matches/saved-match'
            ? match
            : {
                mode: 'classic',
                placementGames: 5,
                entries: [
                  {
                    rank: 1,
                    profile: publicProfile,
                    rating: 1234,
                    played: 1,
                    won: 1,
                    drawn: 0,
                    lost: 0,
                  },
                ],
              };
    return route.fulfill({ json: data });
  });
  const cachedPage = await connected.newPage();
  cachedPage.on('pageerror', (e) => errors.push(e.message));
  await cachedPage.goto(`${BASE}/profile`);
  await cachedPage.locator('a[href="/replay/saved-match"]').waitFor();
  await cachedPage.goto(`${BASE}/replay/saved-match`);
  await cachedPage.getByRole('button', { name: 'Next move', exact: true }).waitFor();
  await cachedPage.goto(`${BASE}/leaderboard`);
  await cachedPage.locator('ol').getByText('Cached Player', { exact: false }).waitFor();
  await cachedPage.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await cachedPage.reload();
  await cachedPage.waitForFunction(() => !!navigator.serviceWorker.controller);
  await connected.setOffline(true);
  await cachedPage.goto(`${BASE}/profile`);
  await cachedPage.locator('a[href="/replay/saved-match"]').waitFor();
  await cachedPage.goto(`${BASE}/replay/saved-match`);
  await cachedPage.getByRole('button', { name: 'Next move', exact: true }).click();
  assert((await cachedPage.locator('[data-cell="0"]').getAttribute('aria-label')).endsWith('X'));
  await cachedPage.goto(`${BASE}/leaderboard`);
  await cachedPage.locator('ol').getByText('Cached Player', { exact: false }).waitFor();
  results.push(
    'Downloaded history, interactive replay and leaderboard snapshot remain available offline',
  );
  await connected.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ results, errors, screenshots: out }, null, 2));
} finally {
  await ctx.close();
  await browser.close();
}
