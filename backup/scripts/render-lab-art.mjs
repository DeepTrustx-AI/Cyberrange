// Renders every lab illustration once, in light and Ember, into WebP files under
// src/assets/lab-art/. Lab cards show these images, so pages with cards draw no 3D
// at all until a card is hovered (the live scene then takes over, matching the
// image exactly).
//
//   npm run render:lab-art
//
// It starts its own Vite dev server and drives Chrome with puppeteer-core (set
// CHROME_PATH if Chrome is not in its usual place). Run it again after changing a
// scene in src/components/three/world/dioramas.ts or the light rig in world/kit.ts.
// A kind with no image yet still renders in the browser, so nothing breaks if it
// is forgotten.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'assets', 'lab-art');
const CHROME =
  process.env.CHROME_PATH ??
  {
    win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: '/usr/bin/google-chrome',
  }[process.platform];
// The real GPU where there is one; the scenes are the same either way.
const GPU = process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-gpu', '--ignore-gpu-blocklist'];

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: GPU });
try {
  const page = await browser.newPage();
  // Any page of the dev server will do; the favicon keeps the app itself out of the way.
  await page.goto(new URL('favicon.png', server.resolvedUrls.local[0]).href);
  const images = await page.evaluate(async () => {
    const { LAB_ART_KINDS } = await import('/src/utils/labArtKind.ts');
    const { renderLabArt } = await import('/src/components/art/labArtRenderer.ts');
    const out = {};
    for (const kind of LAB_ART_KINDS) {
      for (const theme of ['light', 'dark']) {
        const image = new Image();
        image.src = await renderLabArt(kind, theme === 'dark');
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        out[`${kind}-${theme}`] = canvas.toDataURL('image/webp', 0.9);
      }
    }
    return out;
  });
  mkdirSync(OUT, { recursive: true });
  let bytes = 0;
  for (const [name, url] of Object.entries(images)) {
    const data = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    bytes += data.length;
    writeFileSync(join(OUT, `${name}.webp`), data);
  }
  console.log(`Wrote ${Object.keys(images).length} images (${Math.round(bytes / 1024)} KB) to src/assets/lab-art/`);
} finally {
  await browser.close();
  await server.close();
}
