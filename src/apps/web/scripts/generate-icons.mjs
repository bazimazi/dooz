/**
 * Rasterise the app icons from a single SVG source.
 *
 * Run with `npm run icons --workspace @dooz/web` after changing the artwork.
 * The PNGs are committed, so a normal build and CI run need no image tooling.
 *
 * Three sizes are produced:
 *   - 192 and 512 for the web app manifest
 *   - 512 "maskable", where the mark is inset so a launcher can crop it to a
 *     circle or a squircle without cutting into the artwork
 *   - 180 for the iOS home-screen icon, which has no transparency and is
 *     rounded by the system
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '../public');

const CANVAS = '#232599';

/** The mark, laid out inside a `size` x `size` viewBox with `inset` margin. */
function markSvg(size, inset) {
  const span = size - inset * 2;
  const scale = span / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${CANVAS}"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    <g transform="translate(-2 14) scale(0.72)">
      <rect x="1.41" y="12.8" width="16.1" height="70.4" rx="8.05" transform="rotate(-45 1.41 12.8)" fill="#F3339E" stroke="#C20074" stroke-width="2"/>
      <rect x="51.2" y="1.41" width="16.1" height="70.4" rx="8.05" transform="rotate(45 51.2 1.41)" fill="#F3339E" stroke="#C20074" stroke-width="2"/>
    </g>
    <g transform="translate(42 40) scale(0.9)">
      <circle cx="32" cy="32" r="31" fill="#F9BD13" stroke="#AF7E00" stroke-width="2"/>
      <circle cx="32" cy="32" r="15" fill="${CANVAS}" stroke="#AF7E00" stroke-width="2"/>
    </g>
  </g>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, inset: 18 },
  { file: 'icon-512.png', size: 512, inset: 48 },
  // Launchers may crop up to 20% off each edge of a maskable icon.
  { file: 'icon-512-maskable.png', size: 512, inset: 110 },
  { file: 'apple-touch-icon.png', size: 180, inset: 16 },
];

await mkdir(publicDir, { recursive: true });

for (const { file, size, inset } of targets) {
  const png = await sharp(Buffer.from(markSvg(size, inset))).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(resolve(publicDir, file), png);
  console.log(`wrote ${file} (${size}x${size})`);
}
