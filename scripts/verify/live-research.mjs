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
/* Overridable so this can be pointed at a preview deployment or a local
   server; defaults to the live demo. */
const B = process.env.BASE || 'https://curiocity-desktop.vercel.app';
const out = [];
const rec = (n,p,d)=>{out.push({n,p});console.log(`${p?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`)};
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const browser = await chromium.launch({ executablePath: EXE, args: ['--headless=new'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0,120)));

await page.goto(B + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await sleep(4000);
rec('home page loads the research UI', !page.url().includes('/canvas'), page.url());
rec('no setup wizard', !(await page.evaluate(()=>document.body.innerText.toLowerCase().includes('welcome'))));

// find the composer
const box = page.locator('textarea').first();
await box.waitFor({ timeout: 60000 });
await box.fill('What is the capital of France?');
await page.keyboard.press('Enter');

// wait for an answer to stream in
await page.waitForFunction(
  () => /Paris/i.test(document.body.innerText),
  null, { timeout: 240000 },
).catch(()=>{});

const body = await page.evaluate(()=>document.body.innerText);
rec('answer streams into the page', /Paris/i.test(body), body.replace(/\s+/g,' ').slice(0,150));

/* Deliberately NOT asserted here: whether the prose carries 【n】 citation
   markers. It depends on which model answered and how it chose to write, so
   it varies run to run on an app that is behaving correctly — an assertion on
   it fails intermittently and teaches you to ignore the suite. The stable,
   meaningful property is that the answer is backed by real sources, which the
   Links check below covers. */
await page.waitForTimeout(3000);

/* Sources live behind the answer's "Links" tab rather than in the prose, so
   the old keyword sweep of the default view found nothing and reported a
   failure for a page that was citing correctly. Open the tab and assert real
   external links, which is what "sources are shown" actually means. Do this
   last — switching tabs replaces the answer text this section just read. */
await page.locator('button:has-text("Links")').first().click().catch(() => {});
await page.waitForTimeout(2500);
const sourceLinks = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a[href^="http"]')).map((a) => a.href));
rec('sources are shown', sourceLinks.length > 0, `${sourceLinks.length} links, e.g. ${sourceLinks[0] ?? '—'}`);

// canvas still reachable from the sidebar
const canvasLink = page.locator('a[href="/canvas"]');
rec('canvas link present in sidebar', await canvasLink.count() > 0);
if (await canvasLink.count() > 0) {
  await canvasLink.first().click();
  await page.waitForSelector('.cm-content', { timeout: 120000 });
  rec('canvas still works from the same site', true);
}

await browser.close();
const bad = out.filter(o=>!o.p);
console.log(`\n${out.length-bad.length}/${out.length} passed`);
process.exit(bad.length ? 1 : 0);
