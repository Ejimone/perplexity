'use client';

import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eraser,
  Loader2,
} from 'lucide-react';
import { MONO_STACK } from './theme';
import type { OutputChunk, RunResult } from '@/lib/canvas/types';

/* stdout / stderr / timing / errors.
 *
 * The error block is the point of this pane: a runtime failure arrives from
 * the sandbox already carrying a line number mapped back to the user's buffer,
 * and clicking it moves the cursor there and underlines the line. */
const Output = ({
  chunks,
  result,
  running,
  bootMessage,
  onJumpToLine,
  onClear,
}: {
  chunks: OutputChunk[];
  result: RunResult | null;
  running: boolean;
  bootMessage: string | null;
  onJumpToLine: (line: number, column?: number) => void;
  onClear: () => void;
}) => {
  const error = result?.error;
  const empty = chunks.length === 0 && !result && !running;

  return (
    <div className="flex h-full min-h-0 flex-col bg-light-primary dark:bg-dark-primary">
      <div className="flex shrink-0 items-center justify-between border-b border-light-200 px-3 py-1.5 dark:border-dark-200">
        <div className="flex items-center gap-x-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
            Output
          </span>

          {running && (
            <span className="flex items-center gap-x-1.5 text-[11px] text-black/60 dark:text-white/60">
              <Loader2 size={12} className="animate-spin" />
              {bootMessage ?? 'Running…'}
            </span>
          )}

          {!running && result && (
            <span
              className={cn(
                'flex items-center gap-x-1.5 rounded-full px-2 py-0.5 text-[11px]',
                result.status === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : result.status === 'timeout'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400',
              )}
            >
              {result.status === 'ok' ? (
                <CheckCircle2 size={12} />
              ) : result.status === 'timeout' ? (
                <Clock size={12} />
              ) : (
                <AlertTriangle size={12} />
              )}
              {result.status === 'ok'
                ? 'Finished'
                : result.status === 'timeout'
                  ? 'Timed out'
                  : 'Error'}
              <span className="opacity-60">· {result.durationMs} ms</span>
            </span>
          )}
        </div>

        <button
          onClick={onClear}
          title="Clear output"
          className="rounded p-1 text-black/40 transition duration-200 hover:bg-light-200 hover:text-black/70 dark:text-white/40 dark:hover:bg-dark-200 dark:hover:text-white/70"
        >
          <Eraser size={14} />
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto px-3 py-2 text-[12.5px] leading-relaxed"
        style={{ fontFamily: MONO_STACK }}
      >
        {empty && (
          <p className="select-none text-black/35 dark:text-white/35">
            Output appears here. Press ⌘↵ to run.
          </p>
        )}

        {chunks.map((chunk, i) => (
          <pre
            key={i}
            className={cn(
              'whitespace-pre-wrap break-words',
              chunk.stream === 'stderr'
                ? 'text-red-600 dark:text-[#ff7b72]'
                : 'text-black/80 dark:text-white/80',
            )}
          >
            {chunk.text.replace(/\n$/, '')}
          </pre>
        ))}

        {error && (
          <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-red-600 dark:text-[#ff7b72]">
                {error.name}
              </span>

              {typeof error.line === 'number' && (
                <button
                  onClick={() => onJumpToLine(error.line!, error.column)}
                  className="rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-600 underline-offset-2 transition duration-200 hover:bg-red-500/20 hover:underline dark:text-[#ff7b72]"
                >
                  line {error.line}
                  {typeof error.column === 'number' ? `:${error.column}` : ''}
                </button>
              )}
            </div>

            <p className="mt-1 whitespace-pre-wrap break-words text-black/80 dark:text-white/80">
              {error.message}
            </p>

            {error.traceback && (
              <details className="mt-2">
                <summary className="cursor-pointer select-none text-[11px] text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/70">
                  Traceback
                </summary>
                <pre className="mt-1 whitespace-pre-wrap break-words text-[11.5px] text-black/60 dark:text-white/60">
                  {error.traceback}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Output;
