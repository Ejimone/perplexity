import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchSerper } from './serper';

/* Serper returns a different shape per endpoint, and every caller in this app
 * expects SearXNG's shape. These tests pin that translation — a mismatch here
 * would not throw, it would silently produce answers with no sources, or a
 * media rail full of broken thumbnails. */

const mockFetch = (payload: unknown, ok = true, status = 200) => {
  /* Args are typed explicitly so the recorded calls stay indexable — without
     them vi.fn infers a zero-length tuple and every calls[0] read is a type
     error. */
  const fn = vi.fn(async (_url: string, _init?: any) => ({
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }));
  vi.stubGlobal('fetch', fn);
  return fn;
};

afterEach(() => vi.unstubAllGlobals());

describe('searchSerper', () => {
  it('maps organic results to the SearXNG shape', async () => {
    mockFetch({
      organic: [
        {
          title: 'Paris',
          link: 'https://a.test',
          snippet: 'Capital of France',
        },
      ],
      relatedSearches: [{ query: 'france capital' }, { query: 'paris facts' }],
    });

    const { results, suggestions } = await searchSerper(
      'k',
      'capital of france',
    );

    expect(results).toEqual([
      { title: 'Paris', url: 'https://a.test', content: 'Capital of France' },
    ]);
    expect(suggestions).toEqual(['france capital', 'paris facts']);
  });

  it('sends the key as a header and the query as a JSON body', async () => {
    const fetchMock = mockFetch({ organic: [] });
    await searchSerper('secret-key', 'test');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, any];
    expect(url).toBe('https://google.serper.dev/search');
    expect(init.headers['X-API-KEY']).toBe('secret-key');
    expect(JSON.parse(init.body)).toMatchObject({ q: 'test' });
  });

  it('routes each category to its own endpoint', async () => {
    for (const [category, endpoint] of [
      ['images', 'images'],
      ['videos', 'videos'],
      ['news', 'news'],
    ]) {
      const fetchMock = mockFetch({ images: [], videos: [], news: [] });
      await searchSerper('k', 'q', { categories: [category] });
      expect(fetchMock.mock.calls[0][0]).toBe(
        `https://google.serper.dev/${endpoint}`,
      );
      vi.unstubAllGlobals();
    }
  });

  it('gives image results the fields the image agent reads', async () => {
    mockFetch({
      images: [
        {
          title: 'Eiffel',
          link: 'https://page.test',
          imageUrl: 'https://img.test/full.jpg',
          thumbnailUrl: 'https://img.test/thumb.jpg',
        },
      ],
    });

    const { results } = await searchSerper('k', 'eiffel', {
      categories: ['images'],
    });

    /* image.ts drops any result missing img_src, url or title. */
    expect(results[0]).toMatchObject({
      title: 'Eiffel',
      url: 'https://page.test',
      img_src: 'https://img.test/full.jpg',
      thumbnail_src: 'https://img.test/thumb.jpg',
    });
  });

  it('falls back to the full image when no thumbnail is given', async () => {
    mockFetch({
      images: [
        {
          title: 't',
          link: 'https://p.test',
          imageUrl: 'https://i.test/f.jpg',
        },
      ],
    });
    const { results } = await searchSerper('k', 'q', {
      categories: ['images'],
    });
    expect(results[0].thumbnail_src).toBe('https://i.test/f.jpg');
  });

  it('keeps only videos it can build an embed URL for', async () => {
    /* video.ts requires iframe_src and drops anything without one, so a
       non-embeddable result would otherwise reach the UI and render nothing. */
    mockFetch({
      videos: [
        {
          title: 'Yes',
          link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          imageUrl: 'https://i.test/1.jpg',
        },
        {
          title: 'No',
          link: 'https://vimeo.com/12345',
          imageUrl: 'https://i.test/2.jpg',
        },
      ],
    });

    const { results } = await searchSerper('k', 'q', {
      categories: ['videos'],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: 'Yes',
      iframe_src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      img_src: 'https://i.test/1.jpg',
    });
  });

  it('handles the short youtu.be form', async () => {
    mockFetch({
      videos: [
        {
          title: 'v',
          link: 'https://youtu.be/abcdefghijk',
          imageUrl: 'https://i/1.jpg',
        },
      ],
    });
    const { results } = await searchSerper('k', 'q', {
      categories: ['videos'],
    });
    expect(results[0].iframe_src).toBe(
      'https://www.youtube.com/embed/abcdefghijk',
    );
  });

  it('reads news from its own key', async () => {
    mockFetch({ news: [{ title: 'N', link: 'https://n.test', snippet: 's' }] });
    const { results } = await searchSerper('k', 'q', { categories: ['news'] });
    expect(results).toEqual([
      { title: 'N', url: 'https://n.test', content: 's' },
    ]);
  });

  it('survives a response with no results at all', async () => {
    mockFetch({});
    const { results, suggestions } = await searchSerper('k', 'q');
    expect(results).toEqual([]);
    expect(suggestions).toEqual([]);
  });

  it('throws with the status when the key is rejected', async () => {
    mockFetch({ message: 'Unauthorized' }, false, 403);
    await expect(searchSerper('bad', 'q')).rejects.toThrow(/403/);
  });

  it('forwards language and page when given', async () => {
    const fetchMock = mockFetch({ organic: [] });
    await searchSerper('k', 'q', { language: 'fr', pageno: 3 });
    expect(JSON.parse((fetchMock.mock.calls[0][1] as any).body)).toMatchObject({
      hl: 'fr',
      page: 3,
    });
  });

  it('omits page for the first page', async () => {
    const fetchMock = mockFetch({ organic: [] });
    await searchSerper('k', 'q', { pageno: 1 });
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as any).body),
    ).not.toHaveProperty('page');
  });
});
