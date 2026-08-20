import { describe, expect, it } from 'vitest';
import { canvasAssistPrompt, canvasAssistUserMessage } from './canvas';

describe('canvasAssistPrompt', () => {
  it('states the no-auto-apply contract the UI actually enforces', () => {
    /* The canvas never applies a suggestion on its own — the user presses
       Replace or Insert. A reply that says "I've fixed it" would be false at
       the moment it is written, and reads as a bug when the buffer has not
       moved. */
    const prompt = canvasAssistPrompt('javascript').replace(/\s+/g, ' ');
    expect(prompt).toMatch(/never say you have applied/i);
  });

  it('describes the sandbox limits so the model does not suggest dead code', () => {
    const js = canvasAssistPrompt('javascript').replace(/\s+/g, ' ');
    expect(js).toMatch(/no filesystem/i);
    expect(js).toMatch(/no network/i);

    const py = canvasAssistPrompt('python');
    expect(py).toMatch(/pyodide/i);
    /* The prompt is hand-wrapped, so assert across whitespace rather than on
       an exact line. */
    expect(py.replace(/\s+/g, ' ')).toMatch(
      /third-party packages are not installed/i,
    );
  });

  it('names the language being edited', () => {
    expect(canvasAssistPrompt('cpp')).toContain('cpp');
  });
});

describe('canvasAssistUserMessage', () => {
  const code = 'const a = 1;\nconsole.log(b);';

  it('sends the buffer alone when nothing is selected', () => {
    const msg = canvasAssistUserMessage({ language: 'javascript', code });
    expect(msg).toContain('```javascript\n' + code + '\n```');
    expect(msg).not.toMatch(/Selected code/);
  });

  it('sends the selection AND the full buffer when there is a selection', () => {
    /* A fragment on its own is not enough to say anything useful about it —
       the model needs the surrounding definitions — but it also has to know
       which part the user pointed at. */
    const msg = canvasAssistUserMessage({
      language: 'javascript',
      code,
      selection: 'console.log(b);',
    });
    expect(msg).toContain('Selected code:');
    expect(msg).toContain('Full buffer for context:');
    expect(msg).toContain('console.log(b);');
    expect(msg).toContain(code);
  });

  it('includes the run output when there is an error, and leads with it', () => {
    const msg = canvasAssistUserMessage({
      language: 'python',
      code,
      errorText: 'NameError: name "b" is not defined',
    });
    expect(msg.split('\n\n')[0]).toMatch(/failed when I ran it/i);
    expect(msg).toContain('Output from the last run:');
    expect(msg).toContain('NameError');
  });

  it('lets an explicit instruction win over the inferred question', () => {
    const msg = canvasAssistUserMessage({
      language: 'javascript',
      code,
      errorText: 'boom',
      instruction: 'Rewrite this using reduce.',
    });
    expect(msg.split('\n\n')[0]).toBe('Rewrite this using reduce.');
    /* The error is still attached — the instruction changes the question, not
       the evidence. */
    expect(msg).toContain('boom');
  });

  it('ignores a whitespace-only instruction', () => {
    const msg = canvasAssistUserMessage({
      language: 'javascript',
      code,
      instruction: '   ',
    });
    expect(msg.split('\n\n')[0]).toMatch(/Review this buffer/i);
  });

  it('tags fences with the buffer language', () => {
    expect(
      canvasAssistUserMessage({ language: 'cpp', code: 'int a;' }),
    ).toContain('```cpp');
  });
});
