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
 */
const SplitPane = ({
  orientation,
  children,
  initial = 50,
  min = 15,
  max = 85,
  className,
  collapsed = false,
}: {
  orientation: Orientation;
  children: [React.ReactNode, React.ReactNode];
  initial?: number;
  min?: number;
  max?: number;
  className?: string;
  /* When true the second pane is hidden entirely and the first takes the
     whole container. Used for "hide the output/assist pane" toggles without
     unmounting the pane and losing its scroll position or streamed content. */
  collapsed?: boolean;
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

  const first = collapsed ? 100 : fraction;

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex min-h-0 min-w-0 overflow-hidden',
        isHorizontal ? 'flex-row' : 'flex-col',
        className,
      )}
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={isHorizontal ? { width: `${first}%` } : { height: `${first}%` }}
      >
        {children[0]}
      </div>

      {!collapsed && (
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
            'shrink-0 bg-light-200 dark:bg-dark-200 transition-colors duration-150',
            'hover:bg-[#24A0ED]/60 active:bg-[#24A0ED]',
            dragging && 'bg-[#24A0ED]',
            isHorizontal
              ? 'w-px cursor-col-resize border-x-2 border-transparent bg-clip-padding box-content'
              : 'h-px cursor-row-resize border-y-2 border-transparent bg-clip-padding box-content',
          )}
        />
      )}

      {!collapsed && (
        <div
          className="min-h-0 min-w-0 overflow-hidden"
          style={
            isHorizontal
              ? { width: `${100 - fraction}%` }
              : { height: `${100 - fraction}%` }
          }
        >
          {children[1]}
        </div>
      )}
    </div>
  );
};

export default SplitPane;
