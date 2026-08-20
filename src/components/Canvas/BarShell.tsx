'use client';

import { useEffect } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import Canvas from '@/components/Canvas';

/* The canvas as it appears in the desktop floating-bar window.
 *
 * Same component, same sandbox, same assist — only the chrome differs. The
 * window is frameless, so this supplies the title strip: it is marked as a
 * drag region via -webkit-app-region, which is what lets the user move a
 * frameless Electron window without any IPC at all. Buttons inside it have to
 * opt back out with app-region: no-drag or they become un-clickable. */
const BarShell = () => {
  useEffect(() => {
    /* Hides the navigation rail the root layout renders. See globals.css. */
    const root = document.documentElement;
    root.classList.add('canvas-bar', 'canvas-chromeless');
    return () => root.classList.remove('canvas-bar', 'canvas-chromeless');
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-xl border border-light-200 bg-light-primary dark:border-dark-200 dark:bg-dark-primary">
      <div
        className="flex shrink-0 select-none items-center gap-x-2 border-b border-light-200 bg-light-secondary px-2.5 py-1.5 dark:border-dark-200 dark:bg-dark-secondary"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <GripHorizontal
          size={13}
          className="text-black/30 dark:text-white/30"
        />
        <span className="text-[11px] font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
          Canvas
        </span>

        <button
          onClick={() => window.simplicityBar?.hide()}
          title="Hide (Cmd/Ctrl+Shift+\)"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="ml-auto rounded p-1 text-black/45 transition duration-200 hover:bg-light-200 hover:text-black/70 dark:text-white/45 dark:hover:bg-dark-200 dark:hover:text-white/70"
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <Canvas surface="bar" />
      </div>
    </div>
  );
};

export default BarShell;
