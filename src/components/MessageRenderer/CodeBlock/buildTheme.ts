import type { CSSProperties } from 'react';
import { EDITOR, SYNTAX } from '@/lib/theme/palette';

/* Builds a react-syntax-highlighter (hljs) theme from the shared palette.
 *
 * The dark and light themes had identical key sets and differed only in their
 * hex values, and those values were the same ones the canvas editor uses. Both
 * now derive from src/lib/theme/palette.ts, so the chat highlighter and the
 * CodeMirror buffer cannot drift apart.
 *
 * The groupings below are the hljs token classes each palette entry was named
 * for -- see SyntaxPalette in the palette module. */
const buildTheme = (mode: 'dark' | 'light') => {
  const s = SYNTAX[mode];
  const e = EDITOR[mode];

  const group = (color: string, ...tokens: string[]) =>
    Object.fromEntries(tokens.map((token) => [token, { color }]));

  return {
    ...group(s.comment, 'hljs-comment', 'hljs-quote'),
    ...group(
      s.salmon,
      'hljs-variable',
      'hljs-template-variable',
      'hljs-tag',
      'hljs-name',
      'hljs-selector-id',
      'hljs-selector-class',
      'hljs-regexp',
      'hljs-deletion',
    ),
    ...group(
      s.yellow,
      'hljs-number',
      'hljs-built_in',
      'hljs-builtin-name',
      'hljs-literal',
      'hljs-type',
      'hljs-params',
      'hljs-meta',
      'hljs-link',
    ),
    ...group(s.blue, 'hljs-attribute'),
    ...group(
      s.green,
      'hljs-string',
      'hljs-symbol',
      'hljs-bullet',
      'hljs-addition',
    ),
    ...group(s.title, 'hljs-title', 'hljs-section'),
    ...group(s.keyword, 'hljs-keyword', 'hljs-selector-tag'),
    hljs: {
      display: 'block',
      overflowX: 'auto',
      background: e.bg,
      color: s.fg,
      padding: '0.75em',
      border: `1px solid ${e.border}`,
      borderRadius: '10px',
    },
    'hljs-emphasis': { fontStyle: 'italic' },
    'hljs-strong': { fontWeight: 'bold' },
  } satisfies Record<string, CSSProperties>;
};

export default buildTheme;
