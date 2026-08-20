import { describe, expect, it } from 'vitest';
import { buildSandboxHtml, sandboxCsp } from './html';

/* The Content-Security-Policy on the sandbox document is the actual security
 * boundary of the coding canvas — not the deleted globals in the workers,
 * which only exist to turn a silent block into a legible TypeError.
 *
 * That makes this the highest-consequence code in the feature: a loosened
 * directive here would let executed code reach /api/config, which holds the
 * user's model API keys in plaintext. These tests pin the exact guarantees.
 */

const ORIGIN = 'http://127.0.0.1:41234';

const directive = (csp: string, name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));

describe('sandboxCsp', () => {
  describe('javascript', () => {
    const csp = sandboxCsp({ lang: 'js', appOrigin: ORIGIN });

    it('denies everything by default', () => {
      expect(directive(csp, 'default-src')).toBe("default-src 'none'");
    });

    it('blocks the network outright — there is nothing JS needs to fetch', () => {
      expect(directive(csp, 'connect-src')).toBe("connect-src 'none'");
    });

    it('never grants eval', () => {
      /* User code is imported as a blob module, precisely so that new Function
         and eval stay unavailable. A verified probe in the browser confirms
         new Function throws EvalError under this policy. */
      expect(csp).not.toContain('unsafe-eval');
    });

    it('allows blob: so the worker and the user module can load', () => {
      expect(directive(csp, 'script-src')).toContain('blob:');
      expect(directive(csp, 'worker-src')).toBe('worker-src blob:');
    });

    it('does not name the app origin anywhere', () => {
      expect(csp).not.toContain(ORIGIN);
    });
  });

  describe('python', () => {
    const csp = sandboxCsp({ lang: 'py', appOrigin: ORIGIN });

    it('pins the network to the pyodide asset path and nothing else', () => {
      expect(directive(csp, 'connect-src')).toBe(
        `connect-src ${ORIGIN}/pyodide/`,
      );
    });

    it('cannot reach the app API, which holds the API keys', () => {
      const connect = directive(csp, 'connect-src')!;
      expect(connect).not.toContain("'self'");
      expect(connect.endsWith('/pyodide/')).toBe(true);
      /* A path-prefixed source matches /pyodide/* only; /api/config shares the
         origin but not the prefix, so it stays unreachable. */
      expect(connect).not.toMatch(new RegExp(`${ORIGIN}(;|\\s|$)`));
    });

    it('grants wasm compilation but not general eval', () => {
      expect(directive(csp, 'script-src')).toContain("'wasm-unsafe-eval'");
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it('still denies everything by default', () => {
      expect(directive(csp, 'default-src')).toBe("default-src 'none'");
    });
  });

  it('never allows framing, forms, or a rewritten base URL', () => {
    for (const lang of ['js', 'py'] as const) {
      const csp = sandboxCsp({ lang, appOrigin: ORIGIN });
      expect(directive(csp, 'base-uri')).toBe("base-uri 'none'");
      expect(directive(csp, 'form-action')).toBe("form-action 'none'");
    }
  });
});

describe('buildSandboxHtml', () => {
  it('addresses the parent by its exact origin rather than *', () => {
    const html = buildSandboxHtml({ lang: 'js', appOrigin: ORIGIN });
    expect(html).toContain(JSON.stringify(ORIGIN));
    expect(html).toContain('parent.postMessage(message, PARENT_ORIGIN)');
  });

  it('authenticates inbound messages by window identity and origin', () => {
    /* The frame is opaque-origin, so the parent must post with '*'. The frame
       therefore has to check the sender, or any page could drive it. */
    const html = buildSandboxHtml({ lang: 'js', appOrigin: ORIGIN });
    expect(html).toContain(
      'event.source !== parent || event.origin !== PARENT_ORIGIN',
    );
  });

  it('creates a classic worker, not a module worker', () => {
    /* Chromium refuses to load blob:null/<uuid> as a module worker script in
       an opaque origin — the worker constructs and then dies with an empty
       error event. Regressing this silently breaks all execution. */
    const html = buildSandboxHtml({ lang: 'js', appOrigin: ORIGIN });
    expect(html).toContain('new Worker(url)');
    /* Matched against the constructor call specifically — the surrounding
       comment explains why module workers fail, and mentions the option. */
    expect(html).not.toMatch(/new Worker\([^)]*\{/);
  });

  it('points the python worker at the pyodide directory on this origin', () => {
    const html = buildSandboxHtml({ lang: 'py', appOrigin: ORIGIN });
    expect(html).toContain(`${ORIGIN}/pyodide/`);
  });

  it('neutralises a </script> sequence hidden in the worker source', () => {
    const html = buildSandboxHtml({ lang: 'js', appOrigin: ORIGIN });
    const body = html.slice(
      html.indexOf('<script>') + 8,
      html.lastIndexOf('</script>'),
    );
    expect(body).not.toContain('</script');
  });

  it('always terminates the worker on timeout rather than asking it to stop', () => {
    /* terminate() is the only thing that stops a while(true){}. */
    const html = buildSandboxHtml({ lang: 'js', appOrigin: ORIGIN });
    expect(html).toContain('worker.terminate()');
  });
});
