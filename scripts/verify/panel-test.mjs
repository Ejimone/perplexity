import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require_ = createRequire(import.meta.url);
const pw = require_('playwright');
const { chromium, _electron } = pw;

/* Playwright's bundled browser revision may not match what is installed; fall
   back to any chromium in the cache rather than failing outright. */
const findChromium = () => {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try { const p = chromium.executablePath(); if (fs.existsSync(p)) return p; } catch {}
  const root = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  for (const dir of (fs.existsSync(root) ? fs.readdirSync(root) : []).filter(d => d.startsWith('chromium-')).sort().reverse()) {
    const guess = path.join(root, dir, 'chrome-mac-arm64', 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (fs.existsSync(guess)) return guess;
  }
  return undefined;
};
const EXE = findChromium();
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const BASE = process.env.BASE ?? 'http://localhost:3000';
const results = [];
const record = (n, p, d) => { results.push({n,p}); console.log(`${p?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: EXE, args: ['--headless=new'] });
const page = await browser.newPage();

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await sleep(3000);

const launcher = page.locator('button[title="Open the coding canvas"]');
record('panel launcher appears on a normal page when enabled', await launcher.count() === 1);

await launcher.click();
await page.waitForSelector('.cm-content', { timeout: 120000 });
record('panel opens and mounts the canvas', true);

/* the app binds a bare "/" on document to focus the chat composer */
await page.click('.cm-content');
await page.keyboard.type('const path = "a/b/c";');
await sleep(500);
const text = await page.evaluate(() => document.querySelector('.cm-content').innerText);
const composerFocused = await page.evaluate(() => {
  const el = document.activeElement;
  return el?.tagName === 'TEXTAREA' && el.getAttribute('placeholder')?.toLowerCase().includes('ask');
});
record('typing "/" in the panel does not steal focus to the chat composer',
  text.includes('a/b/c') && !composerFocused, `buffer: ${text.slice(0,30)}`);

/* dragging the header moves the panel */
const boxBefore = await page.locator('div:has(> div > span:text("Canvas"))').first().boundingBox().catch(() => null);
/* Not span:text("Canvas") — the navigation has a "Canvas" label too, and
   .first() picked that instead, reporting a 0px drag for a panel that had
   never been touched. */
const header = page.locator('[data-canvas-panel-header]');
const hb = await header.boundingBox();
await page.mouse.move(hb.x + 30, hb.y + 5);
await page.mouse.down();
await page.mouse.move(hb.x - 120, hb.y + 60, { steps: 8 });
await page.mouse.up();
await sleep(400);
const hb2 = await header.boundingBox();
record('panel header drags the window', Math.abs(hb2.x - hb.x) > 40, `moved ${Math.round(hb2.x - hb.x)}px`);

/* panel must not appear on /canvas itself */
await page.goto(`${BASE}/canvas`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await sleep(2500);
record('panel does not render on /canvas', await page.locator('button[title="Open the coding canvas"]').count() === 0);

await browser.close();
const failed = results.filter(r => !r.p);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
