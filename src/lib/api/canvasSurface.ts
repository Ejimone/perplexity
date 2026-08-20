import configManager from '@/lib/config';

/* Which surfaces the coding canvas is reachable from.
 *
 * A dedicated route rather than a read of GET /api/config, because that
 * endpoint enumerates every configured model provider — which means live
 * network calls to list models — and the renderer needs this value on every
 * page load just to decide whether to render a launcher button. */

export const dynamic = 'force-dynamic';

export type CanvasSurfaceSetting = 'route' | 'panel' | 'bar' | 'all';

export const GET = async () => {
  const surface = configManager.getConfig(
    'preferences.canvasSurface',
    'route',
  ) as CanvasSurfaceSetting;

  return Response.json({
    surface,
    panel: surface === 'panel' || surface === 'all',
    bar: surface === 'bar' || surface === 'all',
  });
};
