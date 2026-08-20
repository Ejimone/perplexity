import { describe, expect, it } from 'vitest';
import { sandboxOrigin } from './origin';

const request = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

/* Regression coverage for the bug that made the canvas look completely broken
 * inside the desktop app while working perfectly in a browser.
 *
 * desktop/main.mjs loads the app at http://127.0.0.1:<port>. Next reports
 * req.url as http://localhost:<port>. The sandbox document was built with the
 * latter as its PARENT_ORIGIN, so it rejected every postMessage the page sent
 * it — silently, because an origin check that fails just returns. Runs span
 * forever with no error, and Python additionally could not fetch its own wasm,
 * since the CSP pinned connect-src to the wrong origin.
 *
 * Browser testing missed it entirely: the tests happened to use localhost, so
 * the two agreed by luck. */

describe('sandboxOrigin', () => {
  it('prefers the Host header over req.url — the desktop-app case', () => {
    const req = request('http://localhost:62094/api/canvas/sandbox/js', {
      host: '127.0.0.1:62094',
    });
    expect(sandboxOrigin(req)).toBe('http://127.0.0.1:62094');
  });

  it('agrees with req.url when the browser used the same host', () => {
    const req = request('http://localhost:3000/api/canvas/sandbox/js', {
      host: 'localhost:3000',
    });
    expect(sandboxOrigin(req)).toBe('http://localhost:3000');
  });

  it('falls back to req.url when there is no Host header', () => {
    const req = request('http://127.0.0.1:5000/api/canvas/sandbox/py');
    expect(sandboxOrigin(req)).toBe('http://127.0.0.1:5000');
  });

  it('preserves the scheme from req.url', () => {
    const req = request('https://example.test/api/canvas/sandbox/js', {
      host: 'example.test',
    });
    expect(sandboxOrigin(req)).toBe('https://example.test');
  });

  it('supports a bracketed IPv6 host', () => {
    const req = request('http://localhost:8080/api/canvas/sandbox/js', {
      host: '[::1]:8080',
    });
    expect(sandboxOrigin(req)).toBe('http://[::1]:8080');
  });

  describe('rejects a malformed Host header rather than trusting it', () => {
    /* The value is interpolated into a CSP connect-src directive, so a header
       carrying a scheme, a path, or a second value must not survive. */
    const bad = [
      'evil.test/../../',
      'http://evil.test',
      'localhost:3000, evil.test',
      'localhost:3000 evil.test',
      "localhost:3000';connect-src *",
      '',
    ];

    for (const host of bad) {
      it(`ignores ${JSON.stringify(host)}`, () => {
        const req = request('http://localhost:3000/api/canvas/sandbox/py', {
          host,
        });
        expect(sandboxOrigin(req)).toBe('http://localhost:3000');
      });
    }
  });
});
