/**
 * One-off favicon + PWA-icon generator.
 *
 * Reads the canonical brand logo at `public/brand/logo.png` and emits the
 * full icon set under `public/`:
 *
 *   - favicon.ico        (multi-size: 16, 32, 48 — for legacy + Windows)
 *   - icon-32.png        (general <link rel="icon"> at 32x32)
 *   - apple-icon.png     (iOS home-screen, 180x180)
 *   - icon-192.png       (PWA Android home-screen)
 *   - icon-512.png       (PWA Android splash)
 *
 * Run with: pnpm favicons
 * Re-run only when the brand logo changes — generated files are committed.
 */

import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const SOURCE = join(repoRoot, 'public', 'brand', 'logo.png');
const OUT_DIR = join(repoRoot, 'public');

const PNG_TARGETS = [
  { name: 'icon-32.png', size: 32 },
  { name: 'apple-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

const ICO_SIZES = [16, 32, 48];

// Rounded-corner radius as a fraction of size. ~18% lines up roughly with
// the iOS app-icon squircle and the in-app Nav logo's `rounded-lg` so the
// browser-tab favicon visually matches the site chrome.
const RADIUS_RATIO = 0.18;

function roundedMask(size) {
  const radius = Math.round(size * RADIUS_RATIO);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/>` +
      `</svg>`,
  );
}

async function generatePng(size) {
  return sharp(SOURCE)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .composite([{ input: roundedMask(size), blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  console.log(`Source: ${SOURCE}`);
  console.log(`Output: ${OUT_DIR}`);

  for (const target of PNG_TARGETS) {
    const buffer = await generatePng(target.size);
    const out = join(OUT_DIR, target.name);
    await writeFile(out, buffer);
    console.log(`  ${target.name.padEnd(20)} ${target.size}x${target.size}  ${buffer.byteLength} B`);
  }

  const icoPngBuffers = await Promise.all(ICO_SIZES.map(generatePng));
  const icoBuffer = await pngToIco(icoPngBuffers);
  const icoOut = join(OUT_DIR, 'favicon.ico');
  await writeFile(icoOut, icoBuffer);
  console.log(`  favicon.ico          [${ICO_SIZES.join(',')}]  ${icoBuffer.byteLength} B`);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
