import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

/* CodeMirror theme for the canvas.
 *
 * Every colour here is lifted value-for-value from the app's existing
 * highlighter themes (src/components/MessageRenderer/CodeBlock/CodeBlock{Dark,
 * Light}Theme.ts) so a snippet looks identical whether it is sitting in a chat
 * answer or open in the editor. The mapping is hljs token -> Lezer tag; where
 * hljs is coarser than Lezer (its `variable` covers things Lezer splits four
 * ways) the palette entry is applied to the Lezer tags that read the same way,
 * and plain identifiers are deliberately left on the base foreground so the
 * buffer does not turn into confetti.
 *
 * The app has no monospace token — there is no code editing anywhere else — so
 * the stack is defined here.
 */

export const MONO_STACK =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

type Palette = {
  bg: string;
  fg: string;
  border: string;
  comment: string;
  salmon: string; // hljs variable/tag/name/regexp/deletion
  yellow: string; // hljs number/built_in/literal/type/params/meta/link
  blue: string; // hljs attribute
  green: string; // hljs string/symbol/bullet/addition
  title: string; // hljs title/section
  keyword: string; // hljs keyword/selector-tag
  gutter: string;
  activeLine: string;
  selection: string;
};

const DARK: Palette = {
  bg: '#0d1117',
  fg: '#c9d1d9',
  border: '#21262d',
  comment: '#8b949e',
  salmon: '#ff7b72',
  yellow: '#f2cc60',
  blue: '#58a6ff',
  green: '#7ee787',
  title: '#79c0ff',
  keyword: '#c297ff',
  gutter: '#6e7681',
  activeLine: '#161b22',
  selection: 'rgba(36, 160, 237, 0.28)',
};

const LIGHT: Palette = {
  bg: '#ffffff',
  fg: '#24292f',
  border: '#e8edf1',
  comment: '#6e7781',
  salmon: '#d73a49',
  yellow: '#b08800',
  blue: '#0a64ae',
  green: '#22863a',
  title: '#005cc5',
  keyword: '#6f42c1',
  gutter: '#8c959f',
  activeLine: '#f6f8fa',
  selection: 'rgba(36, 160, 237, 0.20)',
};

const highlightFor = (p: Palette) =>
  HighlightStyle.define([
    {
      tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
      color: p.comment,
      fontStyle: 'italic',
    },
    { tag: [t.quote], color: p.comment },

    {
      tag: [
        t.keyword,
        t.moduleKeyword,
        t.controlKeyword,
        t.operatorKeyword,
        t.definitionKeyword,
        t.self,
      ],
      color: p.keyword,
    },

    { tag: [t.string, t.special(t.string), t.character], color: p.green },
    { tag: [t.inserted], color: p.green },

    { tag: [t.number, t.bool, t.null, t.atom, t.literal], color: p.yellow },
    {
      tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)],
      color: p.yellow,
    },
    { tag: [t.meta, t.annotation, t.url, t.link], color: p.yellow },

    { tag: [t.propertyName, t.attributeName], color: p.blue },

    {
      tag: [t.tagName, t.regexp, t.escape, t.deleted, t.angleBracket],
      color: p.salmon,
    },

    {
      tag: [
        t.function(t.variableName),
        t.function(t.propertyName),
        t.definition(t.function(t.variableName)),
        t.heading,
      ],
      color: p.title,
    },

    {
      tag: [
        t.operator,
        t.punctuation,
        t.separator,
        t.bracket,
        t.paren,
        t.brace,
        t.squareBracket,
      ],
      color: p.fg,
    },
    { tag: [t.variableName, t.definition(t.variableName)], color: p.fg },

    { tag: [t.invalid], color: '#ff7b72', textDecoration: 'underline wavy' },
    { tag: [t.emphasis], fontStyle: 'italic' },
    { tag: [t.strong], fontWeight: 'bold' },
  ]);

const baseFor = (p: Palette, dark: boolean) =>
  EditorView.theme(
    {
      '&': {
        color: p.fg,
        backgroundColor: p.bg,
        height: '100%',
        fontSize: '13px',
      },
      '.cm-scroller': {
        fontFamily: MONO_STACK,
        lineHeight: '1.6',
        overflow: 'auto',
      },
      '.cm-content': { caretColor: '#24A0ED', padding: '12px 0' },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: '#24A0ED',
        borderLeftWidth: '2px',
      },

      /* CodeMirror paints its own selection layer; the native ::selection has
         to be neutralised or the two stack into an opaque block. */
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: p.selection },

      '.cm-activeLine': { backgroundColor: p.activeLine },
      '.cm-activeLineGutter': { backgroundColor: p.activeLine, color: p.fg },

      '.cm-gutters': {
        backgroundColor: p.bg,
        color: p.gutter,
        border: 'none',
        borderRight: `1px solid ${p.border}`,
        paddingRight: '4px',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 6px 0 12px',
        minWidth: '2.5ch',
      },
      '.cm-foldGutter .cm-gutterElement': { padding: '0 2px' },

      '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
        backgroundColor: 'rgba(36, 160, 237, 0.20)',
        outline: `1px solid ${p.blue}`,
      },
      '.cm-nonmatchingBracket': { outline: `1px solid ${p.salmon}` },

      '.cm-tooltip': {
        backgroundColor: dark ? '#161b22' : '#f6f8fa',
        border: `1px solid ${p.border}`,
        borderRadius: '8px',
        color: p.fg,
        fontFamily: MONO_STACK,
        fontSize: '12px',
      },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: dark ? '#21262d' : '#e8edf1',
        color: p.fg,
      },

      /* Lint underline for a runtime error mapped back from the sandbox. */
      '.cm-lintRange-error': {
        backgroundImage: 'none',
        borderBottom: `2px wavy ${p.salmon}`,
        textDecoration: `underline wavy ${p.salmon}`,
      },
      '.cm-lint-marker-error': { content: 'none' },
      '.cm-panels': {
        backgroundColor: dark ? '#161b22' : '#f6f8fa',
        color: p.fg,
      },
      '.cm-searchMatch': { backgroundColor: 'rgba(242, 204, 96, 0.30)' },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'rgba(36, 160, 237, 0.40)',
      },
    },
    { dark },
  );

/* Two fully-built extension sets, resolved once at module load rather than per
   render — rebuilding a HighlightStyle on every theme read would rebuild the
   editor's style sheet with it. */
export const CANVAS_THEME: Record<'dark' | 'light', Extension> = {
  dark: [baseFor(DARK, true), syntaxHighlighting(highlightFor(DARK))],
  light: [baseFor(LIGHT, false), syntaxHighlighting(highlightFor(LIGHT))],
};

export const PALETTE = { dark: DARK, light: LIGHT };
