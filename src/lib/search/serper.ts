import type { SearxngSearchOptions, SearxngSearchResult } from '@/lib/searxng';

/* Serper.dev search backend.
 *
 * Curiocity is built around SearXNG, which is the right engine for the
 * desktop app: it runs on the user's own machine, so searches never leave it.
 * That is impossible on a hosted deployment — a serverless function cannot
 * reach a metasearch engine running on someone's laptop, and no public SearXNG
 * exposes the JSON API this app needs.
 *
 * Serper fills that gap with a plain API key. It is only consulted when one is
 * configured, so the desktop build keeps using local SearXNG and keeps its
 * privacy guarantee intact.
 *
 * The return shape deliberately matches searchSearxng's so that every caller —
 * the researcher, the media agents, discover — stays unchanged.
 */

const ENDPOINTS = {
  search: 'https://google.serper.dev/search',
  images: 'https://google.serper.dev/images',
  videos: 'https://google.serper.dev/videos',
  news: 'https://google.serper.dev/news',
} as const;

type Endpoint = keyof typeof ENDPOINTS;

/* SearXNG expresses "what kind of results" as categories; Serper as separate
   endpoints. */
const endpointFor = (opts?: SearxngSearchOptions): Endpoint => {
  const categories = opts?.categories ?? [];
  if (categories.includes('images')) return 'images';
  if (categories.includes('videos')) return 'videos';
  if (categories.includes('news')) return 'news';
  return 'search';
};

/* A YouTube watch URL is the one case where an embeddable player URL can be
   derived reliably. The video agent drops any result without one, so guessing
   more broadly would surface players that never load. */
const embedURL = (url: string): string | undefined => {
  const match = url?.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : undefined;
};

/* Typed explicitly rather than inferred: callers destructure the results of
   searchSearxng, and if this returned a structurally different shape the union
   of the two backends would degrade to `any` at every call site. */
type SearchResponse = {
  results: SearxngSearchResult[];
  suggestions: string[];
};

export const searchSerper = async (
  apiKey: string,
  query: string,
  opts?: SearxngSearchOptions,
): Promise<SearchResponse> => {
  const endpoint = endpointFor(opts);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(ENDPOINTS[endpoint], {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        ...(opts?.language ? { hl: opts.language } : {}),
        ...(opts?.pageno && opts.pageno > 1 ? { page: opts.pageno } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Serper error ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }

    const data = await res.json();

    if (endpoint === 'images') {
      return {
        results: (data.images ?? []).map((r: any) => ({
          title: r.title,
          url: r.link,
          img_src: r.imageUrl,
          thumbnail_src: r.thumbnailUrl ?? r.imageUrl,
          thumbnail: r.thumbnailUrl ?? r.imageUrl,
        })),
        suggestions: [] as string[],
      };
    }

    if (endpoint === 'videos') {
      return {
        results: (data.videos ?? [])
          .map((r: any) => ({
            title: r.title,
            url: r.link,
            thumbnail: r.imageUrl,
            img_src: r.imageUrl,
            iframe_src: embedURL(r.link),
          }))
          .filter((r: any) => r.iframe_src),
        suggestions: [] as string[],
      };
    }

    const rows = endpoint === 'news' ? (data.news ?? []) : (data.organic ?? []);

    return {
      results: rows.map((r: any) => ({
        title: r.title,
        url: r.link,
        content: r.snippet ?? '',
      })),
      suggestions: (data.relatedSearches ?? [])
        .map((s: any) => s.query)
        .filter(Boolean) as string[],
    };
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Serper search timed out');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};
