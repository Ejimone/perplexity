'use client';

import { useCallback, useRef, useState } from 'react';
import type { CanvasLanguage } from '@/lib/canvas/types';

export type Exchange = {
  id: string;
  label: string;
  answer: string;
  error?: string;
  done: boolean;
};

type AskParams = {
  language: CanvasLanguage;
  code: string;
  selection?: string;
  errorText?: string;
  instruction?: string;
};

/* Resolve which model to talk to.
 *
 * localStorage is the app's normal home for this choice, but it does not
 * survive a restart in the desktop build (the server's port, and therefore the
 * renderer's origin, changes every launch). So a miss here is the common case,
 * not the edge case, and the fallback has to be a real resolution rather than
 * an error — the same shape useChat uses when its stored choice no longer
 * resolves. */
const resolveChatModel = async () => {
  const key = localStorage.getItem('chatModelKey');
  const providerId = localStorage.getItem('chatModelProviderId');
  if (key && providerId) return { key, providerId };

  const res = await fetch('/api/providers');
  if (!res.ok) throw new Error('Could not reach the model providers.');

  const data = await res.json();
  const provider = (data.providers ?? []).find(
    (p: any) => p.chatModels?.length > 0,
  );

  if (!provider) {
    throw new Error(
      'No chat model is configured. Add one in Settings, then try again.',
    );
  }

  return { key: provider.chatModels[0].key, providerId: provider.id };
};

const useAssist = () => {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((id: string, next: Partial<Exchange>) => {
    setExchanges((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...next } : e)),
    );
  }, []);

  const ask = useCallback(
    async (params: AskParams) => {
      if (streaming) return;

      const id = crypto.randomUUID();
      const label =
        params.instruction?.trim() ||
        (params.errorText
          ? 'Why did this fail?'
          : params.selection
            ? 'Explain the selection'
            : 'Review this buffer');

      setExchanges((prev) => [...prev, { id, label, answer: '', done: false }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const chatModel = await resolveChatModel();

        const res = await fetch('/api/canvas/assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ ...params, chatModel }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.message ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        /* NDJSON, matching /api/chat. A chunk boundary can land mid-line, so
           the tail is carried forward rather than parsed. */
        let buffer = '';
        let answer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;

            let payload: any;
            try {
              payload = JSON.parse(line);
            } catch {
              continue;
            }

            if (payload.type === 'chunk') {
              answer += payload.data;
              patch(id, { answer });
            } else if (payload.type === 'error') {
              patch(id, { error: payload.data, done: true });
            }
          }
        }

        patch(id, { done: true });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          patch(id, { done: true });
        } else {
          patch(id, {
            error: err?.message ?? 'Something went wrong.',
            done: true,
          });
        }
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [streaming, patch],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const clear = useCallback(() => {
    abortRef.current?.abort();
    setExchanges([]);
  }, []);

  return { exchanges, streaming, ask, stop, clear };
};

export default useAssist;
