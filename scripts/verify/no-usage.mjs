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
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const browser = await chromium.launch({ executablePath: EXE, args: ['--headless=new'] });
const page = await browser.newPage();
await page.goto('https://curiocity-desktop.vercel.app/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await sleep(4000);
await page.locator('textarea').first().fill('What is the tallest mountain in the world?');
await page.keyboard.press('Enter');
await page.waitForFunction(()=>/Everest/i.test(document.body.innerText), null, {timeout:240000}).catch(()=>{});
await sleep(4000);
const body = await page.evaluate(()=>document.body.innerText);
const hasTokens = /\btokens\b/i.test(body);
const hasCost   = /\$\d|~\$/.test(body);
console.log(`answer present:      ${/Everest/i.test(body)}`);
console.log(`shows "tokens":      ${hasTokens}   <- must be false`);
console.log(`shows a $ cost:      ${hasCost}   <- must be false`);
console.log('---');
console.log(body.replace(/\s+/g,' ').slice(0, 260));
await browser.close();
process.exit(hasTokens || hasCost ? 1 : 0);
