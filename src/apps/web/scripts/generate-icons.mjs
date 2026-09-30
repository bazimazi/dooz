/** Generate web artwork and the source layers consumed by Tauri. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const brandDir = resolve(here, '../../../assets/brand');
const publicDir = resolve(here, '../public/brand');
const mark = await readFile(resolve(brandDir, 'mark.svg'), 'utf8');
const innerMark = mark.replace(/<svg[^>]*>/, '').replace('</svg>', '');
const canvas = '#232599';

function svg(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${content}</svg>`;
}

function tile({ rounded = false, scale = 1 } = {}) {
  return svg(`<defs>
    <radialGradient id="canvas" cx="30%" cy="12%" r="105%">
      <stop stop-color="#4152d5"/><stop offset="0.55" stop-color="${canvas}"/><stop offset="1" stop-color="#191685"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="${rounded ? 196 : 0}" fill="url(#canvas)"/>
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${innerMark}</g>`);
}

// A purpose-drawn reduction: no gradients or shadows at browser-tab sizes.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${canvas}"/>
  <path d="m13 14 16 16 m0-16L13 30" fill="none" stroke="#f3339e" stroke-width="7" stroke-linecap="round"/>
  <circle cx="43" cy="43" r="11" fill="none" stroke="#f9bd13" stroke-width="7"/>
</svg>`;

await mkdir(publicDir, { recursive: true });
await writeFile(resolve(publicDir, 'mark.svg'), mark);
await writeFile(resolve(publicDir, 'app-icon.svg'), tile({ rounded: true }));
await writeFile(resolve(publicDir, 'favicon.svg'), favicon);

const targets = [
  ['icon-192.png', 192, tile({ rounded: true })],
  ['icon-512.png', 512, tile({ rounded: true })],
  ['icon-1024.png', 1024, tile({ rounded: true })],
  // Colored pieces (including shadows) fit inside the central 80% circle.
  ['icon-512-maskable.png', 512, tile({ scale: 0.86 })],
  ['apple-touch-icon.png', 180, tile()],
  ['store-icon-1024.png', 1024, tile()],
  ['favicon-16.png', 16, favicon],
  ['favicon-32.png', 32, favicon],
  ['mark-1024.png', 1024, mark],
];

for (const [file, size, source] of targets) {
  const raster = sharp(Buffer.from(source)).resize(size, size);
  if (file === 'apple-touch-icon.png' || file === 'store-icon-1024.png') raster.removeAlpha();
  else raster.ensureAlpha();
  await raster.png().toFile(resolve(publicDir, file));
  console.log(`wrote brand/${file} (${size}x${size})`);
}

// Custom foregrounds are rendered at the full 108dp layer size by Tauri.
// Inset the actual artwork into Android's central 66dp safe circle here.
const androidLayer = (content) =>
  svg(`<g transform="translate(512 512) scale(0.66) translate(-512 -512)">${content}</g>`);
await writeFile(resolve(brandDir, 'android-foreground.svg'), androidLayer(innerMark));
await writeFile(
  resolve(brandDir, 'android-background.svg'),
  svg(`<rect width="1024" height="1024" fill="${canvas}"/>`),
);
await writeFile(
  resolve(brandDir, 'android-monochrome.svg'),
  androidLayer(`<g fill="none" stroke="#fff" stroke-linecap="round">
  <path d="M225 230 465 470 M465 230 225 470" stroke-width="90"/>
  <circle cx="665" cy="664" r="143" stroke-width="88"/>
</g>`),
);

// ICO is a directory of PNG frames; no additional encoder dependency needed.
const sizes = [16, 32, 48];
const frames = await Promise.all(
  sizes.map((size) => sharp(Buffer.from(favicon)).resize(size).png().toBuffer()),
);
const directory = Buffer.alloc(6 + frames.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);
let offset = directory.length;
for (const [index, frame] of frames.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
}
await writeFile(resolve(publicDir, 'favicon.ico'), Buffer.concat([directory, ...frames]));

// Export the selected illustration; generation itself is never part of a build.
await sharp(resolve(brandDir, 'key-art.png'))
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(resolve(publicDir, 'social-card.jpg'));
await sharp(resolve(brandDir, 'key-art.png'))
  .resize(1200)
  .webp({ quality: 88 })
  .toFile(resolve(publicDir, 'key-art.webp'));
