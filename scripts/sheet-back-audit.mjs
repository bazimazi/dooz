import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
});
await context.addInitScript(() =>
  localStorage.setItem('dooz.preferences', JSON.stringify({ onboarded: true, sound: false })),
);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const back = async () => {
  await page.evaluate(() => history.back());
  await page.waitForTimeout(600);
};
const assertHome = () => assert.equal(new URL(page.url()).pathname, '/');
try {
  await page.goto(process.env.DOOZ_URL ?? 'http://127.0.0.1:4173');
  await page.waitForTimeout(700);
  const dialog = page.getByRole('dialog');
  // Back must dismiss even when there is no earlier in-app page.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(500);
  await back();
  await dialog.waitFor({ state: 'hidden' });
  assertHome();
  // Establish a real previous page, then return home through a link.
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.waitForTimeout(650);
  await page.getByRole('link', { name: 'Back to home' }).click();
  await page.waitForTimeout(650);
  assertHome();
  // Different dismissal methods must not leave extra Back steps behind.
  for (const dismiss of ['back', 'done', 'escape', 'backdrop']) {
    await page.locator('.home-mode-card').click();
    await page.waitForTimeout(500);
    const sheetIndex = await page.evaluate(() => history.state['__TSR_index']);
    for (const mode of ['grid-6', 'grid-9', 'classic', 'misere', 'gravity']) {
      await dialog.locator(`[data-mode="${mode}"]`).click();
      assert.equal(await page.evaluate(() => history.state['__TSR_index']), sheetIndex);
    }
    assert.equal(
      await dialog.locator('[data-mode="gravity"]').getAttribute('aria-checked'),
      'true',
    );
    if (dismiss === 'back') await back();
    if (dismiss === 'done') await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    if (dismiss === 'escape') await page.keyboard.press('Escape');
    if (dismiss === 'backdrop') await page.mouse.click(5, 5);
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForTimeout(400);
    assertHome();
    assert.match(await page.locator('.home-mode-card').innerText(), /Gravity/);
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('dooz.preferences')).mode),
      'gravity',
    );
    assert.equal(await page.evaluate(() => history.state['__doozSheet']), undefined);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  }
  await page.getByRole('button', { name: 'Online', exact: true }).click();
  await page.waitForTimeout(500);
  await back();
  await dialog.waitFor({ state: 'hidden' });
  assertHome();
  // After all sheet entries have been consumed, normal page Back still works.
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.waitForTimeout(700);
  await back();
  assertHome();
  await page.getByRole('button', { name: 'Online', exact: true }).click();
  await page.waitForTimeout(500);
  await dialog.getByRole('button', { name: /Invite a friend/ }).click();
  await page.waitForTimeout(700);
  assert.equal(new URL(page.url()).pathname, '/play/online');
  await back();
  assertHome();
  assert.equal(await page.evaluate(() => history.state['__doozSheet']), undefined);
  // A long-press Back traversal must still dismiss the top layer first.
  await page.getByRole('button', { name: 'Two players', exact: true }).click();
  await page.waitForURL(/\/play\/local/);
  await page.waitForTimeout(700);
  const gameIndex = await page.evaluate(() => history.state['__TSR_index']);
  await page.getByRole('button', { name: 'Name the players' }).click();
  await page.waitForFunction(() => Boolean(history.state['__doozSheet']));
  await page.evaluate(() => history.go(-2));
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.waitForTimeout(400);
  assert.equal(new URL(page.url()).pathname, '/play/local');
  assert.equal(await page.evaluate(() => history.state['__TSR_index']), gameIndex);
  await page.getByRole('button', { name: 'Name the players' }).click();
  await page.waitForFunction(() => Boolean(history.state['__doozSheet']));
  await page.evaluate(() => {
    history.back();
    setTimeout(() => history.back(), 20);
  });
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.waitForTimeout(400);
  assert.equal(new URL(page.url()).pathname, '/play/local');
  assert.equal(await page.evaluate(() => history.state['__TSR_index']), gameIndex);
  await back();
  assertHome();
  assert.deepEqual(errors, []);
  console.log(
    'Repeated mode choices, Back, Done, Escape, backdrop and page navigation passed on a touch viewport with reduced-motion requested.',
  );
} finally {
  await browser.close();
}
