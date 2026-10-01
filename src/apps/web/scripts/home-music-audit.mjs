import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const out = await mkdtemp(join(tmpdir(), 'dooz-home-music-'));
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() =>
  localStorage.setItem(
    'dooz.preferences',
    JSON.stringify({ onboarded: true, sound: false, theme: 'dark' }),
  ),
);
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
try {
  await p.goto('http://127.0.0.1:3000');
  await p.waitForTimeout(1200);
  for (const [width, height] of [
    [320, 568],
    [360, 775],
    [390, 844],
    [430, 932],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(1200);
    assert(
      await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'horizontal overflow',
    );
    const card = await p.locator('.home-mode-card').boundingBox();
    const footer = await p.getByRole('navigation', { name: 'Explore' }).boundingBox();
    assert(footer.y + footer.height <= height, 'footer below viewport');
    assert(height < 740 || card.height > 230, 'tall phone missing board preview');
    await p.screenshot({ path: join(out, `home-${width}-${height}.png`) });
  }
  await p.locator('.home-mode-card').click();
  await p.getByRole('radio', { name: /Gravity/ }).click();
  await p.getByRole('button', { name: 'Done', exact: true }).click();
  await p.locator('.home-mode-card').getByText('Gravity', { exact: true }).waitFor();
  await p.getByRole('button', { name: 'Settings', exact: true }).click();
  const toggle = p.getByRole('switch', { name: /^Music/ });
  await toggle.click();
  await p.waitForTimeout(2200);
  const live = await p.evaluate(async () => {
    const url = performance
      .getEntriesByType('resource')
      .find((r) => /\/src\/lib\/sound\.ts/.test(r.name)).name;
    const { soundEngine } = await import(url);
    const target = soundEngine.musicOutput();
    const analyser = target.context.createAnalyser();
    analyser.fftSize = 2048;
    target.bus.connect(analyser);
    const sample = () => {
      const a = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(a);
      return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
    };
    await new Promise((r) => setTimeout(r, 500));
    const rms = sample();
    target.bus.disconnect(analyser);
    return { rms, state: target.context.state };
  });
  assert(live.rms > 0.001, 'music is silent');
  await toggle.click();
  await p.waitForTimeout(1300);
  const stopped = await p.evaluate(async () => {
    const url = performance
      .getEntriesByType('resource')
      .find((r) => /\/src\/lib\/sound\.ts/.test(r.name)).name;
    const { soundEngine } = await import(url);
    const target = soundEngine.musicOutput();
    const analyser = target.context.createAnalyser();
    target.bus.connect(analyser);
    await new Promise((r) => setTimeout(r, 100));
    const a = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(a);
    target.bus.disconnect(analyser);
    return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
  });
  assert(stopped < 0.0001, 'music did not stop');
  const render = await p.evaluate(async () => {
    const { createMusicScore, MUSIC_BAR } = await import('/src/lib/music-score.ts');
    const sr = 22050;
    const c = new OfflineAudioContext(1, Math.ceil(sr * (MUSIC_BAR * 8 + 2)), sr);
    const g = c.createGain();
    g.gain.value = 0.75;
    g.connect(c.destination);
    const score = createMusicScore(c, g);
    for (let bar = 0; bar < 8; bar++) score(bar, 0.05 + bar * MUSIC_BAR);
    const b = await c.startRendering();
    const data = b.getChannelData(0);
    let peak = 0,
      s = 0;
    for (const v of data) {
      peak = Math.max(peak, Math.abs(v));
      s += v * v;
    }
    const pcm = Array.from(data, (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767));
    return { peak, rms: Math.sqrt(s / data.length), sr, pcm };
  });
  assert(render.peak < 0.95 && render.rms > 0.01, 'bad score levels');
  const buffer = Buffer.alloc(44 + render.pcm.length * 2);
  buffer.write('RIFF');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(render.sr, 24);
  buffer.writeUInt32LE(render.sr * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(render.pcm.length * 2, 40);
  render.pcm.forEach((v, i) => buffer.writeInt16LE(v, 44 + i * 2));
  await writeFile(join(out, 'music-preview.wav'), buffer);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ out, live, stopped, render: { peak: render.peak, rms: render.rms }, errors }),
  );
} finally {
  await ctx.close();
  await browser.close();
}
