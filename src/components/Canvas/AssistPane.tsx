'use client';

import { useMemo, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import {
  ArrowDownToLine,
  Check,
  Copy,
  CornerDownLeft,
  Loader2,
  Replace,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MONO_STACK } from './theme';

/* How tall a streamed code block and the composer are allowed to grow before
   they scroll internally. Named because 'max-h-80' read as an arbitrary
   choice: the first keeps a long reply from pushing the Insert/Replace
   buttons off screen, the second keeps the composer from eating the
   conversation on a phone. */
const CODE_BLOCK_MAX_H = 'max-h-80';
const COMPOSER_MAX_H = 'max-h-24';
import {
  parseSegments,
  splitReasoning,
  type ReplySegment,
} from '@/lib/canvas/reply';
import type { Exchange } from './useAssist';

const CodeCard = ({
  segment,
  onReplace,
  onInsert,
}: {
  segment: Extract<ReplySegment, { kind: 'code' }>;
  onReplace: (code: string) => void;
  onInsert: (code: string) => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState<'replace' | 'insert' | null>(null);

  const act = (which: 'replace' | 'insert') => {
    (which === 'replace' ? onReplace : onInsert)(segment.value);
    setApplied(which);
    setTimeout(() => setApplied(null), 1600);
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-light-200 dark:border-dark-200">
      <div className="flex items-center justify-between border-b border-light-200 bg-light-secondary px-2 py-1 dark:border-dark-200 dark:bg-dark-secondary">
        <span className="text-[10px] uppercase tracking-wide text-black/45 dark:text-white/45">
          {segment.language || 'code'}
          {!segment.complete && ' · writing…'}
        </span>

        <div className="flex items-center gap-x-1">
          <button
            title="Copy"
            onClick={() => {
              navigator.clipboard.writeText(segment.value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            className="rounded p-1 text-black/45 transition duration-200 hover:bg-light-200 hover:text-black/70 dark:text-white/45 dark:hover:bg-dark-200 dark:hover:text-white/70"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>

          {/* Nothing here applies on its own. Both actions are explicit, and
              both stay disabled until the block has actually finished. */}
          <button
            title="Insert at cursor"
            disabled={!segment.complete}
            onClick={() => act('insert')}
            className="flex items-center gap-x-1 rounded px-1.5 py-1 text-[11px] text-black/60 transition duration-200 hover:bg-light-200 hover:text-black/80 disabled:opacity-30 dark:text-white/60 dark:hover:bg-dark-200 dark:hover:text-white/80"
          >
            {applied === 'insert' ? (
              <Check size={13} />
            ) : (
              <ArrowDownToLine size={13} />
            )}
            Insert
          </button>

          <button
            title="Replace the whole buffer"
            disabled={!segment.complete}
            onClick={() => act('replace')}
            className="flex items-center gap-x-1 rounded bg-accent/10 px-1.5 py-1 text-[11px] text-accent transition duration-200 hover:bg-accent/20 disabled:opacity-30"
          >
            {applied === 'replace' ? (
              <Check size={13} />
            ) : (
              <Replace size={13} />
            )}
            Replace
          </button>
        </div>
      </div>

      <pre
        className={cn(
          CODE_BLOCK_MAX_H,
          'overflow-auto bg-light-primary p-2 text-[12px] leading-relaxed text-black/80 dark:bg-dark-primary dark:text-white/80',
        )}
        style={{ fontFamily: MONO_STACK }}
      >
        {segment.value}
      </pre>
    </div>
  );
};

const ExchangeView = ({
  exchange,
  onReplace,
  onInsert,
}: {
  exchange: Exchange;
  onReplace: (code: string) => void;
  onInsert: (code: string) => void;
}) => {
  const { visible, reasoning } = useMemo(
    () => splitReasoning(exchange.answer),
    [exchange.answer],
  );
  const segments = useMemo(() => parseSegments(visible), [visible]);

  return (
    <div className="border-b border-light-200 px-3 py-3 last:border-b-0 dark:border-dark-200">
      <p className="mb-2 flex items-start gap-x-1.5 text-[12px] font-medium text-black/70 dark:text-white/70">
        <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" />
        {exchange.label}
      </p>

      {exchange.error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/5 p-2 text-[12px] text-red-600 dark:text-[#ff7b72]">
          {exchange.error}
        </p>
      )}

      {(reasoning || (!exchange.answer && !exchange.error)) &&
        !exchange.done && (
          <p className="flex items-center gap-x-1.5 text-[12px] text-black/45 dark:text-white/45">
            <Loader2 size={12} className="animate-spin" />
            {reasoning ? 'Reasoning…' : 'Thinking…'}
          </p>
        )}

      <div className="text-[13px] leading-relaxed text-black/75 dark:text-white/75">
        {segments.map((segment, i) =>
          segment.kind === 'code' ? (
            <CodeCard
              key={i}
              segment={segment}
              onReplace={onReplace}
              onInsert={onInsert}
            />
          ) : (
            <div
              key={i}
              className="prose prose-sm max-w-none break-words dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-sm prose-headings:font-medium prose-code:rounded prose-code:bg-light-200 prose-code:px-1 prose-code:py-0.5 prose-code:text-[12px] prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-dark-200"
            >
              <Markdown>{segment.value}</Markdown>
            </div>
          ),
        )}
      </div>
    </div>
  );
};

const AssistPane = ({
  exchanges,
  streaming,
  onStop,
  onClear,
  onReplace,
  onInsert,
  onAsk,
  hint,
}: {
  exchanges: Exchange[];
  streaming: boolean;
  onStop: () => void;
  onClear: () => void;
  onReplace: (code: string) => void;
  onInsert: (code: string) => void;
  onAsk: (instruction: string) => void;
  hint: string;
}) => {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const instruction = draft.trim();
    if (!instruction || streaming) return;
    setDraft('');
    onAsk(instruction);
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-light-200 bg-light-secondary dark:border-dark-200 dark:bg-dark-secondary">
      <div className="flex shrink-0 items-center justify-between border-b border-light-200 px-3 py-1.5 dark:border-dark-200">
        <span className="text-[11px] font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
          Assist
        </span>

        <div className="flex items-center gap-x-1">
          {streaming && (
            <button
              onClick={onStop}
              title="Stop"
              className="rounded p-1 text-black/45 transition duration-200 hover:bg-light-200 hover:text-black/70 dark:text-white/45 dark:hover:bg-dark-200 dark:hover:text-white/70"
            >
              <Square size={13} />
            </button>
          )}
          {exchanges.length > 0 && (
            <button
              onClick={onClear}
              title="Clear"
              className="rounded p-1 text-black/45 transition duration-200 hover:bg-light-200 hover:text-black/70 dark:text-white/45 dark:hover:bg-dark-200 dark:hover:text-white/70"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {exchanges.length === 0 ? (
          <div className="px-3 py-4 text-[12.5px] leading-relaxed text-black/40 dark:text-white/40">
            <p>{hint}</p>
            <p className="mt-2">
              Suggestions are never applied for you — every code block gets
              Insert and Replace buttons you press yourself.
            </p>
          </div>
        ) : (
          exchanges.map((exchange) => (
            <ExchangeView
              key={exchange.id}
              exchange={exchange}
              onReplace={onReplace}
              onInsert={onInsert}
            />
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-light-200 p-2 dark:border-dark-200">
        <div className="flex items-end gap-x-1.5 rounded-lg border border-light-200 bg-light-primary px-2 py-1.5 focus-within:border-accent/50 dark:border-dark-200 dark:bg-dark-primary">
          <textarea
            value={draft}
            rows={1}
            placeholder="Ask about this code…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              /* Contained here so the editor's Mod-Enter (run) and the app's
                 bare "/" composer shortcut cannot fire from this field. */
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className={cn(
              COMPOSER_MAX_H,
              'min-h-[20px] flex-1 resize-none bg-transparent text-[12.5px] text-black/80 placeholder:text-black/35 focus:outline-none dark:text-white/80 dark:placeholder:text-white/35',
            )}
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || streaming}
            title="Send"
            className="rounded p-1 text-accent transition duration-200 hover:bg-accent/10 disabled:opacity-30"
          >
            <CornerDownLeft size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistPane;
