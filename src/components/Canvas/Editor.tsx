'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useTheme } from 'next-themes';
import {
  Compartment,
  EditorState,
  Prec,
  type Extension,
} from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { lintKeymap, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';

import { CANVAS_THEME } from './theme';
import type { CanvasLanguage } from '@/lib/canvas/types';

export type EditorHandle = {
  getValue: () => string;
  /* The current selection, or '' when the cursor is just sitting somewhere.
     The assist flow uses this to decide between "explain this bit" and
     "look at the whole file". */
  getSelection: () => string;
  replaceAll: (text: string) => void;
  insertAtCursor: (text: string) => void;
  focus: () => void;
  revealLine: (line: number, column?: number) => void;
  markError: (line: number, message: string) => void;
  clearErrors: () => void;
};

const LANGUAGE_EXTENSION: Record<CanvasLanguage, () => Extension> = {
  javascript: () => javascript(),
  python: () => python(),
  cpp: () => cpp(),
  java: () => java(),
};

const Editor = forwardRef<
  EditorHandle,
  {
    language: CanvasLanguage;
    initialDoc: string;
    onChange: (value: string) => void;
    onRun: () => void;
    onAssist: () => void;
  }
>(({ language, initialDoc, onChange, onRun, onAssist }, ref) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { resolvedTheme } = useTheme();

  /* Callbacks are read through a ref so the CodeMirror view can be built once
     and never torn down. Rebuilding it on every parent render would drop the
     cursor, the undo history and the fold state on each keystroke. */
  const handlers = useRef({ onChange, onRun, onAssist });
  handlers.current = { onChange, onRun, onAssist };

  const languageComp = useMemo(() => new Compartment(), []);
  const themeComp = useMemo(() => new Compartment(), []);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        EditorView.lineWrapping,

        /* Highest precedence so the canvas bindings win over CodeMirror's
           defaults — Mod-Enter would otherwise insert a blank line. */
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              preventDefault: true,
              run: () => {
                handlers.current.onRun();
                return true;
              },
            },
            {
              key: 'Mod-i',
              preventDefault: true,
              run: () => {
                handlers.current.onAssist();
                return true;
              },
            },
          ]),
        ),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),

        languageComp.of(LANGUAGE_EXTENSION[language]()),
        themeComp.of(CANVAS_THEME.dark),

        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handlers.current.onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: hostRef.current });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    /* Built once. `initialDoc` and `language` are seeds; later changes are
       pushed through the effects below. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: languageComp.reconfigure(LANGUAGE_EXTENSION[language]()),
    });
  }, [language, languageComp]);

  /* next-themes resolves on the client only, so the first paint uses the dark
     seed above and this corrects it. Same shape as the CodeBlock component's
     mounted guard — without it the server and client disagree on the theme. */
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeComp.reconfigure(
        resolvedTheme === 'light' ? CANVAS_THEME.light : CANVAS_THEME.dark,
      ),
    });
  }, [resolvedTheme, themeComp]);

  useImperativeHandle(
    ref,
    (): EditorHandle => ({
      getValue: () => viewRef.current?.state.doc.toString() ?? '',
      getSelection: () => {
        const view = viewRef.current;
        if (!view) return '';
        const { from, to } = view.state.selection.main;
        return from === to ? '' : view.state.sliceDoc(from, to);
      },
      replaceAll: (text) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
        });
        view.focus();
      },
      insertAtCursor: (text) => {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
      focus: () => viewRef.current?.focus(),
      revealLine: (line, column = 1) => {
        const view = viewRef.current;
        if (!view) return;
        const lineNo = Math.min(Math.max(1, line), view.state.doc.lines);
        const target = view.state.doc.line(lineNo);
        const pos = Math.min(target.from + Math.max(0, column - 1), target.to);
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: 'center' }),
        });
        view.focus();
      },
      markError: (line, message) => {
        const view = viewRef.current;
        if (!view) return;
        const lineNo = Math.min(Math.max(1, line), view.state.doc.lines);
        const target = view.state.doc.line(lineNo);
        const diagnostics: Diagnostic[] = [
          { from: target.from, to: target.to, severity: 'error', message },
        ];
        view.dispatch(setDiagnostics(view.state, diagnostics));
      },
      clearErrors: () => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch(setDiagnostics(view.state, []));
      },
    }),
    [],
  );

  return <div ref={hostRef} className="h-full w-full overflow-hidden" />;
});

Editor.displayName = 'CanvasEditor';

export default Editor;
