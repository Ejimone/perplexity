/* host[:port] — a bare authority and nothing else. Rejects an injected
   scheme, path, comma-joined header value, or whitespace. */
const HOST_HEADER = /^[a-z0-9.\-]+(:\d{1,5})?$|^\[[0-9a-f:]+\](:\d{1,5})?$/i;

/* The origin the BROWSER used to reach us — which is not necessarily the one
 * in req.url.
 *
 * Next fills req.url from the server's own configured hostname. The desktop
 * shell loads the app at http://127.0.0.1:<port>, while Next reports
 * http://localhost:<port>. Those are different origins, and the difference is
 * load-bearing twice over:
 *
 *   - the sandbox document drops any postMessage whose event.origin does not
 *     equal the PARENT_ORIGIN baked into it, and
 *   - the Python CSP pins connect-src to <origin>/pyodide/.
 *
 * Get it wrong and every run hangs with no error at all — the run message is
 * delivered, silently rejected by the frame's sender check, and nothing ever
 * comes back. That is precisely how this behaved in the desktop app before
 * the Host header became the source of truth.
 *
 * The header is validated before use because it is attacker-controllable in
 * principle and its value lands inside a CSP directive.
 */
export const sandboxOrigin = (req: Request): string => {
  const url = new URL(req.url);
  const host = req.headers.get('host');

  return host && HOST_HEADER.test(host)
    ? `${url.protocol}//${host}`
    : url.origin;
};
