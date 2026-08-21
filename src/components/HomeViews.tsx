'use client';

import ChatWindow from './ChatWindow';
import DiscoverView from './Discover/DiscoverView';
import LibraryView from './Library/LibraryView';
import Layout from './Layout';
import { useView } from '@/lib/hooks/useView';

/* The home route's three views.
 *
 * Discover, Library and the chat thread were three separate Next routes
 * (/discover, /library, /c/[chatId]). They are views on `/` now — see
 * src/lib/hooks/useView.tsx for why — selected by ?view= and ?c=.
 *
 * All three are mounted under one <Layout/> because they share the same
 * centred column. Only the selected one renders: unlike the canvas panes,
 * there is nothing here worth keeping alive off screen, and ChatWindow in
 * particular reads live state from ChatProvider (which sits above this
 * component and does persist across switches). */
const HomeViews = () => {
  const { view } = useView();

  return (
    <Layout>
      {view === 'discover' ? (
        <DiscoverView />
      ) : view === 'library' ? (
        <LibraryView />
      ) : (
        <ChatWindow />
      )}
    </Layout>
  );
};

export default HomeViews;
