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

const browser = await chromium.launch({ executablePath: EXE, args: ['--headless=new'] });
const page = await browser.newPage();
await page.goto(`${BASE}/canvas`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.cm-content', { timeout: 120000 });
await page.waitForTimeout(1200);

/* Probe from the sandbox DOCUMENT, which has none of the worker's global
   shims. Anything blocked here is blocked by the CSP alone. */
/* Collected so the script can fail rather than merely narrate. This is a
   security boundary: executed code must not be able to reach the app's API
   (which holds model API keys), the network, the parent document, or storage.
   A refactor that weakens it is a regression, and a report nobody reads would
   not catch that. */
const breaches = [];

for (const which of ['js', 'py']) {
  const frame = page.frames().find((f) => f.url().includes('/sandbox/' + which));
  if (!frame) {
    breaches.push(`${which}: sandbox iframe not found — could not verify isolation`);
    continue;
  }
  const r = await frame.evaluate(async () => {
    const attempt = async (label, fn) => {
      try { return label + ': REACHED ' + (await fn()); }
      catch (e) { return label + ': blocked (' + e.name + ')'; }
    };
    return {
      apiConfig: await attempt('fetch /api/config', async () => (await fetch('/api/config')).status),
      external: await attempt('fetch example.com', async () => (await fetch('https://example.com')).status),
      pyodide: await attempt('fetch /pyodide/VERSION', async () => (await fetch('/pyodide/VERSION')).status),
      parentDom: (() => { try { return 'parent.document: REACHED ' + typeof parent.document.title; } catch (e) { return 'parent.document: blocked (' + e.name + ')'; } })(),
      storage: (() => { try { localStorage.setItem('x','1'); return 'localStorage: REACHED'; } catch (e) { return 'localStorage: blocked (' + e.name + ')'; } })(),
      cookies: (() => { try { return 'cookie: ' + JSON.stringify(document.cookie); } catch (e) { return 'cookie: blocked (' + e.name + ')'; } })(),
    };
  });
  console.log(`\n--- ${which} sandbox document ---`);
  for (const [k, v] of Object.entries(r)) {
    console.log(' ', v);
    /* /pyodide/ is deliberately fetchable — Pyodide loads its wasm and stdlib
       cross-origin, which is why next.config.mjs puts CORS on that path only.
       Everything else reaching anything is a breach. */
    if (k !== 'pyodide' && /REACHED/.test(String(v))) {
      breaches.push(`${which}: ${v}`);
    }
    /* An opaque origin has no cookies; a non-empty jar means the frame is
       same-origin with the app. */
    if (k === 'cookies' && !/: ""$|blocked/.test(String(v))) {
      breaches.push(`${which}: ${v}`);
    }
  }
}

await browser.close();

if (breaches.length) {
  console.log('\nSANDBOX ISOLATION BROKEN:');
  for (const b of breaches) console.log('  -', b);
  process.exit(1);
}
console.log('\nsandbox isolation holds — nothing escaped except /pyodide/ assets');
process.exit(0);
