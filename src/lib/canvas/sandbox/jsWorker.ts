/* Source of the JavaScript execution worker.
 *
 * Shipped as a string because it is turned into a Blob inside the sandbox
 * iframe: the iframe runs on an opaque origin (sandbox="allow-scripts" with no
 * allow-same-origin), and an opaque origin may only construct workers from
 * blob: URLs — a same-origin script URL is not reachable from it.
 *
 * User code is imported as a module blob rather than run through new Function.
 * Two reasons, both load-bearing:
 *   1. new Function needs 'unsafe-eval' in the CSP. A module blob needs only
 *      script-src blob:, so the policy stays tight.
 *   2. The module gets its own script URL, so stack frames carry real line and
 *      column numbers with NO wrapper offset to subtract. What the user sees in
 *      the output pane is the line they actually wrote.
 *
 * Deliberately contains no backticks so it survives being embedded in a
 * template literal.
 */
export const JS_WORKER_SOURCE = `
/* --- network and storage lockdown -------------------------------------- *
 * The CSP on the sandbox document already sets connect-src 'none', which is
 * the real, browser-enforced guarantee. Deleting the globals on top of it is
 * defence in depth: it turns a silently-blocked request into an immediate,
 * legible TypeError instead of a confusing CSP violation. */
for (const name of [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts',
  'indexedDB', 'caches', 'Notification', 'BroadcastChannel', 'SharedWorker',
  'Worker', 'openDatabase', 'PushManager', 'RTCPeerConnection',
]) {
  try { delete self[name]; } catch (e) { /* non-configurable; shadowed below */ }
  try {
    Object.defineProperty(self, name, {
      get() { throw new TypeError(name + ' is not available in the canvas sandbox'); },
      configurable: false,
    });
  } catch (e) { /* already gone */ }
}
try { delete self.navigator.sendBeacon; } catch (e) {}

/* --- console capture ---------------------------------------------------- */
const seen = new WeakSet();

function format(value, depth) {
  depth = depth || 0;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const kind = typeof value;
  if (kind === 'string') return depth === 0 ? value : JSON.stringify(value);
  if (kind === 'number' || kind === 'boolean' || kind === 'bigint') return String(value);
  if (kind === 'symbol') return value.toString();
  if (kind === 'function') return '[Function: ' + (value.name || 'anonymous') + ']';

  if (value instanceof Error) return value.stack || (value.name + ': ' + value.message);
  if (value instanceof Map) {
    return 'Map(' + value.size + ') {' +
      Array.from(value.entries()).map((e) => format(e[0], depth + 1) + ' => ' + format(e[1], depth + 1)).join(', ') + '}';
  }
  if (value instanceof Set) {
    return 'Set(' + value.size + ') {' +
      Array.from(value.values()).map((v) => format(v, depth + 1)).join(', ') + '}';
  }

  if (depth > 4) return Array.isArray(value) ? '[Array]' : '[Object]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return '[' + value.map((v) => format(v, depth + 1)).join(', ') + ']';
    }
    const entries = Object.keys(value).map((k) => k + ': ' + format(value[k], depth + 1));
    const name = value.constructor && value.constructor.name !== 'Object' ? value.constructor.name + ' ' : '';
    return name + '{' + entries.join(', ') + '}';
  } catch (e) {
    return String(value);
  } finally {
    seen.delete(value);
  }
}

function emit(stream, args) {
  self.postMessage({
    type: 'chunk',
    stream: stream,
    text: Array.prototype.map.call(args, (a) => format(a, 0)).join(' ') + '\\n',
  });
}

self.console = {
  log: function () { emit('stdout', arguments); },
  info: function () { emit('stdout', arguments); },
  debug: function () { emit('stdout', arguments); },
  dir: function () { emit('stdout', arguments); },
  table: function () { emit('stdout', arguments); },
  warn: function () { emit('stderr', arguments); },
  error: function () { emit('stderr', arguments); },
  trace: function () { emit('stderr', arguments); },
  assert: function (cond) { if (!cond) emit('stderr', ['Assertion failed']); },
  group: function () { emit('stdout', arguments); },
  groupEnd: function () {},
  time: function () {},
  timeEnd: function () {},
  count: function () {},
};

/* --- error position extraction ------------------------------------------ *
 * The user module is the only script with this blob URL, so the first frame
 * mentioning it is the deepest point inside their own code. Frames belonging
 * to this harness are ignored. No offset arithmetic: the module body IS the
 * buffer, byte for byte. */
function positionFrom(stack, moduleUrl) {
  if (!stack || !moduleUrl) return {};
  const lines = String(stack).split('\\n');
  for (const line of lines) {
    if (line.indexOf(moduleUrl) === -1) continue;
    const m = line.match(/:(\\d+):(\\d+)\\)?\\s*$/);
    if (m) return { line: Number(m[1]), column: Number(m[2]) };
  }
  return {};
}

function describe(err, moduleUrl) {
  if (err && err instanceof Error) {
    return Object.assign(
      { name: err.name || 'Error', message: err.message || String(err), traceback: err.stack },
      positionFrom(err.stack, moduleUrl),
    );
  }
  return { name: 'Error', message: format(err, 0) };
}

/* --- run loop ----------------------------------------------------------- */
let pendingRejection = null;
self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  pendingRejection = event.reason;
});

self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || data.type !== 'run') return;

  const started = Date.now();
  let moduleUrl = null;

  try {
    moduleUrl = URL.createObjectURL(new Blob([data.code], { type: 'text/javascript' }));
    await import(moduleUrl);

    /* Give a rejected promise queued during the module body one turn to land,
       so it is reported as an error instead of vanishing. */
    await new Promise((resolve) => setTimeout(resolve, 0));

    if (pendingRejection !== null) {
      const reason = pendingRejection;
      pendingRejection = null;
      self.postMessage({
        type: 'done', status: 'error',
        error: describe(reason, moduleUrl),
        durationMs: Date.now() - started,
      });
      return;
    }

    self.postMessage({ type: 'done', status: 'ok', durationMs: Date.now() - started });
  } catch (err) {
    self.postMessage({
      type: 'done', status: 'error',
      error: describe(err, moduleUrl),
      durationMs: Date.now() - started,
    });
  } finally {
    if (moduleUrl) { try { URL.revokeObjectURL(moduleUrl); } catch (e) {} }
  }
});

self.postMessage({ type: 'ready' });
`;
