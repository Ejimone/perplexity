import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require_ = createRequire(import.meta.url);
const pw = require_('playwright');
const { chromium } = pw;

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
const BASE = process.env.BASE || 'http://localhost:3000';

/* The canvas has to be usable at a phone width and a desktop width, and the
   thing that decides which layout it gets is the size of ITS OWN BOX, not the
   window — it also renders inside a ~720px floating panel on a wide screen.
   These checks assert the layout actually switches, and that code can still be
   written and run in each. */

const results = [];
const record = (n, p, d) => { results.push({ n, p }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: EXE, args: ['--headless=new'] });

const writeAndRun = async (page, label) => {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('const t = [3,4].map(n => n * 5);\nconsole.log("ran at ' + label + '", t.join("|"));');
  await page.locator('button:has-text("Run")').click();
  /* Scoped to the output pane: document.body also contains the editor buffer,
     which holds the very string this is waiting for, so a body-wide read
     succeeds before the program has run at all. */
  const readOut = () =>
    page.evaluate(
      () => document.querySelector('[data-canvas-output]')?.innerText ?? '',
    );
  for (let i = 0; i < 60; i++) {
    const txt = await readOut();
    if (/ran at /.test(txt)) return txt;
    await sleep(500);
  }
  return await readOut();
};

/* ---------- 1280px: the split layout ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await page.goto(`${BASE}/canvas`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.cm-content', { timeout: 120000 });
  await sleep(800);

  const tabsVisible = await page.locator('[role="tablist"]').isVisible();
  record('1280px: tab strip is hidden (splits are used instead)', !tabsVisible);

  const sep = await page.locator('[role="separator"]').count();
  const sepVisible = await page.locator('[role="separator"]').first().isVisible();
  record('1280px: split handles are present and visible', sep >= 1 && sepVisible, `${sep} handles`);

  /* All three panes on screen at once. */
  const editorBox = await page.locator('.cm-editor').first().boundingBox();
  record('1280px: editor is a usable width', editorBox.width > 500, `${Math.round(editorBox.width)}px`);

  const out = await writeAndRun(page, '1280');
  record('1280px: code can be written and run', /ran at 1280 15\|20/.test(out));

  /* The handles have to be grabbable, not 1px hairlines. aria-orientation
     names the handle, not the layout: the side-by-side split has a vertical
     bar, the stacked split a horizontal one. */
  const colHandle = await page.locator('[role="separator"][aria-orientation="vertical"]').first().boundingBox();
  const rowHandle = await page.locator('[role="separator"][aria-orientation="horizontal"]').first().boundingBox();
  record('1280px: column split handle has a real pointer target', colHandle.width >= 8, `${colHandle.width}px wide`);
  record('1280px: row split handle has a real pointer target', rowHandle.height >= 8, `${rowHandle.height}px tall`);

  /* No horizontal page overflow. */
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  record('1280px: no horizontal overflow', overflow <= 0, `${overflow}px`);
  await page.close();
}

/* ---------- 390px: the tab layout ---------- */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.goto(`${BASE}/canvas`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.cm-content', { timeout: 120000 });
  await sleep(800);

  const tabsVisible = await page.locator('[role="tablist"]').isVisible();
  record('390px: tab strip is shown', tabsVisible);

  const sepVisible = await page.locator('[role="separator"]').first().isVisible();
  record('390px: split handles are hidden (nothing to drag)', !sepVisible);

  /* The editor should own the full width, not a 38% sliver. */
  const editorBox = await page.locator('.cm-editor').first().boundingBox();
  record('390px: editor takes the full width, not a sliver', editorBox.width > 330, `${Math.round(editorBox.width)}px`);

  const assistVisible = await page.locator('textarea').first().isVisible().catch(() => false);
  record('390px: assist pane is not stealing width from the editor', !assistVisible);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  record('390px: no horizontal overflow', overflow <= 0, `${overflow}px`);

  const out = await writeAndRun(page, '390');
  record('390px: code can be written and run', /ran at 390 15\|20/.test(out));

  /* Running should have surfaced the Output tab automatically. */
  const outputTabSelected = await page.locator('[role="tab"]:has-text("Output")').getAttribute('aria-selected');
  record('390px: a run switches to the Output tab', outputTabSelected === 'true');

  /* Assist has to be reachable. */
  await page.locator('[role="tab"]:has-text("Assist")').click();
  await sleep(400);
  record('390px: assist is reachable as a tab', await page.locator('textarea').first().isVisible());

  /* And the editor must still hold its buffer after tab switching. */
  await page.locator('[role="tab"]:has-text("Code")').click();
  await sleep(400);
  const buf = await page.evaluate(() => document.querySelector('.cm-content')?.textContent || '');
  record('390px: buffer survives tab switching (editor never unmounts)', /ran at 390/.test(buf));

  await page.close();
}

/* ---------- a 720px panel on a 1440px screen ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  /* Force the container narrow without touching the viewport, which is
     exactly the floating-panel case a viewport breakpoint would get wrong. */
  await page.goto(`${BASE}/canvas`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.cm-content', { timeout: 120000 });
  await page.evaluate(() => {
    const el = document.querySelector('main');
    if (el) { el.style.width = '720px'; el.style.maxWidth = '720px'; }
  });
  await sleep(600);

  const tabsVisible = await page.locator('[role="tablist"]').isVisible();
  record('720px container on a 1440px screen: gets the TAB layout, not three slivers', tabsVisible);
  await page.close();
}

await browser.close();
const bad = results.filter((r) => !r.p);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
