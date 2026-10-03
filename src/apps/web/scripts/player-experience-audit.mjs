import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Run against dev or preview: AUDIT_URL=http://localhost:3000 npm run audit:experience.
const BASE = process.env.AUDIT_URL ?? 'http://localhost:3000';
const OUTPUT = 'build/player-experience';
await mkdir(OUTPUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];

async function capture(page, name) {
  // Locator visibility does not include opacity. Wait for finite entrance
  // animations and view-transition snapshots before reviewing a screenshot.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' ||
          animation.effect?.getTiming().iterations === Infinity,
      ),
  );
  await page.screenshot({ path: `${OUTPUT}/${name}.png`, fullPage: true });
}

async function open(
  path,
  {
    width = 390,
    height = 844,
    theme = 'dark',
    reducedMotion = 'no-preference',
    preferences = {},
    saved = {},
  } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    reducedMotion,
  });
  await context.addInitScript(
    ({ prefs, games }) => {
      if (!localStorage.getItem('dooz.preferences'))
        localStorage.setItem(
          'dooz.preferences',
          JSON.stringify({ onboarded: true, sound: false, ...prefs }),
        );
      for (const [key, value] of Object.entries(games)) {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
      }
    },
    { prefs: preferences, games: saved },
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.locator('button, a').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

try {
  // First-time teaching must accept exactly what its instructions promise.
  {
    const { context, page } = await open('/', {
      preferences: { onboarded: false, reducedMotion: true },
    });
    await page.getByRole('gridcell', { name: 'row 1, column 1, empty' }).click();
    assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Practice with hints', exact: true }).click();
    await page.waitForURL(/practice=true/);
    await capture(page, 'practice-mobile');
    await context.close();
  }

  // Touch size, scrolling and keyboard access across phone and desktop layouts.
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [1280, 800],
  ]) {
    for (const theme of ['light', 'dark']) {
      const { context, page } = await open('/play/local?mode=gomoku-15', {
        width,
        height,
        theme,
        preferences: { reducedMotion: true },
      });
      await page.getByRole('button', { name: 'Enlarge board', exact: true }).click();
      const bounds = await page.locator('[data-cell="0"]').boundingBox();
      assert(bounds.width >= 35 && bounds.height >= 35, `enlarged cells too small at ${width}`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        'board causes horizontal page overflow',
      );
      const corner = page.getByRole('gridcell', { name: 'row 15, column 15, empty' });
      await corner.focus();
      await page.keyboard.press('Enter');
      assert.match(await page.locator('[data-cell="224"]').getAttribute('aria-label'), /[XO]$/);
      await page.keyboard.press('ArrowLeft');
      assert.equal(
        await page.locator('[data-cell="223"]').evaluate((cell) => cell === document.activeElement),
        true,
      );
      await capture(page, `enlarged-${width}-${theme}`);
      await page.getByRole('button', { name: 'Fit board', exact: true }).click();
      await context.close();
    }
  }

  // Reset protection, review, focus restoration and take-backs on a real board.
  {
    const { context, page } = await open('/play/local?mode=classic', {
      preferences: { reducedMotion: true },
    });
    await page.locator('[data-cell="0"]').click();
    await page.getByRole('button', { name: 'New game', exact: true }).click();
    await page.getByRole('dialog', { name: 'Start a new round?' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !window.history.state?.['__doozSheet']);
    assert.match(await page.locator('[data-cell="0"]').getAttribute('aria-label'), /[XO]$/);
    assert.equal(
      await page
        .getByRole('button', { name: 'New game', exact: true })
        .evaluate((button) => button === document.activeElement),
      true,
    );
    await page.getByRole('button', { name: 'New game', exact: true }).click();
    await page.getByRole('dialog', { name: 'Start a new round?' }).waitFor();
    await page.waitForFunction(() => Boolean(window.history.state?.['__doozSheet']));
    await page.goBack();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(new URL(page.url()).pathname, '/play/local');
    assert.match(await page.locator('[data-cell="0"]').getAttribute('aria-label'), /[XO]$/);
    for (const index of [3, 1, 4, 2]) await page.locator(`[data-cell="${index}"]`).click();
    await page.getByRole('button', { name: 'Review board', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Show result', exact: true }).click();
    await page.getByRole('button', { name: 'Review board', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Take back the last move', exact: true }).click();
    assert.match(await page.locator('[data-cell="2"]').getAttribute('aria-label'), /empty$/);
    await context.close();
  }

  // A difficulty prompt pauses the worker; cancelling it resumes the same turn.
  {
    const { context, page } = await open('/play/bot?mode=classic&difficulty=beginner', {
      preferences: { reducedMotion: true },
      saved: {
        'dooz.game:bot:classic:beginner:false': {
          config: { variant: 'classic', size: 3, winLength: 3 },
          opener: 1,
          moves: [],
        },
      },
    });
    await page.locator('[data-cell="0"]').click();
    await page.getByRole('radio', { name: 'Easy', exact: true }).click();
    await page.getByRole('dialog', { name: 'Change bot difficulty?' }).waitFor();
    await page.waitForTimeout(700);
    const savedBeforeCancel = await page.evaluate(
      () => JSON.parse(localStorage.getItem('dooz.game:bot:classic:beginner:false')).moves,
    );
    assert.deepEqual(savedBeforeCancel, [0], 'bot moved under the prompt');
    await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('dooz.game:bot:classic:beginner:false')).moves.length === 2,
    );
    assert.equal(new URL(page.url()).searchParams.get('difficulty'), 'beginner');
    await page.getByRole('radio', { name: 'Easy', exact: true }).click();
    await page.getByRole('button', { name: 'Change difficulty', exact: true }).click();
    await page.waitForURL(/difficulty=easy/);
    await context.close();
  }

  // Entering practice from a bot result also enables its teaching tools.
  {
    const { context, page } = await open('/play/bot?mode=classic&difficulty=expert', {
      preferences: { reducedMotion: true, hints: false },
      saved: {
        'dooz.game:bot:classic:expert:false': {
          config: { variant: 'classic', size: 3, winLength: 3 },
          opener: 1,
          moves: [0, 3, 1, 4],
        },
      },
    });
    await page.locator('[data-cell="8"]').click();
    await page.getByRole('dialog', { name: 'Expert bot wins', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Practice with hints', exact: true }).click();
    await page.waitForURL(/practice=true/);
    await page.getByRole('button', { name: 'Turn hints off', exact: true }).waitFor();
    await context.close();
  }

  // Win and block cues expose words and different shapes as well as colours.
  {
    const { context, page } = await open('/play/local?mode=classic', {
      preferences: { hints: true, reducedMotion: true },
      saved: {
        'dooz.game:local:classic': {
          config: { variant: 'classic', size: 3, winLength: 3 },
          opener: 1,
          moves: [1, 0, 8, 3],
        },
      },
    });
    await page.getByText('Block here', { exact: true }).waitFor();
    await page.getByRole('gridcell', { name: /row 3, column 1, empty, block/ }).waitFor();
    await capture(page, 'hint-mobile');
    await context.close();
  }

  // Device and in-game motion preferences both suppress CSS motion.
  for (const useSystem of [true, false]) {
    const { context, page } = await open('/play/local?mode=classic', {
      reducedMotion: useSystem ? 'reduce' : 'no-preference',
      preferences: { reducedMotion: !useSystem },
    });
    const durations = await page.locator('main').evaluate((element) => ({
      animation: getComputedStyle(element).animationDuration,
      delay: getComputedStyle(element).animationDelay,
    }));
    assert(parseFloat(durations.animation) <= 0.001 && parseFloat(durations.delay) === 0);
    for (const index of [0, 3, 1, 4, 2]) await page.locator(`[data-cell="${index}"]`).click();
    await page.getByRole('button', { name: 'Review board', exact: true }).click();
    assert.equal(
      await page
        .locator('svg line')
        .last()
        .evaluate((line) => Number.parseFloat(getComputedStyle(line).strokeDashoffset)),
      0,
      'reduced motion hid the winning line',
    );
    await context.close();
  }

  // The optional setting takes effect at once, survives reload, and can be disabled.
  {
    const { context, page } = await open('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('switch', { name: 'Reduce motion', exact: true }).click();
    assert.equal(
      await page.evaluate(() => document.documentElement.hasAttribute('data-reduced-motion')),
      true,
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.hasAttribute('data-reduced-motion')),
      true,
    );
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('switch', { name: 'Reduce motion', exact: true }).click();
    assert.equal(
      await page.evaluate(() => document.documentElement.hasAttribute('data-reduced-motion')),
      false,
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.hasAttribute('data-reduced-motion')),
      false,
    );
    await context.close();
  }

  assert.deepEqual(errors, [], 'runtime browser errors');
  console.log(
    'Player experience audit passed: teaching, touch targets, keyboard, recovery, bot cancellation, hints and motion.',
  );
} finally {
  await browser.close();
}
