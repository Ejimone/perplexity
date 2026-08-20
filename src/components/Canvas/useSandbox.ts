'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CanvasLanguage,
  OutputChunk,
  RunResult,
  SandboxMessage,
} from '@/lib/canvas/types';

const FRAME_FOR: Partial<Record<CanvasLanguage, 'js' | 'py'>> = {
  javascript: 'js',
  python: 'py',
};

export type SandboxRuntime = 'js' | 'py';

/* Drives the two execution iframes.
 *
 * One frame per runtime, both hidden, both created once and reused. Keeping
 * the Python frame alive across runs is what makes the second Python run fast:
 * Pyodide costs ~2 s to boot and the frame holds the warm interpreter.
 *
 * Authentication of inbound messages is by window identity, not by origin. The
 * frames run on an opaque origin, so every message they send arrives with
 * event.origin === 'null' — a value any other sandboxed frame on the page
 * would also carry. Comparing event.source against the exact contentWindow we
 * created is the check that actually distinguishes them.
 */
const useSandbox = () => {
  const jsFrame = useRef<HTMLIFrameElement | null>(null);
  const pyFrame = useRef<HTMLIFrameElement | null>(null);

  const [running, setRunning] = useState(false);
  const [bootMessage, setBootMessage] = useState<string | null>(null);

  /* The in-flight run. Held in a ref because the window message listener is
     registered once and must always see the current run, not the one captured
     when it was attached. */
  const active = useRef<{
    runtime: SandboxRuntime;
    chunks: OutputChunk[];
    onChunk: (chunk: OutputChunk) => void;
    started: number;
    settle: (result: RunResult) => void;
    watchdog: ReturnType<typeof setTimeout>;
    /* Pushes the watchdog out on every sign of life from the frame, so a slow
       Pyodide boot is not mistaken for a dead sandbox. */
    keepAlive: () => void;
  } | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const run = active.current;

      const source =
        event.source === jsFrame.current?.contentWindow
          ? 'js'
          : event.source === pyFrame.current?.contentWindow
            ? 'py'
            : null;

      if (!source) return;

      const message = event.data as SandboxMessage;
      if (!message || typeof message.type !== 'string') return;

      if (message.type === 'boot') {
        if (run?.runtime === source) {
          run.keepAlive();
          setBootMessage(message.message);
        }
        return;
      }

      if (!run || run.runtime !== source) return;
      run.keepAlive();

      if (message.type === 'chunk') {
        const chunk: OutputChunk = {
          stream: message.stream,
          text: message.text,
        };
        run.chunks.push(chunk);
        run.onChunk(chunk);
        return;
      }

      if (message.type === 'done') {
        clearTimeout(run.watchdog);
        active.current = null;
        setRunning(false);
        setBootMessage(null);
        run.settle({
          status: message.status,
          chunks: run.chunks,
          error: message.error,
          /* Prefer the wall clock measured on this side: the worker's own
             number excludes the postMessage hop and, after a timeout, the
             worker is gone and cannot report anything at all. */
          durationMs: Date.now() - run.started,
        });
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const run = useCallback(
    (
      language: CanvasLanguage,
      code: string,
      timeoutMs: number,
      onChunk: (chunk: OutputChunk) => void,
    ): Promise<RunResult> => {
      const runtime = FRAME_FOR[language];
      const frame = runtime === 'js' ? jsFrame.current : pyFrame.current;

      if (!runtime || !frame?.contentWindow) {
        return Promise.resolve({
          status: 'error',
          chunks: [],
          durationMs: 0,
          error: {
            name: 'UnsupportedLanguage',
            message: 'This language can be edited in the canvas but not run.',
          },
        });
      }

      if (active.current) {
        return Promise.resolve({
          status: 'error',
          chunks: [],
          durationMs: 0,
          error: { name: 'Busy', message: 'A run is already in progress.' },
        });
      }

      setRunning(true);
      if (runtime === 'py') setBootMessage('Starting Python…');

      return new Promise<RunResult>((resolve) => {
        /* The frame owns the execution timeout. This is a backstop for the
           frame itself never answering — which is what a PARENT_ORIGIN
           mismatch used to look like: the run message was delivered, silently
           rejected by the frame's sender check, and the UI span forever with
           no error. A hang is never an acceptable failure mode; say so
           instead. */
        const arm = () =>
          setTimeout(() => {
            const stuck = active.current;
            if (!stuck) return;
            active.current = null;
            setRunning(false);
            setBootMessage(null);
            stuck.settle({
              status: 'error',
              chunks: stuck.chunks,
              durationMs: Date.now() - stuck.started,
              error: {
                name: 'SandboxUnavailable',
                message:
                  'The execution sandbox stopped responding. Reload the window and try again.',
              },
            });
          }, timeoutMs + 20000);

        active.current = {
          runtime,
          chunks: [],
          onChunk,
          started: Date.now(),
          settle: resolve,
          watchdog: arm(),
          keepAlive: () => {
            const run = active.current;
            if (!run) return;
            clearTimeout(run.watchdog);
            run.watchdog = arm();
          },
        };

        /* '*' is required: an opaque-origin frame has no addressable origin to
           target. The frame authenticates us instead, by checking that the
           message came from its own parent at the app's origin. */
        frame.contentWindow!.postMessage(
          { type: 'run', lang: runtime, code, timeoutMs },
          '*',
        );
      });
    },
    [],
  );

  const cancel = useCallback(() => {
    const run = active.current;
    if (!run) return;
    run.keepAlive();
    const frame = run.runtime === 'js' ? jsFrame.current : pyFrame.current;
    frame?.contentWindow?.postMessage({ type: 'cancel' }, '*');
  }, []);

  return { jsFrame, pyFrame, run, cancel, running, bootMessage };
};

export default useSandbox;
