import type { NextRequest } from 'next/server';

/* One route handler serving every API endpoint.
 *
 * Vercel bills TWO serverless functions per route — the route itself plus its
 * RSC payload — and the free plan allows twelve in total. Twenty-odd API
 * routes therefore cannot be deployed there, even though the code is small.
 * Collapsing them behind a single catch-all turns all of them into one route,
 * which leaves room for the pages.
 *
 * In the desktop build this file is inert: Next matches the specific routes
 * (src/app/api/chat/route.ts and friends) ahead of a catch-all, so those keep
 * serving exactly as before. Both paths call the same implementation in
 * src/lib/api, so there is one behaviour, not two.
 *
 * Handlers are imported lazily, per request, and that is load-bearing rather
 * than an optimisation. Importing them all up front means one endpoint's
 * dependency tree can break every other endpoint: the chat handler pulls in
 * jsdom, which fails to load at all in this environment, and a static import
 * turned that into a 500 on /api/canvas/sandbox — a route that has nothing to
 * do with it. Loading on demand keeps each endpoint's failures its own.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

const LOADERS: Record<string, () => Promise<Record<string, unknown>>> = {
  chat: () => import('@/lib/api/chat'),
  config: () => import('@/lib/api/config'),
  providers: () => import('@/lib/api/providers'),
  'canvas/assist': () => import('@/lib/api/canvasAssist'),
  'canvas/buffers': () => import('@/lib/api/canvasBuffers'),
  'canvas/surface': () => import('@/lib/api/canvasSurface'),
};

const dispatch = async (
  method: Method,
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) => {
  const segments = (await ctx.params).path ?? [];

  try {
    /* The only endpoint carrying a dynamic segment of its own. */
    if (
      method === 'GET' &&
      segments.length === 3 &&
      segments[0] === 'canvas' &&
      segments[1] === 'sandbox'
    ) {
      const { serveSandbox } = await import('@/lib/api/canvasSandbox');
      return serveSandbox(req, segments[2]);
    }

    const load = LOADERS[segments.join('/')];
    if (!load) {
      return Response.json({ message: 'Not found' }, { status: 404 });
    }

    const mod = await load();
    const handler = mod[method] as
      | ((req: NextRequest) => Response | Promise<Response>)
      | undefined;

    if (typeof handler !== 'function') {
      return Response.json({ message: 'Method not allowed' }, { status: 405 });
    }

    return handler(req);
  } catch (err: any) {
    /* A handler whose module fails to load would otherwise surface as Next's
       generic 500 page, with the real cause only visible in platform logs. */
    console.error(`canvas api: /${segments.join('/')} failed:`, err);
    return Response.json(
      { message: err?.message ?? 'Request failed' },
      { status: 500 },
    );
  }
};

type Ctx = { params: Promise<{ path?: string[] }> };

export const GET = (req: NextRequest, ctx: Ctx) => dispatch('GET', req, ctx);
export const POST = (req: NextRequest, ctx: Ctx) => dispatch('POST', req, ctx);
export const PUT = (req: NextRequest, ctx: Ctx) => dispatch('PUT', req, ctx);
export const DELETE = (req: NextRequest, ctx: Ctx) => dispatch('DELETE', req, ctx);
