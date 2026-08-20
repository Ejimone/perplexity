'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CANVAS_LANGUAGES,
  languageMeta,
  type CanvasLanguage,
} from '@/lib/canvas/types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const bufferId = (language: CanvasLanguage) => `default:${language}`;

/* One persistent buffer per language.
 *
 * The table behind this holds an arbitrary number of buffers keyed by id, so
 * multi-file tabs are a UI change rather than a schema change — but four
 * language-keyed buffers cover the actual use (switch language, keep your
 * work) without a file-management surface, so that is what ships.
 *
 * Writes are debounced and last-write-wins per language. There is exactly one
 * writer — this window — so no coordination is needed beyond that.
 */
const useBuffers = () => {
  const [contents, setContents] = useState<Record<
    CanvasLanguage,
    string
  > | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const timers = useRef<
    Partial<Record<CanvasLanguage, ReturnType<typeof setTimeout>>>
  >({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      /* Start from the seeded starters so a failed or empty load still gives a
         usable editor rather than a blank one. */
      const seeded = Object.fromEntries(
        CANVAS_LANGUAGES.map((l) => [l.id, l.starter]),
      ) as Record<CanvasLanguage, string>;

      try {
        const res = await fetch('/api/canvas/buffers');
        if (res.ok) {
          const data = (await res.json()) as {
            buffers: { id: string; language: string; content: string }[];
          };
          for (const row of data.buffers ?? []) {
            const language = row.language as CanvasLanguage;
            if (row.id === bufferId(language) && language in seeded) {
              seeded[language] = row.content;
            }
          }
        }
      } catch {
        /* Offline or the server is mid-restart. The starters stand in; the
           next edit will persist normally. */
      }

      if (!cancelled) setContents(seeded);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* Flush pending debounces on unmount so navigating away from the canvas
     immediately after typing does not drop the last keystrokes. */
  const pending = useRef<Partial<Record<CanvasLanguage, string>>>({});

  const persist = useCallback(
    async (language: CanvasLanguage, content: string) => {
      setSaveState('saving');
      try {
        const res = await fetch('/api/canvas/buffers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: bufferId(language),
            name: languageMeta(language).label,
            language,
            content,
          }),
        });
        setSaveState(res.ok ? 'saved' : 'error');
      } catch {
        setSaveState('error');
      }
    },
    [],
  );

  useEffect(() => {
    const flushAll = () => {
      for (const [language, content] of Object.entries(pending.current)) {
        if (content === undefined) continue;
        navigator.sendBeacon?.(
          '/api/canvas/buffers',
          new Blob(
            [
              JSON.stringify({
                id: bufferId(language as CanvasLanguage),
                name: languageMeta(language as CanvasLanguage).label,
                language,
                content,
              }),
            ],
            { type: 'application/json' },
          ),
        );
      }
    };

    /* The desktop shell reloads the window whenever the server restarts on a
       new port, and that arrives with no warning — pagehide is the last hook
       that fires. */
    window.addEventListener('pagehide', flushAll);
    return () => {
      window.removeEventListener('pagehide', flushAll);
      flushAll();
    };
  }, []);

  const update = useCallback(
    (language: CanvasLanguage, content: string) => {
      setContents((prev) => (prev ? { ...prev, [language]: content } : prev));
      pending.current[language] = content;

      clearTimeout(timers.current[language]);
      timers.current[language] = setTimeout(() => {
        delete pending.current[language];
        void persist(language, content);
      }, 600);
    },
    [persist],
  );

  useEffect(() => {
    const handles = timers.current;
    return () => {
      Object.values(handles).forEach((t) => clearTimeout(t));
    };
  }, []);

  return { contents, update, saveState };
};

export default useBuffers;
