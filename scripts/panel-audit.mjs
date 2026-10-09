import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = await mkdtemp(join(tmpdir(), 'dooz-panels-'));
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [width, height, theme] of [
    [320, 568, 'dark'],
    [390, 844, 'dark'],
    [430, 932, 'light'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(
      (theme) =>
        localStorage.setItem(
          'dooz.preferences',
          JSON.stringify({ onboarded: true, sound: false, theme }),
        ),
      theme,
    );
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:4173');
    await page.waitForTimeout(1000);
    await page.locator('.home-mode-card').click();
    const dialog = page.getByRole('dialog');
    await page.waitForTimeout(650);
    assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), 'sheet overflow');
    const box = await dialog.boundingBox();
    assert(box.y >= 0 && box.y + box.height <= height + 1, 'sheet clipped');
    await page.screenshot({ path: join(out, `modes-${width}-${theme}.png`) });
    const radios = dialog.getByRole('radio');
    for (let i = 0; i < (await radios.count()); i++) {
      await radios.nth(i).click();
      assert.equal(await radios.nth(i).getAttribute('aria-checked'), 'true');
    }
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.waitForTimeout(650);
    assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth), 'settings overflow');
    await page.screenshot({ path: join(out, `settings-${width}-${theme}.png`) });
    await dialog.getByRole('switch', { name: /^Music/ }).click();
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(JSON.stringify({ out, status: 'passed' }));
} finally {
  await browser.close();
}
