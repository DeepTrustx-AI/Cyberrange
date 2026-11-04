// Renders every lab illustration, in light and Ember, from the real 3D clay scenes:
//   - a still WebP per kind under src/assets/lab-art/, shown on every lab card;
//   - a looping animated WebP per kind under src/assets/lab-clips/, played while a
//     card is hovered with full graphics (the clock ticks, steam rises). The clip
//     opens on the still's frame and loops seamlessly (see LOOP in dioramas.ts).
// Pages with cards therefore draw no 3D at all.
//
//   npm run render:lab-art
//
// It starts its own Vite dev server and drives Chrome with puppeteer-core (set
// CHROME_PATH if Chrome is not in its usual place), and encodes the clips with
// sharp. Run it again after changing a scene in src/components/three/world/dioramas.ts
// or the light rig in world/kit.ts. A kind with no image yet still renders in the
// browser, and a kind with no clip simply stays still, so nothing breaks if it is
// forgotten.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { createServer } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STILLS = join(ROOT, 'src', 'assets', 'lab-art');
const CLIPS = join(ROOT, 'src', 'assets', 'lab-clips');
// Frames per second of the clips, over one LOOP of the scene (6 s).
const FPS = 15;
const LOOP_SECONDS = 6;
// Clip size: half the still's render, which is still twice the card's display size.
const CLIP_WIDTH = 440;
const CLIP_HEIGHT = 300;
const CHROME =
  process.env.CHROME_PATH ??
  {
    win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: '/usr/bin/google-chrome',
  }[process.platform];
// The real GPU where there is one; the scenes are the same either way.
const GPU = process.platform === 'win32' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-gpu', '--ignore-gpu-blocklist'];

const toBuffer = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: GPU });
try {
  const page = await browser.newPage();
  // Any page of the dev server will do; the favicon keeps the app itself out of the way.
  await page.goto(new URL('favicon.png', server.resolvedUrls.local[0]).href);
  const kinds = await page.evaluate(async () => (await import('/src/utils/labArtKind.ts')).LAB_ART_KINDS);

  const images = await page.evaluate(async (kinds) => {
    const { renderLabArt } = await import('/src/components/art/labArtRenderer.ts');
    const out = {};
    for (const kind of kinds) {
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
  }, kinds);
  mkdirSync(STILLS, { recursive: true });
  let bytes = 0;
  for (const [name, url] of Object.entries(images)) {
    const data = toBuffer(url);
    bytes += data.length;
    writeFileSync(join(STILLS, `${name}.webp`), data);
  }
  console.log(`Wrote ${Object.keys(images).length} images (${Math.round(bytes / 1024)} KB) to src/assets/lab-art/`);

  mkdirSync(CLIPS, { recursive: true });
  let clipBytes = 0;
  for (const kind of kinds) {
    for (const theme of ['light', 'dark']) {
      // One scene at a time, so only one clip's frames are in memory.
      const frames = await page.evaluate(
        async (kind, dark, count) => (await import('/src/components/art/labArtRenderer.ts')).renderLabArtFrames(kind, dark, count),
        kind,
        theme === 'dark',
        FPS * LOOP_SECONDS,
      );
      const resized = await Promise.all(frames.map((url) => sharp(toBuffer(url)).resize(CLIP_WIDTH, CLIP_HEIGHT).png().toBuffer()));
      const clip = await sharp(resized, { join: { animated: true } })
        .webp({ quality: 72, effort: 6, loop: 0, delay: Math.round(1000 / FPS) })
        .toBuffer();
      clipBytes += clip.length;
      writeFileSync(join(CLIPS, `${kind}-${theme}.webp`), clip);
    }
  }
  console.log(`Wrote ${kinds.length * 2} clips (${Math.round(clipBytes / 1024)} KB) to src/assets/lab-clips/`);
} finally {
  await browser.close();
  await server.close();
}
