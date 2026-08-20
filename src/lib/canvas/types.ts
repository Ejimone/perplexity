/* Shared vocabulary between the canvas UI, the sandbox workers and the assist
 * API route. Kept in src/lib so the server routes can import it without
 * reaching into src/components. */

export type CanvasLanguage = 'javascript' | 'python' | 'cpp' | 'java';

export const CANVAS_LANGUAGES: {
  id: CanvasLanguage;
  label: string;
  /* Only JS and Python have a sandboxed runtime. C++ and Java are editor-only
     — highlighting, folding and completion, but no Run. Compiling them would
     mean shipping a toolchain or sending source to a remote service, and this
     canvas deliberately does neither. The UI says so out loud rather than
     leaving a dead Run button. */
  runnable: boolean;
  /* Line-comment token, used to seed new buffers. */
  comment: string;
  starter: string;
}[] = [
  {
    id: 'javascript',
    label: 'JavaScript',
    runnable: true,
    comment: '//',
    starter: "console.log('hello from the canvas');\n",
  },
  {
    id: 'python',
    label: 'Python',
    runnable: true,
    comment: '#',
    starter: "print('hello from the canvas')\n",
  },
  {
    id: 'cpp',
    label: 'C++',
    runnable: false,
    comment: '//',
    starter:
      '#include <iostream>\n\nint main() {\n  std::cout << "hello" << std::endl;\n}\n',
  },
  {
    id: 'java',
    label: 'Java',
    runnable: false,
    comment: '//',
    starter:
      'class Main {\n  public static void main(String[] args) {\n    System.out.println("hello");\n  }\n}\n',
  },
];

export const languageMeta = (id: CanvasLanguage) =>
  CANVAS_LANGUAGES.find((l) => l.id === id) ?? CANVAS_LANGUAGES[0];

export type RunStatus = 'ok' | 'error' | 'timeout';

export type OutputChunk = {
  stream: 'stdout' | 'stderr';
  text: string;
};

/* `line`/`column` are 1-based and already mapped back to the user's buffer —
   the wrapper offsets the workers add are stripped before this crosses back. */
export type RunError = {
  name: string;
  message: string;
  line?: number;
  column?: number;
  traceback?: string;
};

export type RunResult = {
  status: RunStatus;
  chunks: OutputChunk[];
  error?: RunError;
  durationMs: number;
};

/* Messages the sandbox iframe posts back to the canvas. The iframe runs on an
   opaque origin, so `event.origin` is the string "null" and cannot be used to
   authenticate it — the canvas checks `event.source` against the iframe's
   contentWindow instead. */
export type SandboxMessage =
  | { type: 'ready' }
  | { type: 'chunk'; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'done'; status: RunStatus; error?: RunError; durationMs: number }
  | { type: 'boot'; message: string };
