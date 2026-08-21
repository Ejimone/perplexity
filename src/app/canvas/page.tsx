import Canvas from '@/components/Canvas';
import BarShell from '@/components/Canvas/BarShell';
import StandaloneShell from '@/components/Canvas/StandaloneShell';

export const metadata = {
  title: 'Canvas - Curiocity',
};

/* Deliberately does NOT render <Layout/>.
 *
 * Layout wraps its children in a centred max-w-screen-lg column, which is
 * right for an answer page and wrong for an editor — the canvas needs the full
 * viewport. This used to be untrue in practice: the navigation component
 * wrapped every page in <Layout/> itself, so the canvas really was rendered
 * inside that column, as a <main> nested in a <main>. Nav is a sibling of the
 * page now and each page brings its own wrapper, so opting out is once again
 * just a matter of not importing it.
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
    /* 100dvh, not 100vh: on mobile the browser's collapsing chrome makes vh
       taller than the visible viewport, which pushed the editor's bottom edge
       (and the output pane with it) under the URL bar. The offsets clear the
       fixed navigation — a bottom bar below lg, a 72px rail at and above it,
       matching Nav's RAIL_WIDTH. */
    <main className="h-[100dvh] overflow-hidden bg-light-primary pb-20 dark:bg-dark-primary lg:pb-0 lg:pl-[72px]">
      <Canvas surface="page" />
    </main>
  );
};

export default CanvasPage;
