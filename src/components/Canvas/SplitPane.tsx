'use client';

import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';

type Orientation = 'horizontal' | 'vertical';

/* A two-pane splitter.
 *
 * `orientation` describes how the panes sit relative to each other:
 * 'horizontal' puts them side by side (the handle is a vertical bar you drag
 * left/right), 'vertical' stacks them (the handle is a horizontal bar).
 *
 * The split is stored as a percentage of the container rather than pixels, so
 * the layout survives a window resize with no measurement bookkeeping — which
 * matters here because the canvas is the first full-viewport surface in an app
 * whose every other page lives inside a fixed max-w-screen-lg column.
 *
 * Hand-rolled rather than pulled from allotment/react-resizable: the entire
 * behaviour is a pointer capture and one clamped division, and nothing else in
 * this project is resizable, so a dependency would carry no other weight.
 *
 * Pointer capture (rather than window-level mousemove listeners) is what keeps
 * the drag alive over the execution iframes — an iframe otherwise swallows the
 * move events the moment the cursor crosses into it.
 *
 * SPLITTING ONLY HAPPENS AT @3xl (768px) AND ABOVE, and that is a CONTAINER
 * query, not a viewport one. The distinction is the whole point: the canvas
 * also renders inside a ~720px floating panel on a wide desktop screen, and a
 * viewport breakpoint would hand that panel the full three-column layout and
 * the three unusable slivers this component used to produce. Below the
 * breakpoint the percentage is not applied and the parent decides which single
 * pane is visible — see the tab strip in index.tsx.
 *
 * The split is published as the `--split` custom property rather than an
 * inline width/height so those container queries can opt out of it; an inline
 * style would win over any class. The `@3xl/canvas:` prefixes are written out
 * in full on purpose — Tailwind scans for literal class strings, so building
 * them from a constant would silently emit no CSS.
 */
const SplitPane = ({
  orientation,
  children,
  initial = 50,
  min = 15,
  max = 85,
  className,
  collapsed = false,
  firstClassName,
  secondClassName,
}: {
  orientation: Orientation;
  children: [React.ReactNode, React.ReactNode];
  initial?: number;
  min?: number;
  max?: number;
  className?: string;
  /* When true the second pane is hidden and the first takes the whole
     container. Applied only above the split breakpoint — below it the parent's
     tab state decides what is visible, and a collapse toggle that also fired
     there would blank the pane the user had just selected. */
  collapsed?: boolean;
  /* Per-pane classes, used by the parent to drive tab visibility below the
     breakpoint. */
  firstClassName?: string;
  secondClassName?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fraction, setFraction] = useState(initial);
  const [dragging, setDragging] = useState(false);

  const isHorizontal = orientation === 'horizontal';

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const raw = isHorizontal
        ? ((e.clientX - rect.left) / rect.width) * 100
        : ((e.clientY - rect.top) / rect.height) * 100;

      setFraction(Math.min(max, Math.max(min, raw)));
    },
    [dragging, isHorizontal, min, max],
  );

  /* Suppress selection app-wide while dragging. Without this, sweeping the
     handle across CodeMirror selects the buffer text underneath it. */
  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [dragging]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-hidden',
        isHorizontal && '@3xl/canvas:flex-row',
        className,
      )}
      style={{ ['--split' as string]: `${collapsed ? 100 : fraction}%` }}
    >
      <div
        className={cn(
          'min-h-0 min-w-0 flex-1 overflow-hidden',
          /* Above the breakpoint the first pane takes exactly --split and the
             second takes the remainder, so the handle's own width can never
             push the pair past 100%. */
          '@3xl/canvas:block @3xl/canvas:flex-[0_0_var(--split)]',
          firstClassName,
        )}
      >
        {children[0]}
      </div>

      <div
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        className={cn(
          'hidden shrink-0 bg-light-200 transition-colors duration-150 dark:bg-dark-200',
          'hover:bg-accent/60 active:bg-accent',
          dragging && 'bg-accent',
          /* There is nothing to drag below the breakpoint, and a 1px painted
             bar was never a realistic pointer target anyway. The transparent
             border widens the grab area to 9px without widening the rule. */
          !collapsed && '@3xl/canvas:block',
          isHorizontal
            ? 'box-content w-px cursor-col-resize border-x-4 border-transparent bg-clip-padding'
            : 'box-content h-px cursor-row-resize border-y-4 border-transparent bg-clip-padding',
        )}
      />

      {/* Always mounted, never conditionally rendered: collapsing the assist
          pane used to unmount it, losing its scroll position and any reply
          still streaming into it — which the old doc comment claimed it did
          not do. Hidden with a class instead, and only above the breakpoint,
          because below it the tab state is what decides. */}
      <div
        className={cn(
          'min-h-0 min-w-0 flex-1 overflow-hidden',
          '@3xl/canvas:block @3xl/canvas:flex-1',
          collapsed && '@3xl/canvas:hidden',
          secondClassName,
        )}
      >
        {children[1]}
      </div>
    </div>
  );
};

export default SplitPane;
