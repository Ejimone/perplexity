import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';
import {
  ACCENT,
  accentAlpha,
  EDITOR,
  type EditorPalette,
  MONO_STACK,
  SYNTAX,
  type SyntaxPalette,
} from '@/lib/theme/palette';

/* CodeMirror theme for the canvas.
 *
 * Every colour is derived from src/lib/theme/palette.ts, which also feeds
 * tailwind.config.ts and the chat highlighter themes -- so a snippet looks
 * identical whether it is sitting in a chat answer or open in the editor, and
 * the three can no longer drift apart. The mapping here is hljs token -> Lezer
 * tag; where hljs is coarser than Lezer (its `variable` covers things Lezer
 * splits four ways) the palette entry is applied to the Lezer tags that read
 * the same way, and plain identifiers are deliberately left on the base
 * foreground so the buffer does not turn into confetti.
 */

/* Re-exported: Output.tsx and AssistPane.tsx import it from here. */
export { MONO_STACK };

type Palette = SyntaxPalette & EditorPalette;

const DARK: Palette = { ...SYNTAX.dark, ...EDITOR.dark };
const LIGHT: Palette = { ...SYNTAX.light, ...EDITOR.light };

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

    { tag: [t.invalid], color: p.salmon, textDecoration: 'underline wavy' },
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
      '.cm-content': { caretColor: ACCENT.DEFAULT, padding: '12px 0' },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: ACCENT.DEFAULT,
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
        backgroundColor: accentAlpha(0.2),
        outline: `1px solid ${p.blue}`,
      },
      '.cm-nonmatchingBracket': { outline: `1px solid ${p.salmon}` },

      '.cm-tooltip': {
        backgroundColor: p.surface,
        border: `1px solid ${p.border}`,
        borderRadius: '8px',
        color: p.fg,
        fontFamily: MONO_STACK,
        fontSize: '12px',
      },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: p.selected,
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
        backgroundColor: p.surface,
        color: p.fg,
      },
      '.cm-searchMatch': { backgroundColor: p.searchMatch },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: accentAlpha(0.4),
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
