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
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--headless=new'],
});
const page = await browser.newPage();

const cspViolations = [];
page.on('console', (m) => {
  const t = m.text();
  if (/Content Security Policy/i.test(t)) cspViolations.push(t);
});
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(`${BASE}/canvas`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.cm-content', { timeout: 120000 });
record('canvas route renders CodeMirror', true);

const setBuffer = async (code) => {
  await page.click('.cm-content');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
  await page.evaluate((text) => {
    const el = document.querySelector('.cm-content');
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, code);
};

const selectLanguage = async (value) => {
  await page.selectOption('select', value);
  await page.waitForTimeout(300);
};

const setTimeoutMs = async (ms) => {
  const selects = page.locator('select');
  await selects.nth(1).selectOption(String(ms));
};

const run = async (timeoutMs = 90000) => {
  await page.click('button:has-text("Run")');
  await page.waitForFunction(
    () => {
      const el = document.body.innerText;
      return /Finished|Timed out|Error·|Error\s/.test(el) &&
        !document.querySelector('button:has-text("Stop")');
    },
    null,
    { timeout: timeoutMs },
  ).catch(() => {});
  // settle
  await page.waitForSelector('button:has-text("Run")', { timeout: timeoutMs });
  await page.waitForTimeout(400);
};

const outputText = () =>
  page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll('span'));
    const h = heads.find((s) => s.textContent.trim() === 'Output');
    let node = h;
    while (node && !node.parentElement?.parentElement?.querySelector('pre')) node = node.parentElement;
    const pane = h.closest('div.flex.h-full') ?? document.body;
    return pane.innerText;
  });

/* ---- 1. JavaScript happy path ---- */
await setBuffer('console.log("sum:", 1 + 1);\nconsole.log([1,2,3].map(n => n * 2));');
await run();
let out = await outputText();
record('JS runs and captures console.log', out.includes('sum: 2') && out.includes('[2, 4, 6]'), out.split('\n').slice(0,6).join(' | '));

/* ---- 2. Network is blocked ---- */
await setBuffer(`try {\n  const r = await fetch("${BASE}/api/config");\n  console.log("REACHED", r.status);\n} catch (e) {\n  console.log("BLOCKED:", e.constructor.name);\n}`);
await run();
out = await outputText();
record('JS cannot reach the app API (fetch blocked)', out.includes('BLOCKED') && !out.includes('REACHED'), out.split('\n').slice(0,6).join(' | '));

/* ---- 3. Node / main process unreachable ---- */
await setBuffer('console.log("require:", typeof require, "process:", typeof process, "window:", typeof window);');
await run();
out = await outputText();
record('no Node or DOM globals in the worker', out.includes('require: undefined') && out.includes('process: undefined') && out.includes('window: undefined'), out.split('\n').slice(0,4).join(' | '));

/* ---- 4. Error line mapping (error on line 7) ---- */
await setBuffer('const a = 1;\nconst b = 2;\n\nfunction go() {\n  return a + b;\n}\n\nnope();\n');
await run();
out = await outputText();
const jsLine = /line (\d+)/.exec(out);
record('JS error maps to the right line (expect 8)', jsLine?.[1] === '8', `got line ${jsLine?.[1]} :: ` + out.split('\n').slice(0,6).join(' | '));

/* ---- 5. Hard timeout ---- */
await setTimeoutMs(2000);
await setBuffer('while (true) {}');
const t0 = Date.now();
await run(40000);
const elapsed = Date.now() - t0;
out = await outputText();
record('infinite loop is terminated by the timeout', out.includes('Timed out') && elapsed < 20000, `${elapsed}ms :: ` + out.split('\n').slice(0,4).join(' | '));

/* page still responsive? */
record('UI still responsive after a timeout', await page.locator('button:has-text("Run")').isEnabled());

/* ---- 6. Python happy path ---- */
await setTimeoutMs(30000);
await selectLanguage('python');
await setBuffer('print("sum:", sum(range(10)))\nimport sys\nprint("py", sys.version_info.major, sys.version_info.minor)');
await run(180000);
out = await outputText();
record('Python runs under Pyodide', out.includes('sum: 45') && out.includes('py 3'), out.split('\n').slice(0,6).join(' | '));

/* ---- 7. Python error line mapping ---- */
await setBuffer('a = 1\nb = 2\n\ndef go():\n    return a + b\n\nprint(go())\nraise ValueError("boom")\n');
await run(120000);
out = await outputText();
const pyLine = /line (\d+)/.exec(out);
record('Python error maps to the right line (expect 8)', pyLine?.[1] === '8', `got line ${pyLine?.[1]} :: ` + out.split('\n').slice(0,8).join(' | '));

/* ---- 8. Python network blocked ---- */
await setBuffer(`import urllib.request\ntry:\n    urllib.request.urlopen("${BASE}/api/config")\n    print("REACHED")\nexcept Exception as e:\n    print("BLOCKED:", type(e).__name__)`);
await run(120000);
out = await outputText();
record('Python cannot reach the network', !out.includes('REACHED'), out.split('\n').slice(0,6).join(' | '));

console.log('\nCSP violations observed (expected for blocked attempts):', cspViolations.length);
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
