import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.DOOZ_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
await mkdir('build/navigation', { recursive: true });

async function settled(page) {
  // Pointer clicks in touch emulation can leave desktop hover feedback active
  // under a newly rendered control. Move off controls before visual checks.
  await page.mouse.move(0, 0);
  // The browser URL changes before React commits the destination and starts
  // its entrance animations. Include that handoff before inspecting layout.
  await page.waitForTimeout(150);
  await page
    .waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (animation) =>
            animation.playState !== 'running' ||
            animation.effect?.getTiming().iterations === Infinity,
        ),
    )
    .catch(async (error) => {
      console.info(
        await page.evaluate(() =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === 'running' &&
                animation.effect?.getTiming().iterations !== Infinity,
            )
            .map((animation) => ({
              name: animation.animationName,
              target: animation.effect?.target?.outerHTML?.slice(0, 180),
              timing: animation.effect?.getTiming(),
            })),
        ),
      );
      throw error;
    });
}
async function back(page, path) {
  await page.evaluate(() => history.back());
  await page.waitForURL((url) => url.pathname === path);
  await settled(page);
}
async function open(width, height, path = '/') {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    if (!localStorage.getItem('dooz.preferences'))
      localStorage.setItem(
        'dooz.preferences',
        JSON.stringify({ onboarded: true, sound: false, music: false, difficulty: 'beginner' }),
      );
    if (!localStorage.getItem('dooz.game:bot:classic:beginner:false'))
      localStorage.setItem(
        'dooz.game:bot:classic:beginner:false',
        JSON.stringify({
          config: { variant: 'classic', size: 3, winLength: 3 },
          opener: 1,
          moves: [],
        }),
      );
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(15_000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${BASE}${path}`);
  await settled(page);
  return { page, context };
}
async function fits(page, name) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    `${name}: horizontal overflow`,
  );
  for (const control of await page.getByRole('link', { name: /Back to|All puzzles/ }).all()) {
    const box = await control.boundingBox();
    assert(box && box.width >= 44 && box.height >= 44, `${name}: small return target`);
  }
  await page.screenshot({ path: `build/navigation/${name}.png`, fullPage: true });
}

try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
  ]) {
    const { page, context } = await open(width, height);
    console.info(`Checking navigation at ${width}x${height}`);
    const homeIndex = await page.evaluate(() => history.state['__TSR_index']);
    // All top-level routes must return without creating page -> home -> page loops.
    for (const [name, path] of [
      ['Profile', '/profile'],
      ['Ranks', '/leaderboard'],
      ['Puzzles', '/puzzles'],
      ['How to play', '/learn'],
      ['Journey:', '/journey'],
    ]) {
      await page
        .getByRole('link', {
          name: name.endsWith(':') ? new RegExp(name) : name,
          exact: !name.endsWith(':'),
        })
        .click();
      await page.waitForURL((url) => url.pathname === path);
      await settled(page);
      await fits(page, `${width}-${height}-${path.slice(1)}`);
      if (path === '/learn') {
        for (const tab of ['Grid 6', 'Ultimate', 'Classic'])
          await page.getByRole('tab', { name: tab, exact: true }).click();
        await page.getByRole('button', { name: 'Start the walkthrough' }).click();
        await page.waitForFunction(() => Boolean(history.state['__doozSheet']));
        await page.evaluate(() => history.back());
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        assert.equal(new URL(page.url()).pathname, '/learn');
      }
      if (path === '/journey') {
        await page.getByRole('button', { name: /^Stage 1:/ }).click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('dialog').getByRole('button', { name: 'Play', exact: true }).click();
        await page.waitForURL(/stage=/);
        await back(page, '/journey');
        assert.equal(await page.getByRole('dialog').count(), 0);
      }
      if (path === '/puzzles') {
        await page.getByRole('tab', { name: 'Easy', exact: true }).click();
        await page.waitForURL(/tier=/);
        const puzzle = page.locator('a[href^="/puzzles/"]').nth(6);
        await puzzle.scrollIntoViewIfNeeded();
        const scroll = await page.evaluate(() => scrollY);
        await puzzle.click();
        await page.waitForURL(/\/puzzles\//);
        await settled(page);
        await fits(page, `${width}-${height}-puzzle`);
        await page.getByRole('link', { name: 'All puzzles', exact: true }).click();
        await page.waitForURL((url) => url.pathname === '/puzzles');
        await settled(page);
        assert.equal(
          await page.getByRole('tab', { name: 'Easy', exact: true }).getAttribute('aria-selected'),
          'true',
        );
        const restoredScroll = await page.evaluate(() => scrollY);
        assert(
          Math.abs(restoredScroll - scroll) < 3,
          `puzzle list scroll lost: ${scroll} -> ${restoredScroll}`,
        );
      }
      await page.getByRole('link', { name: 'Back to home', exact: true }).click();
      await page.waitForURL((url) => url.pathname === '/');
      await settled(page);
      assert.equal(await page.evaluate(() => history.state['__TSR_index']), homeIndex);
      assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    }
    // Confirmed difficulty edits replace the game, including the overlay slot.
    console.info('Checking bot setting confirmations');
    await page.getByRole('button', { name: 'Play vs bot', exact: true }).click();
    await page.waitForURL(/\/play\/bot/);
    await settled(page);
    for (const difficulty of ['Easy', 'Medium', 'Hard']) {
      if ((await page.locator('[data-cell="0"]').getAttribute('aria-disabled')) === 'false') {
        await page.locator('[data-cell="0"]').click();
      }
      await page.getByRole('radio', { name: difficulty, exact: true }).click();
      const confirmation = page.getByRole('dialog', { name: 'Change bot difficulty?' });
      if (await confirmation.count()) {
        await confirmation.getByRole('button', { name: 'Change difficulty', exact: true }).click();
      }
      await page.waitForURL(new RegExp(`difficulty=${difficulty.toLowerCase()}`));
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await fits(page, `${width}-${height}-bot`);
    await back(page, '/');
    assert.equal(await page.evaluate(() => history.state['__TSR_index']), homeIndex);
    await page.getByRole('button', { name: 'Two players', exact: true }).click();
    await page.waitForURL(/\/play\/local/);
    await settled(page);
    await page.locator('[data-cell="0"]').click();
    await page.getByRole('button', { name: 'Name the players' }).click();
    await page.getByRole('textbox', { name: 'Plays X' }).fill('Alex');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !history.state['__doozSheet']);
    await page.getByRole('button', { name: 'New game', exact: true }).click();
    await page.waitForFunction(() => Boolean(history.state['__doozSheet']));
    await page.evaluate(() => history.back());
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.match(await page.locator('[data-cell="0"]').getAttribute('aria-label'), /[XO]$/);
    await fits(page, `${width}-${height}-local`);
    await page.getByRole('link', { name: 'Back to home', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await settled(page);
    assert.equal(await page.evaluate(() => history.state['__TSR_index']), homeIndex);
    // Online entry and lobby return must not resurrect the old lobby on Back.
    console.info('Checking online return');
    await page.getByRole('button', { name: 'Online', exact: true }).click();
    await page.getByRole('button', { name: /Invite a friend/ }).click();
    await page.waitForURL(/\/play\/online/);
    await settled(page);
    await fits(page, `${width}-${height}-online`);
    await page.getByRole('button', { name: 'Back to home', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await settled(page);
    assert.equal(await page.evaluate(() => history.state['__TSR_index']), homeIndex);
    await context.close();
  }
  // Direct links have useful fallbacks; a return never pushes the broken link again.
  for (const [path, label, target] of [
    ['/puzzles/missing', 'All puzzles', '/puzzles'],
    ['/replay/missing', 'Back to your matches', '/profile'],
    ['/missing', 'Back to home', '/'],
  ]) {
    const { page, context } = await open(390, 844, path);
    await page.getByRole('link', { name: label, exact: true }).first().click();
    await page.waitForURL((url) => url.pathname === target);
    assert.equal(await page.evaluate(() => history.state['__TSR_index']), 0);
    await context.close();
  }
  // Deterministic server frames exercise healthy replays and an active online
  // game, without joining another player's real room during an audit.
  {
    const { page, context } = await open(390, 844);
    const me = {
      accountId: '11111111-1111-4111-8111-111111111111',
      displayName: 'Audit Player',
      avatar: 'owl',
      rating: 1200,
    };
    const opponent = {
      ...me,
      accountId: '22222222-2222-4222-8222-222222222222',
      displayName: 'Opponent',
      avatar: 'fox',
    };
    const profile = {
      ...me,
      createdAt: 1700000000000,
      claimed: false,
      stats: [],
      achievements: [],
    };
    const config = { variant: 'classic', size: 3, winLength: 3 };
    const match = {
      matchId: 'navigation-match',
      mode: 'classic',
      config,
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
      players: { x: me, o: opponent },
      winner: 1,
    };
    await context.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const data =
        path === '/api/matches'
          ? { matches: [match] }
          : path === '/api/matches/navigation-match'
            ? match
            : { profile, ranks: [] };
      return route.fulfill({
        json: data,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'content-type,authorization',
          'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
        },
      });
    });
    await context.addInitScript(
      ({ profile: savedProfile }) => {
        localStorage.setItem(
          'dooz.account',
          JSON.stringify({ accountId: savedProfile.accountId, token: 'a'.repeat(43) }),
        );
        localStorage.setItem(
          'dooz.local-profile',
          JSON.stringify({ profile: savedProfile, changes: {} }),
        );
      },
      { profile },
    );
    const messages = [];
    await page.routeWebSocket('**/ws', (socket) =>
      socket.onMessage((raw) => {
        const message = JSON.parse(String(raw));
        messages.push(message);
        if (message.type === 'hello')
          socket.send(JSON.stringify({ type: 'welcome', version: 4, profile: me, resumed: false }));
        if (['queue', 'createRoom'].includes(message.type))
          socket.send(
            JSON.stringify({
              type: 'matched',
              code: 'ABCDEF',
              kind: 'casual',
              you: 1,
              spectators: 0,
              clock: null,
              seats: [
                { player: 1, profile: me, connected: true, wantsRematch: false },
                { player: 2, profile: opponent, connected: true, wantsRematch: false },
              ],
              snapshot: {
                config,
                board: Array(9).fill(0),
                currentPlayer: 1,
                status: 'playing',
                winner: null,
                winLine: null,
                lastMove: null,
                moves: [],
                ultimate: null,
              },
            }),
          );
      }),
    );
    await page.reload();
    await page.getByRole('link', { name: 'Profile', exact: true }).click();
    await page.locator('a[href="/replay/navigation-match"]').click();
    await page.getByRole('button', { name: 'Next move', exact: true }).click();
    await settled(page);
    await fits(page, '390-844-replay');
    await page.getByRole('link', { name: 'Back to your matches', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/profile');
    await back(page, '/');
    await page.getByRole('button', { name: 'Online', exact: true }).click();
    await page.getByRole('button', { name: /Invite a friend/ }).click();
    await page.getByRole('button', { name: 'Resign', exact: true }).click();
    const resign = page.getByRole('alertdialog', { name: 'Resign this game?' });
    await resign.waitFor();
    await page.waitForFunction(() => Boolean(history.state['__doozSheet']));
    await page.evaluate(() => history.back());
    await resign.waitFor({ state: 'hidden' });
    assert.equal(new URL(page.url()).pathname, '/play/online');
    assert.equal(messages.filter((message) => message.type === 'resign').length, 0);
    await back(page, '/');
    assert(
      messages.some((message) => message.type === 'leave'),
      'Back did not release the online room',
    );
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    'Navigation, dialog edits, deep-link returns and 44px controls passed at narrow, portrait and landscape phone sizes.',
  );
} finally {
  await browser.close();
}
