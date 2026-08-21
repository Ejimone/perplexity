'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Code2, GripVertical, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Code-split: CodeMirror, the four language grammars and the sandbox driver
   are a large chunk, and this component mounts on every page in the app. None
   of it should load until the user actually opens the panel. */
const Canvas = dynamic(() => import('@/components/Canvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-black/40 dark:text-white/40">
      Loading canvas…
    </div>
  ),
});

/* Geometry for the floating panel. Named because the bare numbers gave no
   hint which were constraints and which were taste. */
const MIN_W = 420;
const MIN_H = 300;
const DEFAULT_W = 720;
const DEFAULT_H = 460;
/* Where it first appears: inset from the bottom-right corner, but never
   closer than SCREEN_MARGIN to the top or left on a small window. */
const SEED_RIGHT_GAP = 40;
const SEED_BOTTOM_GAP = 60;
const SCREEN_MARGIN = 24;
/* How much of the panel must stay on screen while dragging, so it can always
   be grabbed again. */
const KEEP_VISIBLE_X = 120;
const KEEP_VISIBLE_Y = 40;

/* The in-window floating canvas.
 *
 * One of three surfaces the canvas can be opened from, chosen by the "Coding
 * canvas" preference. This one is pure React — no Electron involvement — so it
 * also works when the app is opened in a browser rather than the desktop
 * shell, and it costs nothing at the main-process level.
 *
 * Mounted globally from app/layout.tsx, so it must be quiet: it renders
 * nothing at all unless the preference asks for it, and it never mounts on
 * /canvas, where the full-page version is already on screen.
 */
const FloatingPanel = () => {
  const pathname = usePathname();

  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H });
  const [mode, setMode] = useState<'drag' | 'resize' | null>(null);

  const grab = useRef({ x: 0, y: 0, boxX: 0, boxY: 0, w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/canvas/surface');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEnabled(Boolean(data.panel));
      } catch {
        /* Preference unreadable — stay hidden rather than appear uninvited. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Seed the position from the viewport once, on the client. Doing it in
     useState's initialiser would read `window` during SSR. */
  useEffect(() => {
    setBox((prev) => ({
      ...prev,
      x: Math.max(SCREEN_MARGIN, window.innerWidth - prev.w - SEED_RIGHT_GAP),
      y: Math.max(SCREEN_MARGIN, window.innerHeight - prev.h - SEED_BOTTOM_GAP),
    }));
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!mode) return;
      const dx = e.clientX - grab.current.x;
      const dy = e.clientY - grab.current.y;

      setBox((prev) =>
        mode === 'drag'
          ? {
              ...prev,
              x: Math.min(
                Math.max(0, grab.current.boxX + dx),
                window.innerWidth - KEEP_VISIBLE_X,
              ),
              y: Math.min(
                Math.max(0, grab.current.boxY + dy),
                window.innerHeight - KEEP_VISIBLE_Y,
              ),
            }
          : {
              ...prev,
              w: Math.max(MIN_W, grab.current.w + dx),
              h: Math.max(MIN_H, grab.current.h + dy),
            },
      );
    },
    [mode],
  );

  const start = (which: 'drag' | 'resize') => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = {
      x: e.clientX,
      y: e.clientY,
      boxX: box.x,
      boxY: box.y,
      w: box.w,
      h: box.h,
    };
    setMode(which);
  };

  const end = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setMode(null);
  };

  if (!enabled || pathname === '/canvas') return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open the coding canvas"
        className="fixed bottom-24 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-light-200 bg-light-secondary text-black/70 shadow-lg transition duration-200 hover:scale-105 dark:border-dark-200 dark:bg-dark-secondary dark:text-white/70 lg:bottom-6"
      >
        <Code2 size={19} />
      </button>
    );
  }

  return (
    <div
      className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-light-200 bg-light-primary shadow-2xl dark:border-dark-200 dark:bg-dark-primary"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      /* The app binds a bare "/" on document to focus the chat composer
         (MessageInput.tsx). CodeMirror's editable is a contenteditable, not an
         <input>, so that handler would fire while the user is typing here. */
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <div
        /* Stable hook for scripts/verify/panel-test.mjs. It used to find this
           strip with span:text("Canvas"), which also matches the navigation's
           Canvas label and silently measured the wrong element. */
        data-canvas-panel-header
        onPointerDown={start('drag')}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={() => setMode(null)}
        className={cn(
          'flex shrink-0 select-none items-center gap-x-1.5 border-b border-light-200 bg-light-secondary px-2 py-1.5 dark:border-dark-200 dark:bg-dark-secondary',
          mode === 'drag' ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <GripVertical size={13} className="text-black/30 dark:text-white/30" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
          Canvas
        </span>

        <div className="ml-auto flex items-center gap-x-0.5">
          <button
            onClick={() => setOpen(false)}
            title="Minimise"
            className="rounded p-1 text-black/45 transition duration-200 hover:bg-light-200 hover:text-black/70 dark:text-white/45 dark:hover:bg-dark-200 dark:hover:text-white/70"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => setOpen(false)}
            title="Close"
            className="rounded p-1 text-black/45 transition duration-200 hover:bg-light-200 hover:text-black/70 dark:text-white/45 dark:hover:bg-dark-200 dark:hover:text-white/70"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <Canvas surface="panel" />
      </div>

      <div
        onPointerDown={start('resize')}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={() => setMode(null)}
        title="Resize"
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
      />
    </div>
  );
};

export default FloatingPanel;
