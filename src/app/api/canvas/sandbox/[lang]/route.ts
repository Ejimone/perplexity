import { buildSandboxHtml, sandboxCsp } from '@/lib/canvas/sandbox/html';
import { sandboxOrigin } from '@/lib/canvas/sandbox/origin';

/* Serves the execution sandbox document.
 *
 * It is a route handler rather than a file in public/ for one reason: the
 * Content-Security-Policy has to be a real response header, and for Python it
 * has to be built at request time because it embeds this server's own origin —
 * which changes on every launch, since desktop/main.mjs picks a fresh
 * ephemeral port each time it starts the server. */

export const dynamic = 'force-dynamic';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ lang: string }> },
) => {
  const { lang } = await params;

  if (lang !== 'js' && lang !== 'py') {
    return new Response('Unknown sandbox runtime', { status: 404 });
  }

  const appOrigin = sandboxOrigin(req);
  const html = buildSandboxHtml({ lang, appOrigin });

  return new Response(html, {
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
