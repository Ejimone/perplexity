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
/* Full end-to-end: launch the REAL packaged-shape app (electron .), let it
   boot its own server, and verify the canvas across an actual app restart.

   fs and path are already imported by the shared preamble above; only os is
   new here. Re-importing them threw a SyntaxError at parse time, which meant
   this script could not run at all. */
import os from 'node:os';

const USERDATA = path.join(os.homedir(), 'Library/Application Support/Curiocity');
const results = [];
const record = (n, p, d) => { results.push({ n, p }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

/* Seed the app's own data dir with the config that already exists in the repo
   checkout, so the first launch lands on a set-up app instead of the wizard. */
fs.mkdirSync(path.join(USERDATA, 'data'), { recursive: true });
const target = path.join(USERDATA, 'data', 'config.json');
if (!fs.existsSync(target)) {
  fs.copyFileSync(path.join(REPO, 'data', 'config.json'), target);
  console.log('[seed] copied config.json into userData');
}

const launch = async (label) => {
  console.log(`\n### ${label} ###`);
  const app = await _electron.launch({ args: ['.'], cwd: REPO, env, timeout: 120000 });
  app.process().stderr.on('data', (d) => {
    const s = d.toString();
    if (!/Debugger|DevTools|ws:\/\//.test(s)) process.stdout.write('[err] ' + s);
  });
  return app;
};

/* Wait for the shell to swap the splash for the real app URL. First launch
   provisions SearXNG — a ~150 MB download — so this is generous. */
const waitForApp = async (app, timeoutMs) => {
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < timeoutMs) {
    for (const w of app.windows()) {
      const u = w.url();
      if (u !== last) { last = u; console.log(`  [window] ${u.slice(0, 70)}`); }
      if (/^http:\/\/127\.0\.0\.1:\d+/.test(u)) return w;
    }
    await sleep(2000);
  }
  return null;
};

// ---------------------------------------------------------------- launch 1
let app = await launch('launch 1 — cold start (provisions SearXNG)');
let win = await waitForApp(app, 15 * 60 * 1000);
record('app boots and the window loads its own local server', Boolean(win), win?.url());

if (!win) {
  const log = path.join(USERDATA, 'logs', 'curiocity.log');
  if (fs.existsSync(log)) console.log('--- curiocity.log tail ---\n' + fs.readFileSync(log, 'utf8').split('\n').slice(-25).join('\n'));
  await app.close();
  process.exit(1);
}

const origin = new URL(win.url()).origin;
console.log('  server origin:', origin);

/* Let main.mjs's own loadURL settle first. Navigating with Playwright while
   it is still in flight aborts it (ERR_ABORTED -3), which drops the shell into
   its startup-failure path and pops a modal error dialog. */
await sleep(4000);
await win.waitForSelector('a[href="/canvas"]', { timeout: 120000 });
await win.click('a[href="/canvas"]');
await win.waitForSelector('.cm-content', { timeout: 180000 });
record('canvas opens from the sidebar inside the desktop app', true);

/* run JS in the real shell */
const setBuffer = async (page, text) => {
  await page.click('.cm-content');
  await page.keyboard.press('Meta+a');
  await page.evaluate((t) => {
    const el = document.querySelector('.cm-content');
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
};

/* Read the OUTPUT PANE, not document.body — the body includes the editor, and
   a buffer that mentions REACHED would make the assertion match its own
   source code rather than the program's output. */
const outputText = (page) =>
  page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('span')).find(
      (s) => s.textContent.trim() === 'Output',
    );
    return (label?.closest('div.flex.h-full') ?? document.body).innerText;
  });

/* Click Run and wait for the run to actually settle. The button toggles to
   Stop while running, so its return to "Run" is the completion signal —
   matching on output text is unreliable here because the editor buffer is
   part of the page too. */
const runAndSettle = async (page) => {
  await page.click('button:has-text("Run")');
  await page.waitForSelector('button:has-text("Stop")', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('button:has-text("Run")', { timeout: 180000 });
  await sleep(400);
};

const marker = `// survives-restart-${Date.now()}`;
await setBuffer(win, `${marker}\nconsole.log('running inside electron');`);
await sleep(2000);

await runAndSettle(win);
const out = await outputText(win);
record('JS executes inside the real Electron renderer', out.includes('running inside electron'), out.split('\n').slice(0, 4).join(' | '));

/* the sandbox must still be sealed in the packaged shell */
await setBuffer(win, `try { await fetch('${origin}/api/config'); console.log('REACHED'); } catch (e) { console.log('BLOCKED:', e.constructor.name); }`);
await runAndSettle(win);
const netOut = await outputText(win);
record('sandbox network block holds in the desktop app',
  netOut.includes('BLOCKED') && !netOut.includes('REACHED'),
  netOut.split('\n').slice(0, 4).join(' | '));

/* Prove the scoping above is real: the word REACHED IS in the editor, and the
   output pane still must not contain it. */
const editorHasReached = await win.evaluate(() =>
  document.querySelector('.cm-content').innerText.includes('REACHED'));
record('output-pane scoping excludes the editor buffer', editorHasReached && !netOut.includes('REACHED'));

/* restore the marker, wait for the debounced save */
await setBuffer(win, `${marker}\nconsole.log('running inside electron');`);
await sleep(2500);

const shellLog = path.join(USERDATA, 'logs', 'curiocity.log');
const recentLog = fs.existsSync(shellLog)
  ? fs.readFileSync(shellLog, 'utf8').split('\n').slice(-40).join('\n')
  : '';
record('shell reported no startup failure', !recentLog.includes('startup failed'));

const dbPath = path.join(USERDATA, 'data', 'db.sqlite');
record('app wrote its database to userData', fs.existsSync(dbPath), dbPath);

await app.close();
await sleep(3000);

// ---------------------------------------------------------------- launch 2
app = await launch('launch 2 — restart, buffer must survive');
win = await waitForApp(app, 5 * 60 * 1000);
record('app restarts cleanly', Boolean(win), win?.url());

if (win) {
  const origin2 = new URL(win.url()).origin;
  record('server came up on a DIFFERENT port (the localStorage-killer)', origin2 !== origin, `${origin} -> ${origin2}`);

  await sleep(4000);
  await win.waitForSelector('a[href="/canvas"]', { timeout: 120000 });
  await win.click('a[href="/canvas"]');
  await win.waitForSelector('.cm-content', { timeout: 180000 });
  await sleep(2000);

  const restored = await win.evaluate(() => document.querySelector('.cm-content').innerText);
  record('BUFFER SURVIVED A REAL APP RESTART', restored.includes(marker.replace('// ', '')), restored.slice(0, 60));
}

await app.close();
const failed = results.filter((r) => !r.p);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
