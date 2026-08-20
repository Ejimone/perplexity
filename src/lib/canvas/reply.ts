/* Parsing for assistant replies in the coding canvas.
 *
 * Lives here rather than inside AssistPane.tsx for two reasons: it is pure,
 * and the project's vitest setup only picks up src/**\/*.test.ts in a node
 * environment — logic buried in a .tsx component cannot be covered.
 */

export type ReplySegment =
  | { kind: 'text'; value: string }
  | { kind: 'code'; language: string; value: string; complete: boolean };

/* Split a reply into prose and fenced code.
 *
 * Done by hand rather than through markdown-to-jsx overrides because each code
 * block needs its own apply controls, and because this has to stay sane
 * mid-stream: the closing fence of the block currently being written has not
 * arrived yet, so the last block is routinely unterminated. An unterminated
 * block still renders — it just reports complete: false, and the UI withholds
 * Apply until it closes, since applying half a function is never what the user
 * meant. */
export const parseSegments = (markdown: string): ReplySegment[] => {
  const segments: ReplySegment[] = [];
  const fence = /```([\w+#-]*)[ \t]*\r?\n?/g;

  let cursor = 0;

  while (cursor < markdown.length) {
    fence.lastIndex = cursor;
    const open = fence.exec(markdown);

    if (!open) {
      const rest = markdown.slice(cursor);
      if (rest.trim()) segments.push({ kind: 'text', value: rest });
      break;
    }

    if (open.index > cursor) {
      const before = markdown.slice(cursor, open.index);
      if (before.trim()) segments.push({ kind: 'text', value: before });
    }

    const bodyStart = open.index + open[0].length;
    const close = markdown.indexOf('```', bodyStart);

    if (close === -1) {
      segments.push({
        kind: 'code',
        language: open[1] || '',
        value: markdown.slice(bodyStart),
        complete: false,
      });
      break;
    }

    segments.push({
      kind: 'code',
      language: open[1] || '',
      value: markdown.slice(bodyStart, close).replace(/\r?\n$/, ''),
      complete: true,
    });
    cursor = close + 3;
  }

  return segments;
};

/* Some models stream their reasoning inline as <think>…</think> — the Groq
 * models reached through the OpenAI-compatible surface do, for one. The chat
 * pipeline never sees this because it carries reasoning as a separate block
 * type, so there is nothing existing to reuse. Here the reasoning is simply
 * hidden: the pane is narrow, and the user asked about their code, not about
 * how the model got there. An unclosed tag means it is still reasoning, so
 * everything after it stays hidden until the tag closes. */
export const splitReasoning = (markdown: string) => {
  const closed = markdown.replace(/<think>[\s\S]*?<\/think>\s*/gi, '');
  const open = closed.search(/<think>/i);
  return open === -1
    ? { visible: closed, reasoning: false }
    : { visible: closed.slice(0, open), reasoning: true };
};
