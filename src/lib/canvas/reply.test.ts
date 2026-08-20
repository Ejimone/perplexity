import { describe, expect, it } from 'vitest';
import { parseSegments, splitReasoning } from './reply';

/* These two functions run on every streamed token, against text that is
 * usually incomplete. The canvas gates its "Replace buffer" and "Insert at
 * cursor" buttons on parseSegments reporting complete: true — so a bug that
 * marks a half-written block complete would let the user overwrite their file
 * with a truncated function. */

describe('parseSegments', () => {
  it('returns prose as a single text segment', () => {
    expect(parseSegments('Just an explanation.')).toEqual([
      { kind: 'text', value: 'Just an explanation.' },
    ]);
  });

  it('extracts a fenced block with its language', () => {
    const out = parseSegments('Here:\n\n```python\nprint(1)\n```\n');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: 'text' });
    expect(out[1]).toEqual({
      kind: 'code',
      language: 'python',
      value: 'print(1)',
      complete: true,
    });
  });

  it('marks an unterminated block incomplete — this is the mid-stream case', () => {
    const out = parseSegments('Fixing it:\n\n```js\nconst a = 1;\nconst b =');
    const code = out.find((s) => s.kind === 'code');
    expect(code).toMatchObject({
      complete: false,
      value: 'const a = 1;\nconst b =',
    });
  });

  it('handles several blocks with prose between them', () => {
    const out = parseSegments('One\n```js\na\n```\nTwo\n```js\nb\n```\nThree');
    expect(out.map((s) => s.kind)).toEqual([
      'text',
      'code',
      'text',
      'code',
      'text',
    ]);
    expect(out.filter((s) => s.kind === 'code').every((s) => s.complete)).toBe(
      true,
    );
  });

  it('tolerates a fence with no language tag', () => {
    const [block] = parseSegments('```\nplain\n```');
    expect(block).toMatchObject({ kind: 'code', language: '', value: 'plain' });
  });

  it('keeps blank lines inside a block but trims the trailing newline', () => {
    const [block] = parseSegments('```js\na\n\nb\n```');
    expect(block).toMatchObject({ value: 'a\n\nb' });
  });

  it('drops whitespace-only prose rather than emitting empty segments', () => {
    const out = parseSegments('\n\n```js\na\n```\n\n   \n');
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('code');
  });

  it('accepts languages with punctuation, like c++ and c#', () => {
    expect(parseSegments('```c++\nint a;\n```')[0]).toMatchObject({
      language: 'c++',
    });
    expect(parseSegments('```c#\nint a;\n```')[0]).toMatchObject({
      language: 'c#',
    });
  });

  it('returns nothing for an empty reply', () => {
    expect(parseSegments('')).toEqual([]);
  });
});

describe('splitReasoning', () => {
  it('leaves an ordinary reply untouched', () => {
    expect(splitReasoning('The bug is on line 3.')).toEqual({
      visible: 'The bug is on line 3.',
      reasoning: false,
    });
  });

  it('removes a closed reasoning block', () => {
    const { visible, reasoning } = splitReasoning(
      '<think>weighing options</think>\nThe answer.',
    );
    expect(visible).toBe('The answer.');
    expect(reasoning).toBe(false);
  });

  it('hides everything after an unclosed tag and reports it is still thinking', () => {
    const { visible, reasoning } = splitReasoning('Intro.\n<think>still going');
    expect(visible).toBe('Intro.\n');
    expect(reasoning).toBe(true);
  });

  it('does not leak a code fence that only exists inside the reasoning', () => {
    /* Otherwise the pane would offer an Apply button for code the model was
       only considering. */
    const { visible } = splitReasoning(
      '<think>maybe ```js\nbad()\n```</think>Use this.',
    );
    expect(visible).toBe('Use this.');
    expect(parseSegments(visible).some((s) => s.kind === 'code')).toBe(false);
  });

  it('strips multiple reasoning blocks', () => {
    const { visible } = splitReasoning(
      '<think>a</think>One. <think>b</think>Two.',
    );
    expect(visible).toBe('One. Two.');
  });
});
