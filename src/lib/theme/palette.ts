/* The single source of truth for every colour in the app.
 *
 * This file had three copies before: tailwind.config.ts defined the light and
 * dark ramps, src/components/Canvas/theme.ts re-declared the same hex values
 * for CodeMirror plus the syntax colours, and
 * src/components/MessageRenderer/CodeBlock/CodeBlock{Dark,Light}Theme.ts
 * declared those syntax colours a third time for highlight.js. They agreed by
 * hand and would have drifted.
 *
 * Everything now derives from here. Note the import constraint: tailwind.config.ts
 * loads this by RELATIVE path, because the `@/` alias is a tsconfig/webpack
 * concern and Tailwind's own config loader does not resolve it. Keep this file
 * free of imports and of anything but plain data for that reason.
 */

/* Page background, cards, borders. GitHub-derived. The numeric keys are the
   Tailwind scale; `primary` and `secondary` are aliases for 50 and 100 that
   the existing markup uses heavily (bg-dark-primary, bg-light-secondary). */
export type Ramp = {
  50: string;
  100: string;
  200: string;
  300: string;
};

export const RAMP: Record<'dark' | 'light', Ramp> = {
  dark: {
    50: '#0d1117',
    100: '#161b22',
    200: '#21262d',
    300: '#30363d',
  },
  light: {
    50: '#ffffff',
    100: '#f6f8fa',
    200: '#e8edf1',
    300: '#d0d7de',
  },
};

/* The app's accent. Previously hardcoded 33 times across 12 files -- 29 as
   Tailwind arbitrary values, plus four rgba() encodings of the same colour in
   the CodeMirror theme. `hover` was a second undocumented shade that only
   appeared in the Setup flow. */
export const ACCENT = {
  DEFAULT: '#24A0ED',
  hover: '#1e8fd1',
  /* rgb() channels, so alpha variants can be composed without re-encoding the
     hex. Used by the CodeMirror theme, which takes CSS strings, not classes. */
  rgb: '36, 160, 237',
} as const;

export const accentAlpha = (alpha: number) =>
  `rgba(${ACCENT.rgb}, ${alpha.toFixed(2)})`;

/* Syntax highlighting. Keys are named for the hljs token class they came
   from, because that mapping is what keeps a snippet looking identical in a
   chat answer and in the canvas editor. */
export type SyntaxPalette = {
  fg: string;
  comment: string;
  salmon: string; // hljs variable/tag/name/regexp/deletion
  yellow: string; // hljs number/built_in/literal/type/params/meta/link
  blue: string; // hljs attribute
  green: string; // hljs string/symbol/bullet/addition
  title: string; // hljs title/section
  keyword: string; // hljs keyword/selector-tag
  gutter: string;
  searchMatch: string;
};

export const SYNTAX: Record<'dark' | 'light', SyntaxPalette> = {
  dark: {
    fg: '#c9d1d9',
    comment: '#8b949e',
    salmon: '#ff7b72',
    yellow: '#f2cc60',
    blue: '#58a6ff',
    green: '#7ee787',
    title: '#79c0ff',
    keyword: '#c297ff',
    gutter: '#6e7681',
    searchMatch: 'rgba(242, 204, 96, 0.30)',
  },
  light: {
    fg: '#24292f',
    comment: '#6e7781',
    salmon: '#d73a49',
    yellow: '#b08800',
    blue: '#0a64ae',
    green: '#22863a',
    title: '#005cc5',
    keyword: '#6f42c1',
    gutter: '#8c959f',
    searchMatch: 'rgba(242, 204, 96, 0.30)',
  },
};

/* Editor chrome, derived from the ramp rather than restated. The selection
   tint is the accent at low alpha, which is why it lives here and not in
   SYNTAX. */
export type EditorPalette = {
  bg: string;
  border: string;
  activeLine: string;
  surface: string;
  selected: string;
  selection: string;
};

export const EDITOR: Record<'dark' | 'light', EditorPalette> = {
  dark: {
    bg: RAMP.dark[50],
    border: RAMP.dark[200],
    activeLine: RAMP.dark[100],
    surface: RAMP.dark[100],
    selected: RAMP.dark[200],
    selection: accentAlpha(0.28),
  },
  light: {
    bg: RAMP.light[50],
    border: RAMP.light[200],
    activeLine: RAMP.light[100],
    surface: RAMP.light[100],
    selected: RAMP.light[200],
    selection: accentAlpha(0.2),
  },
};

/* The app has no monospace token elsewhere -- the canvas is the only place
   code is edited -- so the stack is defined once, here. */
export const MONO_STACK =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
