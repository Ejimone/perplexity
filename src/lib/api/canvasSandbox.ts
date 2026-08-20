import { buildSandboxHtml, sandboxCsp } from '@/lib/canvas/sandbox/html';
import { sandboxOrigin } from '@/lib/canvas/sandbox/origin';

/* Serves the execution sandbox document.
 *
 * It is generated per request rather than served from public/ for one reason:
 * the Content-Security-Policy has to be a real response header, and for Python
 * it has to be built at request time because it embeds this server's own
 * origin — which changes on every launch, since desktop/main.mjs picks a fresh
 * ephemeral port each time it starts the server. */

export const dynamic = 'force-dynamic';

/* Shared by the dedicated route and the catch-all, which reach the language
   segment by different means. */
export const serveSandbox = (req: Request, lang: string) => {
  if (lang !== 'js' && lang !== 'py') {
    return new Response('Unknown sandbox runtime', { status: 404 });
  }

  const appOrigin = sandboxOrigin(req);

  return new Response(buildSandboxHtml({ lang, appOrigin }), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': sandboxCsp({ lang, appOrigin }),
      /* The document is origin- and launch-specific; caching it would hand a
         stale CSP (with last launch's port) to the next run. */
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ lang: string }> },
) => serveSandbox(req, (await params).lang);
