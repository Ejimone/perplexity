import Canvas from '@/components/Canvas';
import BarShell from '@/components/Canvas/BarShell';
import StandaloneShell from '@/components/Canvas/StandaloneShell';

export const metadata = {
  title: 'Canvas - Simplicity',
};

/* Deliberately does NOT render <Layout/>.
 *
 * Layout wraps its children in a centred max-w-screen-lg column, which is
 * right for an answer page and wrong for an editor — the canvas needs the full
 * viewport. Because Layout is applied per page rather than by the root layout,
 * opting out is just not importing it: no change to Layout.tsx, and no risk to
 * the chat pages that depend on its width (Chat.tsx measures that column to
 * position the composer).
 *
 * ?surface=bar is how the desktop floating-bar window asks for the same canvas
 * with window chrome instead of page chrome. */
const CanvasPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string }>;
}) => {
  const { surface } = await searchParams;

  if (surface === 'bar') return <BarShell />;

  /* A canvas-only deployment has no other pages to navigate to, so it drops
     the app shell entirely. Set at build time, not per request. */
  if (process.env.NEXT_PUBLIC_CANVAS_ONLY === '1') return <StandaloneShell />;

  return (
    <main className="h-screen overflow-hidden bg-light-primary pb-20 dark:bg-dark-primary lg:pb-0 lg:pl-[72px]">
      <Canvas surface="page" />
    </main>
  );
};

export default CanvasPage;
