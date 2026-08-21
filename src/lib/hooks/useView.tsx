'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* Which view the home route is showing.
 *
 * Discover, Library and a chat thread used to be three separate Next routes.
 * They are views now, for a reason that is arithmetic rather than taste:
 * Vercel's free plan allows twelve serverless functions and Next 16 emits two
 * per route, so the hosted build gets six routes in total and four are already
 * spent. Each of those three pages would have cost two more.
 *
 * They convert cleanly because none of them ever needed the server: all three
 * were already 'use client' components that fetch JSON on mount.
 *
 * The view lives in the URL rather than in React state alone, so a view is
 * still linkable, bookmarkable and survives a reload — `/?view=discover`,
 * `/?c=<chatId>`. Navigation between them uses history.pushState rather than
 * the router: it is the same page, so there is nothing for the server to
 * re-render, and the root layout is force-dynamic (it reads the setup flag per
 * request), which would make a router navigation a real round trip.
 * useChat already used history.replaceState for exactly this reason.
 */

export type View = 'chat' | 'discover' | 'library';

const VIEWS: View[] = ['chat', 'discover', 'library'];

type ViewContextValue = {
  view: View;
  /* Navigates to a view, pushing a single history entry so Back works.
     `chatId` opens a specific thread in the chat view; it is the one piece of
     per-view state that belongs in the URL. */
  setView: (view: View, chatId?: string) => void;
};

const ViewContext = createContext<ViewContextValue>({
  view: 'chat',
  setView: () => {},
});

const readViewFromLocation = (): View => {
  if (typeof window === 'undefined') return 'chat';
  /* Only the home route hosts views. /canvas is a real route and must never
     be mistaken for one. */
  if (window.location.pathname !== '/') return 'chat';

  const raw = new URLSearchParams(window.location.search).get('view');
  return VIEWS.includes(raw as View) ? (raw as View) : 'chat';
};

export const ViewProvider = ({ children }: { children: ReactNode }) => {
  /* Seeded to 'chat' rather than read from the URL, because this renders on
     the server too and window does not exist there. The effect below corrects
     it before paint on a deep link. */
  const [view, setViewState] = useState<View>('chat');

  useEffect(() => {
    setViewState(readViewFromLocation());

    /* Back/forward move between views without a navigation, so popstate is
       the only signal that the URL changed. */
    const onPop = () => setViewState(readViewFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setView = useCallback((next: View, chatId?: string) => {
    const url = new URL(window.location.href);
    url.pathname = '/';

    if (next === 'chat') {
      url.searchParams.delete('view');
      if (chatId) url.searchParams.set('c', chatId);
    } else {
      url.searchParams.set('view', next);
      /* Leaving a thread's id in the URL while showing Discover would restore
         the wrong view on reload. */
      url.searchParams.delete('c');
    }

    /* One entry per navigation — writing the URL here and again at the call
       site would make Back need two presses. */
    window.history.pushState(null, '', url.toString());
    setViewState(next);
  }, []);

  const value = useMemo(() => ({ view, setView }), [view, setView]);

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
};

export const useView = () => useContext(ViewContext);
