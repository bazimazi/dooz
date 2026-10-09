import { chromium } from 'playwright';

/**
 * Accessibility audit against a running dev server.
 *
 * The unit tests cover the behaviour a refactor can silently break - the tab
 * stop, the arrow keys, the focus trap - but they run in jsdom, which has no
 * layout and no colour. Contrast, touch-target size and "is every control
 * named" can only be checked against a real browser, so they are checked here.
 *
 *     npm run dev                      # in one terminal
 *     npm run audit:a11y
 *
 * Exits non-zero on any finding, so it can gate a release.
 */
const BASE = process.env.AUDIT_URL ?? 'http://localhost:3000';

const browser = await chromium.launch({ channel: 'chrome' });
const problems = [];

async function audit(path, theme = 'dark') {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: theme,
  });
  await ctx.addInitScript(
    (t) =>
      localStorage.setItem(
        'dooz.preferences',
        JSON.stringify({
          mode: 'classic',
          difficulty: 'medium',
          theme: t,
          hints: false,
          onboarded: true,
        }),
      ),
    theme,
  );
  const page = await ctx.newPage();
  // Background account requests can retry while the server is unavailable.
  // Wait for the rendered app rather than for all networking to stop.
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.locator('button, a').first().waitFor();
  await page.waitForTimeout(1800);

  // 1. Every interactive element must have an accessible name.
  const unnamed = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(
      'button, a[href], input, [role="tab"], [role="radio"], [role="switch"]',
    )) {
      const name = (
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.textContent ||
        ''
      ).trim();
      if (!name) out.push(`${el.tagName.toLowerCase()} ${el.className.split(' ')[0] ?? ''}`.trim());
    }
    return out;
  });
  for (const el of unnamed) problems.push(`[${path}] unnamed control: ${el}`);

  // 2. Contrast of visible text against its painted background.
  //
  // Alpha is composited properly rather than ignored: most of the surfaces in
  // this design are translucent, so treating `rgba(x, y, z, 0.7)` as opaque
  // reports a contrast neither colour actually has.
  const lowContrast = await page.evaluate(() => {
    /**
     * Read any colour Chrome might report back.
     *
     * Three syntaxes reach this: `rgb()` with 0..255 channels, `color(srgb)`
     * with 0..1 channels, and - what Tailwind v4 emits for every opacity
     * modifier - `oklab()`. Reading them all as 0..255 RGB, which is the
     * obvious thing to do, turns every translucent surface into near-black and
     * reports contrast failures that are not there.
     */
    const parse = (c) => {
      const n = (c.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number);
      if (n.length < 3) return null;
      const alpha = n.length > 3 ? n[3] : 1;

      if (c.startsWith('oklab(') || c.startsWith('oklch(')) {
        let [L, A, B] = n;
        if (c.startsWith('oklch(')) {
          const hue = (B * Math.PI) / 180;
          [A, B] = [A * Math.cos(hue), A * Math.sin(hue)];
        }
        const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
        const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
        const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
        const lin = [
          4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
        ];
        const encode = (v) => {
          const clamped = Math.min(1, Math.max(0, v));
          return (
            255 * (clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055)
          );
        };
        return { r: encode(lin[0]), g: encode(lin[1]), b: encode(lin[2]), a: alpha };
      }

      const scale = c.startsWith('color(') ? 255 : 1;
      return { r: n[0] * scale, g: n[1] * scale, b: n[2] * scale, a: alpha };
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };

    /** The colour actually painted behind `el`, compositing every layer. */
    const backdrop = (el) => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const style = getComputedStyle(n);
        // A gradient fill (the button pills) paints from a custom property.
        const fill = style.getPropertyValue('--tile-fill').trim();
        if (style.backgroundImage !== 'none' && fill && fill !== 'transparent') {
          const probe = document.createElement('span');
          probe.style.color = fill;
          document.body.append(probe);
          const resolved = parse(getComputedStyle(probe).color);
          probe.remove();
          if (resolved) {
            layers.push(resolved);
            if (resolved.a >= 0.99) break;
          }
          continue;
        }
        const c = parse(style.backgroundColor);
        if (c && c.a > 0.01) {
          layers.push(c);
          if (c.a >= 0.99) break;
        }
      }
      let base = { r: 35, g: 37, b: 153, a: 1 };
      for (const layer of layers.toReversed()) base = over(layer, base);
      return base;
    };

    const out = [];
    for (const el of document.querySelectorAll(
      'p, span, h1, h2, h3, li, dd, dt, button, a, label',
    )) {
      if (!el.textContent?.trim() || el.children.length > 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;

      const raw = parse(style.color);
      if (!raw) continue;
      const bg = backdrop(el);
      // The element's own opacity multiplies into the text colour.
      let opacity = 1;
      for (let n = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
      const fg = over({ ...raw, a: raw.a * opacity }, bg);

      const l1 = lum(fg),
        l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        out.push(
          `"${el.textContent.trim().slice(0, 30)}" ${ratio.toFixed(2)}:1 (needs ${need}, ${Math.round(size)}px)`,
        );
      }
    }
    return out;
  });
  for (const issue of lowContrast) problems.push(`[${path} ${theme}] contrast: ${issue}`);

  // 3. Touch targets.
  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, a[href], [role="tab"], [role="radio"]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Board cells are a grid: the grid is the target, not each cell.
      if (el.getAttribute('role') === 'gridcell') continue;
      if (r.height < 28 || r.width < 28) {
        out.push(
          `${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    }
    return out;
  });
  for (const issue of small) problems.push(`[${path}] small target: ${issue}`);

  // 4. Keyboard: tab through and make sure focus stays visible and progresses.
  const seen = new Set();
  let stuck = 0;
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return `${el.tagName}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}`;
    });
    if (id === null) {
      stuck++;
      continue;
    }
    seen.add(id);
  }
  if (seen.size < 3) problems.push(`[${path}] only ${seen.size} tab stops reachable`);

  await ctx.close();
}

for (const path of [
  '/',
  '/play/local?mode=classic',
  '/play/local?mode=gravity',
  '/play/bot?mode=vanish&difficulty=easy',
  '/play/bot?mode=classic&difficulty=beginner&stage=pip-1',
  '/journey',
  '/puzzles',
  '/learn?mode=classic',
  '/leaderboard',
  '/profile',
]) {
  for (const theme of ['dark', 'light']) await audit(path, theme);
}

await browser.close();

if (problems.length > 0) {
  console.error(`${problems.length} accessibility problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('No accessibility problems found.');
