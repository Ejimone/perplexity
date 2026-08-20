/* Source of the Python execution worker (Pyodide).
 *
 * Same delivery story as the JS worker: a string, turned into a Blob module
 * worker inside an opaque-origin iframe.
 *
 * The interesting part is error mapping. Pyodide compiles with the filename
 * "<exec>" by default and its tracebacks include the harness frames, so a
 * NameError on the user's line 7 arrives looking like it happened somewhere in
 * Pyodide. The harness below compiles user code with the fixed filename
 * "<canvas>" and then keeps only the traceback frames belonging to that file —
 * so both the reported line number and the printed traceback describe the
 * user's buffer and nothing else.
 *
 * Contains no backticks and no ${ so it survives embedding in a template
 * literal.
 */

/* Python side, assembled line-by-line to keep the escaping honest. */
const HARNESS = [
  'import traceback',
  '',
  'def __canvas_exec(src):',
  '    ns = {"__name__": "__main__"}',
  '    try:',
  '        code = compile(src, "<canvas>", "exec")',
  '    except SyntaxError as e:',
  '        return {',
  '            "ok": False,',
  '            "name": type(e).__name__,',
  '            "message": e.msg or str(e),',
  '            "line": e.lineno,',
  '            "column": e.offset,',
  '            "traceback": "".join(traceback.format_exception_only(type(e), e)),',
  '        }',
  '    try:',
  '        exec(code, ns)',
  '    except SystemExit:',
  '        return {"ok": True}',
  '    except BaseException as e:',
  '        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "<canvas>"]',
  '        line = frames[-1].lineno if frames else None',
  '        text = "Traceback (most recent call last):\\n" if frames else ""',
  '        text += "".join(traceback.format_list(frames))',
  '        text += "".join(traceback.format_exception_only(type(e), e))',
  '        return {',
  '            "ok": False,',
  '            "name": type(e).__name__,',
  '            "message": str(e),',
  '            "line": line,',
  '            "column": None,',
  '            "traceback": text,',
  '        }',
  '    return {"ok": True}',
].join('\n');

export const buildPyWorkerSource = (pyodideBase: string) => `
const PYODIDE_BASE = ${JSON.stringify(pyodideBase)};

const send = (msg) => self.postMessage(msg);
const emit = (stream, text) => send({ type: 'chunk', stream: stream, text: text + '\\n' });

let pyodide = null;

/* Pyodide needs fetch to pull its wasm, stdlib zip and lockfile, so the
 * globals cannot be removed up front the way the JS worker removes them. The
 * hard boundary is therefore the CSP on the sandbox document, which pins
 * connect-src to the /pyodide/ path and nothing else — the app's own API
 * routes, and every other origin, are unreachable from here even while fetch
 * still exists.
 *
 * Once boot finishes, the globals go away anyway. That closes the "import js;
 * js.fetch(...)" path from Python, which is the only route user code has to
 * the network layer at all. */
function lockdown() {
  for (const name of [
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
    'indexedDB', 'caches', 'BroadcastChannel', 'SharedWorker', 'Worker',
  ]) {
    try {
      Object.defineProperty(self, name, {
        get() { throw new TypeError(name + ' is not available in the canvas sandbox'); },
        configurable: false,
      });
    } catch (e) { /* non-configurable already */ }
  }
  try { delete self.navigator.sendBeacon; } catch (e) {}
}

async function boot() {
  send({ type: 'boot', message: 'Loading Python runtime…' });

  const mod = await import(PYODIDE_BASE + 'pyodide.mjs');

  pyodide = await mod.loadPyodide({
    indexURL: PYODIDE_BASE,
    stdout: (text) => emit('stdout', text),
    stderr: (text) => emit('stderr', text),
  });

  pyodide.runPython(${JSON.stringify(HARNESS)});

  lockdown();
  send({ type: 'ready' });
}

const booted = boot().catch((err) => {
  send({
    type: 'done',
    status: 'error',
    error: {
      name: 'PyodideBootError',
      message: 'Python runtime failed to load: ' + (err && err.message ? err.message : String(err)),
      traceback: err && err.stack ? err.stack : undefined,
    },
    durationMs: 0,
  });
  throw err;
});

self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || data.type !== 'run') return;

  const started = Date.now();
  try {
    await booted;

    const runner = pyodide.globals.get('__canvas_exec');
    let proxy;
    try {
      proxy = runner(data.code);
      const result = proxy.toJs({ dict_converter: Object.fromEntries });

      if (result.ok) {
        send({ type: 'done', status: 'ok', durationMs: Date.now() - started });
      } else {
        send({
          type: 'done',
          status: 'error',
          error: {
            name: result.name,
            message: result.message,
            line: result.line == null ? undefined : Number(result.line),
            column: result.column == null ? undefined : Number(result.column),
            traceback: result.traceback,
          },
          durationMs: Date.now() - started,
        });
      }
    } finally {
      if (proxy && proxy.destroy) { try { proxy.destroy(); } catch (e) {} }
      if (runner && runner.destroy) { try { runner.destroy(); } catch (e) {} }
    }
  } catch (err) {
    send({
      type: 'done',
      status: 'error',
      error: {
        name: 'Error',
        message: err && err.message ? err.message : String(err),
        traceback: err && err.stack ? err.stack : undefined,
      },
      durationMs: Date.now() - started,
    });
  }
});
`;
