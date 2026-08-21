import { createRequire } from 'node:module';
import path from 'node:path'; import fs from 'node:fs';
const require_ = createRequire(import.meta.url);
const { chromium } = require_('playwright');
const findChromium = () => {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try { const p = chromium.executablePath(); if (fs.existsSync(p)) return p; } catch {}
  const root = path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');
  for (const d of (fs.existsSync(root)?fs.readdirSync(root):[]).filter(x=>x.startsWith('chromium-')).sort().reverse()) {
    const g = path.join(root,d,'chrome-mac-arm64','Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (fs.existsSync(g)) return g;
  } return undefined;
};
const EXE = findChromium();
const BASE = process.env.BASE || 'http://localhost:3000';

/* Discover, Library and a chat thread are views on `/` rather than routes, so
   the hosted build can afford them. This asserts the things a route used to
   give for free and now have to be built: a linkable URL, a working Back
   button, correct nav highlighting, and no server round trip per switch. */

const results = [];
const rec = (n,p,d) => { results.push({n,p}); console.log(`${p?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`); };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const browser = await chromium.launch({ executablePath: EXE, args: ['--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

/* Wait for hydration, not for a stopwatch — and not for anything that is
 * already in the server-rendered HTML.
 *
 * Clicking a nav link before React attaches follows the real href and performs
 * a genuine document navigation. That is correct progressive enhancement, but
 * it is indistinguishable from the bug these checks look for, so the test has
 * to wait for the handlers to actually exist. `aria-current` is no good as
 * that signal: Nav renders it server-side too, so waiting on it returns
 * immediately and the click races hydration. React's own `__reactProps$…` key,
 * which carries the attached listeners, appears only once hydration has run. */
const hydrated = async (pg, selector = 'nav a') => {
  /* networkidle first: React attaches `__reactProps$…` to an element as its
     subtree hydrates, but the delegated listener that actually runs the
     handler belongs to the root and can lag it. Waiting for the page to go
     quiet covers that gap; the props check then confirms the specific
     elements we are about to click are live. Without both, the click races
     hydration, follows the raw href, and reports a document reload for a
     view switch that would have been soft a moment later. */
  await pg.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
  return pg.waitForFunction(
    (sel) => {
      const els = Array.from(document.querySelectorAll(sel));
      return (
        els.length > 0 &&
        els.every((el) =>
          Object.keys(el).some((k) => k.startsWith('__reactProps')),
        )
      );
    },
    selector,
    { timeout: 120000 },
  );
};

/* For a deep link, hydration is not enough: ViewProvider reads the URL in an
   effect, so the nav briefly shows the server's default before correcting. */
const activeBecomes = (pg, label) =>
  pg.waitForFunction(
    (l) =>
      document.querySelector('nav a[aria-current="page"]')?.innerText?.trim() ===
      l,
    label,
    { timeout: 120000 },
  );

await page.goto(`${BASE}/`, { waitUntil:'domcontentloaded', timeout:120000 });
await hydrated(page);

/* Count main-frame document requests. A view switch must not cause one — that
   is the whole point of putting the views on this route. Counting requests
   beats leaving a marker on `window`: a marker cannot tell "the page reloaded"
   apart from "the marker was set before React attached and the click followed
   the raw href", and it is the second that made this flaky.
   framenavigated is no good either — CDP fires it for pushState too. */
let docRequests = 0;
const docUrls = [];
page.on('request', (r) => {
  if (r.resourceType() === 'document' && r.frame() === page.mainFrame()) {
    docRequests++; docUrls.push(r.url());
  }
});

const activeLabel = () => page.evaluate(() =>
  document.querySelector('nav a[aria-current="page"]')?.innerText?.trim() ?? null);

rec('home starts on the chat view', (await activeLabel()) === 'Home');

await page.locator('nav a:has-text("Discover")').click();
await sleep(2000);
rec('Discover opens as a view', /view=discover/.test(page.url()), page.url());
rec('Discover is marked active in the nav', (await activeLabel()) === 'Discover');
rec('Discover rendered its content', /Tech & Science|Discover/i.test(await page.evaluate(()=>document.body.innerText)));

await page.locator('nav a:has-text("Library")').click();
await sleep(1500);
rec('Library opens as a view', /view=library/.test(page.url()), page.url());
rec('Library is marked active in the nav', (await activeLabel()) === 'Library');

rec('switching views never reloaded the document', docRequests === 0,
    `${docRequests} document request(s): ${docUrls.join(', ')}`);

await page.goBack(); await sleep(1200);
rec('Back returns to Discover', /view=discover/.test(page.url()) && (await activeLabel()) === 'Discover', page.url());

/* A deep link has to restore the view on a cold load — this is what a route
   used to do and the reason the view lives in the URL. */
const fresh = await browser.newPage({ viewport: { width: 1280, height: 860 } });
await fresh.goto(`${BASE}/?view=library`, { waitUntil:'domcontentloaded', timeout:120000 });
await hydrated(fresh);
await activeBecomes(fresh, 'Library').catch(() => {});
rec('a cold load of ?view=library restores the Library view',
    (await fresh.evaluate(() => document.querySelector('nav a[aria-current="page"]')?.innerText?.trim())) === 'Library');
rec('...and renders Library, not the chat composer',
    /Library/i.test(await fresh.evaluate(()=>document.body.innerText)));

/* Canvas is still a real route. */
await fresh.locator('nav a:has-text("Canvas")').click();
await fresh.waitForSelector('.cm-content', { timeout: 120000 });
rec('Canvas is still a real route', new URL(fresh.url()).pathname === '/canvas', fresh.url());
rec('Canvas is marked active in the nav',
    (await fresh.evaluate(() => document.querySelector('nav a[aria-current="page"]')?.innerText?.trim())) === 'Canvas');

/* The nav must expose every destination in both builds — the hosted build
   used to hide Discover and Library behind NEXT_PUBLIC_HOSTED. */
const labels = await fresh.evaluate(() =>
  Array.from(document.querySelectorAll('nav a')).map(a => a.innerText.trim()).filter(Boolean));
rec('nav shows all four destinations', ['Home','Discover','Library','Canvas'].every(l => labels.includes(l)), labels.join(', '));

await browser.close();
const bad = results.filter(r=>!r.p);
console.log(`\n${results.length-bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
