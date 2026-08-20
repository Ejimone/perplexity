import { JS_WORKER_SOURCE } from './jsWorker';
import { buildPyWorkerSource } from './pyWorker';

/* The sandbox document.
 *
 * This is what the canvas embeds as <iframe sandbox="allow-scripts">. Without
 * allow-same-origin the frame gets an opaque origin: it cannot read the
 * parent's DOM, cookies or storage, and — because its origin is not the app's
 * — it cannot make same-origin requests to the app's own API routes either.
 * That second point is the one that matters, since config.json holds the
 * user's model API keys.
 *
 * User code never runs in this document. It runs in a worker this document
 * spawns, which has no DOM at all. This file is only the supervisor: it owns
 * the worker lifecycle and, critically, the hard timeout — terminate() is the
 * only thing that stops a "while (true) {}", and it has to be called from
 * outside the worker being stopped.
 */

const escapeForScript = (source: string) =>
  /* A literal </script> inside a string would close the tag early. */
  source.replace(/<\/script/gi, '<\\/script');

export const buildSandboxHtml = ({
  lang,
  appOrigin,
}: {
  lang: 'js' | 'py';
  appOrigin: string;
}) => {
  const workerSource =
    lang === 'js'
      ? JS_WORKER_SOURCE
      : buildPyWorkerSource(`${appOrigin}/pyodide/`);

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>canvas sandbox</title></head>
<body>
<script>
(function () {
  'use strict';

  var PARENT_ORIGIN = ${JSON.stringify(appOrigin)};
  var WORKER_SOURCE = ${JSON.stringify(escapeForScript(workerSource))};

  var worker = null;
  var timer = null;
  var running = false;
  var workerReady = false;
  var pending = null;

  function toParent(message) {
    parent.postMessage(message, PARENT_ORIGIN);
  }

  function disposeWorker() {
    if (timer) { clearTimeout(timer); timer = null; }
    workerReady = false;
    if (worker) {
      try { worker.terminate(); } catch (e) {}
      worker = null;
    }
  }

  function spawn() {
    var url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    /* Classic, not { type: 'module' }. In an opaque origin a blob: URL is
       blob:null/<uuid>, and Chromium refuses to load that as a module worker
       script — the worker constructs and then dies with an empty error event.
       A classic worker loads fine, and dynamic import() still works from
       inside it, which is all the harness actually needs. */
    var w = new Worker(url);
    URL.revokeObjectURL(url);

    w.onmessage = function (event) {
      var data = event.data;
      if (!data) return;

      /* Python spends a second or more importing Pyodide before it can run
         anything. Starting the execution timer at postMessage time would
         charge that boot to the user's timeout, so a 5s budget could expire
         before their first line ever ran. The clock starts at 'ready'. */
      if (data.type === 'ready') {
        workerReady = true;
        if (running && !timer && pending) startTimer(pending);
        return;
      }

      if (data.type === 'done') {
        running = false;
        if (timer) { clearTimeout(timer); timer = null; }
      }
      toParent(data);
    };

    /* A worker-level error means the harness itself broke — a failed Pyodide
       import, a syntax error in the worker source. Report it rather than
       leaving the Run button spinning forever. */
    w.onerror = function (event) {
      if (!running) return;
      running = false;
      if (timer) { clearTimeout(timer); timer = null; }
      toParent({
        type: 'done',
        status: 'error',
        error: {
          name: 'SandboxError',
          message: event.message || 'The sandbox worker failed to start.',
        },
        durationMs: 0,
      });
    };

    return w;
  }

  function run(payload) {
    if (running) return;
    running = true;
    pending = payload;

    /* Python keeps a warm interpreter between runs; JavaScript gets a fresh
       worker each time so one run cannot leave globals or timers behind for
       the next. */
    if (!worker || payload.lang === 'js') {
      disposeWorker();
      workerReady = false;
      worker = spawn();
    }

    if (workerReady) startTimer(payload);
    worker.postMessage({ type: 'run', code: payload.code });
  }

  function startTimer(payload) {
    var started = Date.now();
    timer = setTimeout(function () {
      if (!running) return;
      running = false;
      /* The interpreter dies with the worker; the next run pays a cold start.
         There is no cooperative interrupt available without SharedArrayBuffer,
         which would need COOP/COEP headers across the whole app. */
      disposeWorker();
      toParent({
        type: 'done',
        status: 'timeout',
        error: {
          name: 'TimeoutError',
          message: 'Execution exceeded ' + payload.timeoutMs + ' ms and was stopped.',
        },
        durationMs: Date.now() - started,
      });
    }, payload.timeoutMs);
  }

  window.addEventListener('message', function (event) {
    /* The frame is opaque-origin, so the parent must address it with '*'. The
       check therefore runs the other way: the message has to have come from
       our actual parent window, at the origin we were built for. */
    if (event.source !== parent || event.origin !== PARENT_ORIGIN) return;

    var data = event.data;
    if (!data) return;

    if (data.type === 'run') run(data);
    else if (data.type === 'cancel') {
      if (!running) return;
      running = false;
      disposeWorker();
      toParent({
        type: 'done',
        status: 'timeout',
        error: { name: 'Cancelled', message: 'Execution stopped.' },
        durationMs: 0,
      });
    }
  });

  toParent({ type: 'ready' });
})();
</script>
</body>
</html>`;
};

/* Content-Security-Policy for the sandbox document.
 *
 * This is the real network boundary — not the deleted globals in the workers,
 * which are only there to make failures legible. */
export const sandboxCsp = ({
  lang,
  appOrigin,
}: {
  lang: 'js' | 'py';
  appOrigin: string;
}) => {
  const shared = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    'worker-src blob:',
    'child-src blob:',
    "base-uri 'none'",
    "form-action 'none'",
  ];

  if (lang === 'js') {
    return [
      ...shared,
      /* blob: covers both the worker and the user's module. No 'unsafe-eval':
         nothing here goes through eval or new Function. */
      "script-src 'unsafe-inline' blob:",
      /* No network. At all. */
      "connect-src 'none'",
    ].join('; ');
  }

  /* Pyodide has to load ~13 MB of runtime, so Python cannot have connect-src
     'none'. Instead the policy pins it to exactly the asset directory: a
     path-prefixed source matches /pyodide/* and nothing else, so /api/config
     and every other route stay unreachable. 'wasm-unsafe-eval' is required to
     compile the Pyodide wasm module and grants nothing beyond that. */
  const assets = `${appOrigin}/pyodide/`;
  return [
    ...shared,
    `script-src 'unsafe-inline' 'wasm-unsafe-eval' blob: ${assets}`,
    `connect-src ${assets}`,
  ].join('; ');
};
