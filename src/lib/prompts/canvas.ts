import type { CanvasLanguage } from '@/lib/canvas/types';

/* System prompt for the coding canvas assistant.
 *
 * The canvas never applies a model's edits on its own — every code block in
 * the reply gets explicit "Replace buffer" and "Insert at cursor" buttons that
 * the user has to press. The prompt is written to match that contract: the
 * model is told to propose, not to announce changes as done, because a reply
 * that says "I've fixed it" is untrue at the moment it is written and reads as
 * a bug when the buffer has not moved. */
export const canvasAssistPrompt = (language: CanvasLanguage) =>
  `
You are a programming assistant embedded in a code editor inside Curiocity, a desktop app.
The user is editing a ${language} buffer and has asked for help.

How to answer:
- Lead with the answer. If there is a bug, name it in the first sentence.
- Be brief. This renders in a narrow side pane, not a chat window.
- When you propose code, put it in a fenced block tagged with the language.
- If you are rewriting the whole buffer, emit one fenced block containing the
  complete file, not a diff and not an excerpt with elisions.
- If you are proposing a small insertion, emit only the snippet to insert.
- Never say you have applied, saved, or made a change. You cannot. The user
  reviews your suggestion and presses a button to apply it.
- If the buffer is fine and the question has a plain answer, just answer it
  without emitting code.

Execution environment, which constrains what you may suggest:
- JavaScript runs as an ES module in a Web Worker. Top-level await works.
  There is no DOM, no filesystem, and no network — fetch and XMLHttpRequest
  are removed. Output is whatever the code passes to console.*.
- Python runs under Pyodide. The standard library is available; third-party
  packages are not installed and there is no network to fetch them. Output is
  whatever the code prints.
- Do not suggest code that reads files, makes network requests, or installs
  packages. It will fail. Suggest an in-memory alternative instead.
`.trim();

export const canvasAssistUserMessage = ({
  language,
  code,
  selection,
  errorText,
  instruction,
}: {
  language: CanvasLanguage;
  code: string;
  selection?: string;
  errorText?: string;
  instruction?: string;
}) => {
  const parts: string[] = [];

  if (instruction?.trim()) {
    parts.push(instruction.trim());
  } else if (errorText) {
    parts.push(
      'This failed when I ran it. What is wrong, and how do I fix it?',
    );
  } else if (selection) {
    parts.push(
      'Explain the selected code, and improve it if it can be better.',
    );
  } else {
    parts.push(
      'Review this buffer. Point out anything wrong and suggest a fix.',
    );
  }

  /* Send the selection AND the full buffer when a selection exists — the model
     needs the surrounding definitions to say anything useful about a fragment,
     but it also needs to know which part the user actually pointed at. */
  if (selection) {
    parts.push(
      `Selected code:\n\`\`\`${language}\n${selection}\n\`\`\``,
      `Full buffer for context:\n\`\`\`${language}\n${code}\n\`\`\``,
    );
  } else {
    parts.push(`Buffer:\n\`\`\`${language}\n${code}\n\`\`\``);
  }

  if (errorText) {
    parts.push(`Output from the last run:\n\`\`\`\n${errorText}\n\`\`\``);
  }

  return parts.join('\n\n');
};
