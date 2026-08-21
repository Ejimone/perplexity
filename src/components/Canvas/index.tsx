'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Code2,
  Loader2,
  Play,
  PanelBottom,
  PanelRight,
  Sparkles,
  Square,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Select from '@/components/ui/Select';
import Editor, { type EditorHandle } from './Editor';
import Output from './Output';
import AssistPane from './AssistPane';
import SplitPane from './SplitPane';
import useSandbox from './useSandbox';
import useBuffers from './useBuffers';
import useAssist from './useAssist';
import {
  CANVAS_LANGUAGES,
  languageMeta,
  type CanvasLanguage,
  type OutputChunk,
  type RunResult,
} from '@/lib/canvas/types';

const TIMEOUTS = [
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
];

type Pane = 'code' | 'output' | 'assist';

const PANES: { id: Pane; label: string; icon: typeof Code2 }[] = [
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'output', label: 'Output', icon: Terminal },
  { id: 'assist', label: 'Assist', icon: Sparkles },
];

/* The coding canvas.
 *
 * Rendered by /canvas, by the in-window floating panel and by the OS floating
 * bar — `surface` only changes chrome density, never behaviour, so all three
 * run exactly the same editor, sandbox and assist stack. */
const Canvas = ({
  surface = 'page',
}: {
  surface?: 'page' | 'panel' | 'bar';
}) => {
  const editorRef = useRef<EditorHandle>(null);

  const [language, setLanguage] = useState<CanvasLanguage>('javascript');
  const [chunks, setChunks] = useState<OutputChunk[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [showOutput, setShowOutput] = useState(true);
  const [showAssist, setShowAssist] = useState(surface === 'page');
  /* Which single pane is on screen below @3xl. Ignored above it, where all
     three are visible at once and the split handles govern instead. */
  const [tab, setTab] = useState<Pane>('code');

  const { jsFrame, pyFrame, run, cancel, running, bootMessage } = useSandbox();
  const { contents, update, saveState } = useBuffers();
  const { exchanges, streaming, ask, stop, clear } = useAssist();

  const meta = languageMeta(language);

  /* Everything the model needs to see about the last failure: what the program
     printed to stderr, plus the structured error the sandbox mapped back. */
  const errorText = useMemo(() => {
    const parts = chunks
      .filter((c) => c.stream === 'stderr')
      .map((c) => c.text);

    if (result?.error) {
      parts.push(
        result.error.traceback ??
          `${result.error.name}: ${result.error.message}`,
      );
    }

    const text = parts.join('').trim();
    return text || undefined;
  }, [chunks, result]);

  const handleRun = useCallback(async () => {
    if (running) {
      cancel();
      return;
    }

    if (!meta.runnable) {
      toast.error(
        `${meta.label} can be edited here, but the canvas has no ${meta.label} runtime — only JavaScript and Python execute.`,
      );
      return;
    }

    editorRef.current?.clearErrors();
    setChunks([]);
    setResult(null);
    /* Below @3xl only one pane is on screen, so a run that printed to an
       invisible Output looks like nothing happened. This also makes Pyodide's
       "booting" message visible on a first Python run, which is the only
       feedback during a ~13MB download. No-op above the breakpoint, where the
       tab strip is hidden and Output is already on screen. */
    setTab('output');

    const code = editorRef.current?.getValue() ?? '';

    const outcome = await run(language, code, timeoutMs, (chunk) =>
      setChunks((prev) => [...prev, chunk]),
    );

    setResult(outcome);
    setShowOutput(true);

    if (outcome.error?.line) {
      editorRef.current?.markError(
        outcome.error.line,
        `${outcome.error.name}: ${outcome.error.message}`,
      );
    }
  }, [running, cancel, meta, language, timeoutMs, run]);

  const handleAssist = useCallback(
    (instruction?: string) => {
      setShowAssist(true);
      setTab('assist');
      void ask({
        language,
        code: editorRef.current?.getValue() ?? '',
        selection: editorRef.current?.getSelection() || undefined,
        errorText,
        instruction,
      });
    },
    [ask, language, errorText],
  );

  const compact = surface !== 'page';

  if (!contents) {
    return (
      <div className="flex h-full items-center justify-center bg-light-primary dark:bg-dark-primary">
        <Loader2
          size={18}
          className="animate-spin text-black/40 dark:text-white/40"
        />
      </div>
    );
  }

  return (
    /* @container/canvas: every breakpoint below measures THIS box, not the
       viewport, so the page, the ~720px floating panel and the floating bar
       each get the layout that actually fits them. */
    <div className="@container/canvas flex h-full min-h-0 flex-col bg-light-primary dark:bg-dark-primary">
      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-light-200 dark:border-dark-200',
          compact ? 'px-2 py-1.5' : 'px-3 py-2',
        )}
      >
        <div className="min-w-0 flex-1 basis-28 @sm/canvas:flex-none @sm/canvas:basis-auto @sm/canvas:w-[132px]">
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value as CanvasLanguage)}
            className="!py-1.5 !text-xs"
            options={CANVAS_LANGUAGES.map((l) => ({
              value: l.id,
              label: l.runnable ? l.label : `${l.label} (editor only)`,
            }))}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={!meta.runnable && !running}
          title={
            meta.runnable
              ? 'Run (⌘↵)'
              : `No ${meta.label} runtime — JavaScript and Python only`
          }
          className={cn(
            'flex items-center gap-x-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition duration-200',
            running
              ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-[#ff7b72]'
              : 'bg-accent text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {running ? <Square size={13} /> : <Play size={13} />}
          {running ? 'Stop' : 'Run'}
        </button>

        <div className="w-[74px] shrink-0">
          <Select
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value))}
            className="!py-1.5 !text-xs"
            options={TIMEOUTS.map((t) => ({ value: t.value, label: t.label }))}
          />
        </div>

        <button
          onClick={() => handleAssist()}
          title="Ask the model about this buffer (⌘I)"
          className="flex items-center gap-x-1.5 rounded-lg border border-light-200 px-2.5 py-1.5 text-xs text-black/70 transition duration-200 hover:bg-light-200 dark:border-dark-200 dark:text-white/70 dark:hover:bg-dark-200"
        >
          <Sparkles size={13} className="text-accent" />
          {errorText ? 'Explain error' : 'Assist'}
        </button>

        <div className="ml-auto flex items-center gap-x-1">
          <span
            className={cn(
              'mr-1 text-[11px] transition-opacity duration-300',
              saveState === 'error'
                ? 'text-red-500'
                : 'text-black/35 dark:text-white/35',
              saveState === 'idle' && 'opacity-0',
            )}
          >
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved'
                : saveState === 'error'
                  ? 'Not saved'
                  : ''}
          </span>

          {/* Split-pane toggles only make sense where there are splits; the
              tab strip below the toolbar does this job under @3xl. */}
          <button
            onClick={() => setShowOutput((v) => !v)}
            title="Toggle output pane"
            className={cn(
              'hidden rounded p-1.5 transition duration-200 hover:bg-light-200 @3xl/canvas:block dark:hover:bg-dark-200',
              showOutput
                ? 'text-black/70 dark:text-white/70'
                : 'text-black/35 dark:text-white/35',
            )}
          >
            <PanelBottom size={15} />
          </button>

          <button
            onClick={() => setShowAssist((v) => !v)}
            title="Toggle assist pane"
            className={cn(
              'hidden rounded p-1.5 transition duration-200 hover:bg-light-200 @3xl/canvas:block dark:hover:bg-dark-200',
              showAssist
                ? 'text-black/70 dark:text-white/70'
                : 'text-black/35 dark:text-white/35',
            )}
          >
            <PanelRight size={15} />
          </button>
        </div>
      </div>

      {/* Tabs replace the split panes below @3xl. Selecting a tab only
          toggles visibility — no pane is ever unmounted, so the editor keeps
          its buffer, undo history and scroll position, and a reply can carry
          on streaming into an assist pane that is off screen. */}
      <div
        role="tablist"
        aria-label="Canvas panes"
        className="flex shrink-0 items-stretch border-b border-light-200 @3xl/canvas:hidden dark:border-dark-200"
      >
        {PANES.map((pane) => (
          <button
            key={pane.id}
            role="tab"
            aria-selected={tab === pane.id}
            onClick={() => setTab(pane.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-x-1.5 border-b-2 px-2 py-2.5 text-xs transition duration-200',
              tab === pane.id
                ? 'border-accent text-black/80 dark:text-white/80'
                : 'border-transparent text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/70',
            )}
          >
            <pane.icon size={14} />
            {pane.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        <SplitPane
          orientation="horizontal"
          initial={62}
          min={30}
          max={85}
          collapsed={!showAssist}
          className="h-full"
          firstClassName={cn(tab === 'assist' && 'hidden')}
          secondClassName={cn(tab !== 'assist' && 'hidden')}
        >
          <SplitPane
            orientation="vertical"
            initial={compact ? 55 : 66}
            min={20}
            max={90}
            collapsed={!showOutput}
            className="h-full"
            firstClassName={cn(tab !== 'code' && 'hidden')}
            secondClassName={cn(tab !== 'output' && 'hidden')}
          >
            {/* Keyed on language so switching files remounts the editor with
                that buffer's contents and its own undo history. */}
            <Editor
              key={language}
              ref={editorRef}
              language={language}
              initialDoc={contents[language]}
              onChange={(value) => update(language, value)}
              onRun={handleRun}
              onAssist={() => handleAssist()}
            />

            <Output
              chunks={chunks}
              result={result}
              running={running}
              bootMessage={bootMessage}
              onClear={() => {
                setChunks([]);
                setResult(null);
                editorRef.current?.clearErrors();
              }}
              onJumpToLine={(line, column) =>
                editorRef.current?.revealLine(line, column)
              }
            />
          </SplitPane>

          <AssistPane
            exchanges={exchanges}
            streaming={streaming}
            onStop={stop}
            onClear={clear}
            onAsk={(instruction) => handleAssist(instruction)}
            onReplace={(code) => editorRef.current?.replaceAll(code)}
            onInsert={(code) => editorRef.current?.insertAtCursor(code)}
            hint={
              errorText
                ? 'Press Assist to send the buffer and the error above to the model.'
                : 'Select code and press ⌘I, or ask a question below.'
            }
          />
        </SplitPane>
      </div>

      {/* The execution sandboxes.
          sandbox="allow-scripts" without allow-same-origin puts each frame on
          an opaque origin: it cannot read this page, its storage, or the app's
          API routes — which matters, because config.json holds model API keys.
          Kept off-screen rather than display:none so nothing throttles them. */}
      <iframe
        ref={jsFrame}
        title="JavaScript sandbox"
        src="/api/canvas/sandbox/js"
        sandbox="allow-scripts"
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 border-0 opacity-0"
      />
      <iframe
        ref={pyFrame}
        title="Python sandbox"
        src="/api/canvas/sandbox/py"
        sandbox="allow-scripts"
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 border-0 opacity-0"
      />
    </div>
  );
};

export default Canvas;
