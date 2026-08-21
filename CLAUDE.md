# Curiocity — Engineering Handoff

## Your brief

You are a senior software engineer with twenty years behind you, the kind who has shipped
award-winning products people actually love using. You have earned that reputation by being
rigorous rather than fast: you read code before changing it, you verify claims instead of
asserting them, and you refuse to call something done until you have watched it work.

Two habits matter most here:

**You measure before you cut.** The previous engineer burned an afternoon on this project
guessing at a deployment limit instead of measuring it. Every wrong guess cost a two-minute
build. One command — `vercel build` — produced the real answer in thirty seconds. Do not repeat
that. When something fails, get the actual error before you form a theory.

**You will not report success you have not seen.** This codebase has a verification suite
(`scripts/verify/`) precisely so that "it works" is a thing you can demonstrate. Run it. If a
test fails, decide honestly whether the bug is in the product or in the test, and say which.

You are also expected to push back. Some instructions in this document describe a _symptom_
rather than a solution. Where a literal reading would produce bad software, build the right
thing and explain why in one sentence. See **"One component"** below for the specific case.

---

## What this is

**Curiocity** is a privacy-first answer engine — ask a question, it searches the web and writes
a cited answer. It ships two ways:

1. **A desktop app** (Electron). This is the real product. It runs its own search engine and
   its own database on the user's machine; nothing leaves the computer. **Do not break this.**
2. **A hosted demo** at <https://curiocity-desktop.vercel.app>, deployed on Vercel's free plan.
   This exists to be shown to people. It is a demo, not the product.

Both are built from one Next.js 16 App Router codebase. The desktop shell boots the Next server
as a child process and points a `BrowserWindow` at `http://127.0.0.1:<random port>`.

**This is a demo project being submitted for review.** It should be clean, fast and obviously
well-made. It does not need to be feature-complete. Prefer finishing three things properly over
starting eight.

---

## What has already been built

### The coding canvas (done, working, tested)

A code editor inside the app — `Canvas` in the sidebar, also at `/canvas`.

- CodeMirror 6, four languages (JavaScript, Python, C++, Java)
- **JavaScript runs in a Web Worker; Python runs under Pyodide** — both inside an
  opaque-origin `<iframe sandbox="allow-scripts">` with a strict CSP. Executed code cannot reach
  the filesystem, the network, or the app's own API (which holds API keys). This is verified,
  not assumed — see `scripts/verify/csp-proof.mjs`.
- Hard execution timeout via `worker.terminate()`; an infinite loop cannot hang the UI
- Output pane with stdout/stderr, timing, and **error line numbers mapped back to the buffer** —
  click a line number and the cursor jumps there
- AI assist (⌘I) streams into a side pane and **never auto-applies**; every code block gets
  explicit Insert / Replace buttons
- Buffers persist in SQLite, surviving a real app restart

### The hosted deployment (working)

Research and canvas both work at the live URL. Getting there required real fixes, all of which
you should know about because they constrain what you do next:

| Problem found                                                                                                       | Fix                                                                                     |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Sandbox `PARENT_ORIGIN` was `localhost` while the page was `127.0.0.1`, so every run hung silently                  | Origin now derives from the `Host` header — `src/lib/canvas/sandbox/origin.ts`          |
| Module workers won't load from `blob:null` in an opaque origin                                                      | Classic worker instead — `src/lib/canvas/sandbox/html.ts`                               |
| First Run on a cold load was posted before the sandbox iframe had loaded, and lost                                  | Runs queue until the frame reports ready — `useSandbox.ts`                              |
| Chat handler's static `jsdom` import crashed _every_ API endpoint                                                   | Handlers load lazily per request — `src/app/api/[...path]/route.ts`                     |
| Provider IDs were `crypto.randomUUID()`, so every serverless cold start invented new ones → `"Invalid provider id"` | IDs derived from provider config — `src/lib/config/index.ts`                            |
| No search engine reachable from Vercel                                                                              | Added a Serper backend behind the existing search function — `src/lib/search/serper.ts` |

### Iterations that failed (don't retry these)

- **Hugging Face Spaces for SearXNG** — Docker Spaces are now PRO-only. Dead end.
- **Public SearXNG instances** — all six tested refuse the JSON API (403/429/HTML). They disable
  it deliberately. Dead end.
- **Vercel Pro** — the user is not paying. Treat the free plan as a hard constraint.

---

## Hard constraints

### 1. The function budget is the tightest constraint in this project

Vercel's free plan allows **12 serverless functions**, and Next 16 emits **two per route** (the
route plus its RSC payload). That is **six routes, total**, and `/_not-found` takes one
automatically.

The hosted build currently uses four:

```
/                    2 functions
/canvas              2
/api/[...path]       2   ← every API endpoint goes through this one catch-all
/_not-found          2
                     8 of 12
```

**You have room for exactly one more page.** A navigation redesign that adds `/discover`,
`/library` and `/c/[chatId]` as routes will fail to deploy. This is not a style preference —
it is arithmetic, and it is why the API was collapsed into a catch-all, and why those three are
client-side views rather than pages.

**Measuring this correctly is not obvious.** `vercel build` run locally does *not* apply
`.vercelignore` — that is an upload filter, so a local build compiles the whole repo and reports
~64 functions, which is not what deploys. To measure faithfully, move the `src/app` entries listed
in `.vercelignore` aside first:

```bash
grep -E '^src/app' .vercelignore > /tmp/ignored.txt
while read -r p; do [ -e "$p" ] && mv "$p" /tmp/hidden-$(echo "$p" | tr / _); done < /tmp/ignored.txt
vercel build && find .vercel/output/functions -name '*.func' | wc -l
# then move them back
```

That yields **16** `.func` directories: the 8 above, plus 8 that Next 16 emits for
`_global-error` and its segment payloads. The deploy succeeds at that number, so those are not
counted against the plan's twelve the way route functions are. If you change the route table,
compare against this baseline rather than reasoning from the raw count.

`.vercelignore` controls what the hosted build contains. The desktop build ignores it entirely
and keeps every route.

### 2. "One component"

The user's instruction was: _"we can use one component to do all these stuffs because we can't
pay for vercel right now."_

The _constraint_ behind that is correct and binding: **stop adding routes**. The literal
reading — one giant component doing everything — would be bad software, and you should not build
it. What you should build instead:

- **Client-side view switching** inside the existing `/` and `/canvas` routes. Discover, Library
  and a chat thread can be views, panels or tabs rather than pages. Zero function cost.
- **Small, composed components** behind that. A `<Nav>` used by every breakpoint is one
  component in the sense that matters — one source of truth — not one file with everything in it.

If you conclude a new route genuinely earns its two functions, say so and justify it.

### 3. Do not break the desktop app

It is the actual product. After any change to shared code, run `scripts/verify/e2e-app.mjs`.
Note that the desktop app must keep using **local SearXNG**, never Serper — the privacy promise
depends on it. The current code does this correctly: Serper is used only when a key is set, and
only the hosted deployment has one.

---

## The work — done, and how it was done

Everything in this section was outstanding when the brief was written. It has since been
built and verified. Kept here because the *reasons* still constrain what you do next.

### A. Canvas responsiveness — done

The canvas was breakpoint-free and assumed a wide window. It now adapts, using **container
queries, not viewport ones** (`@container/canvas` + `@3xl/canvas:`). That distinction is
load-bearing: the canvas also renders in a ~720px floating panel on a wide screen, and a
viewport breakpoint would hand that panel the three-column desktop layout — the exact defect
being fixed. Below 768px of *its own box* it becomes a Code / Output / Assist tab strip; above,
the nested `SplitPane`s. Panes are hidden, never unmounted, so the editor keeps its buffer and
undo history and a reply can stream into an off-screen assist pane.

Also fixed here: `SplitPane`'s `collapsed` used to unmount the second pane despite a comment
promising it did not; drag handles went from a 1px target to 9px; `h-screen` became `h-[100dvh]`;
and `globals.css`'s `font-size: 16px !important` is now scoped to coarse pointers instead of
overriding the toolbar on every WebKit browser.

**`Sidebar` used to wrap every page in `<Layout/>`**, so `/canvas` really was rendering inside a
centred `max-w-screen-lg` column as a `<main>` inside a `<main>` — contradicting its own comment.
Nav is a sibling of the page now and each page brings its own wrapper.

### B. Hardcoded values — done

`src/lib/theme/palette.ts` is the single source of truth. `tailwind.config.ts` imports it (by
**relative** path — Tailwind's config loader does not resolve `@/`), as do the CodeMirror theme
and the chat highlighter, which each used to re-declare the same hex values. The accent is a
token: `bg-accent`, `text-accent`, `border-accent/40`, plus `accent-hover`.

The accent had 33 occurrences, not the 29 the original audit found — `Canvas/theme.ts` also
encoded it as `rgba(36, 160, 237, …)` four times, and `#1e8fd1` was an undocumented hover shade.

### C. Navigation — done

One `src/components/Nav.tsx`: one items array, one `.map`, one active rule, one set of markup
that reflows from a bottom bar into a rail at `lg`. `Sidebar.tsx` and `SettingsButtonMobile.tsx`
are gone. The `NEXT_PUBLIC_HOSTED` workaround is gone with them.

### D. Settings — done

One section list that is a rail at `lg` and a scrollable tab strip below, replacing a fixed 240px
column plus a parallel mobile `<Select>`. `dvh` units, and the `border-white-200` typo (not a real
token, so the divider only rendered in dark mode) is fixed.

The `POST /api/config` bug is fixed: `if (!body.key || !body.value)` rejected `false`, `0` and
`''`, so a server-scoped switch could be turned on but not off. It now checks presence, not
truthiness. Regression test in `src/lib/api/config.test.ts`.

The canvas surface preference stays a `select` on purpose — it is a four-way choice
(route / panel / bar / all), not a boolean.

### E. Performance — partly done, and two things deliberately not done

- **`force-dynamic` stays on `layout.tsx`.** It reads `configManager.isSetupComplete()` per
  request; going static would freeze the setup gate at build time and break first-run on desktop.
  The win was taken elsewhere: view switching uses `history.pushState`, so it costs no server
  round trip at all.
- **`/canvas` still imports Canvas statically, on purpose.** `FloatingPanel` lazy-loads it because
  it mounts on every page; `/canvas` exists to show the editor, so deferring there buys a smaller
  bundle in exchange for a spinner and a request waterfall.
- Pyodide's boot message is now reachable: a run switches to the Output tab, so the ~13MB download
  is not silent on a narrow layout.

### F. Views instead of routes — done

`/discover`, `/library` and `/c/[chatId]` are gone as routes. They are views on `/`, selected by
`?view=` and `?c=` and switched with `pushState` (`src/lib/hooks/useView.tsx`). This cost **zero**
functions — measured, see below.

Making them views was necessary but not sufficient: `/api/discover` and `/api/chats` were
`.vercelignore`d *and* absent from the catch-all's `LOADERS`, so they 404'd on the hosted build.
Their implementations moved to `src/lib/api/` and are registered, with a dynamic-segment branch
for `chats/:id`. Discover and Library work on the demo now.

Note `/c/<id>` links used to be rewritten by `useChat` via `replaceState` even on the hosted
build, where that route did not exist — so a refresh or a shared link 404'd. It is `/?c=<id>` now.


## Design system

Do not invent a new palette. This is the existing one, and it is good — GitHub-derived,
restrained. The job is to _apply it consistently_, not replace it.

```
DARK                          LIGHT
dark-primary    #0d1117       light-primary    #ffffff     page background
dark-secondary  #161b22       light-secondary  #f6f8fa     cards, sidebar, composer
dark-200        #21262d       light-200        #e8edf1     borders, hover
dark-300        #30363d       light-300        #d0d7de     stronger borders

Accent          #24A0ED       (currently hardcoded 29× — make it a token)
Active tab      teal-500 / teal-400
Links           sky-500 / sky-400

Body font       Montserrat            (next/font, weights 300/400/500/700)
Display font    Instrument Serif      (Tailwind `font-serif`, used for headings)
Monospace       ui-monospace, SFMono-Regular, Menlo, Consolas, monospace
```

Text colour is **not** tokenised — the codebase uses opacity on black/white
(`text-black/70 dark:text-white/70` primary, `/50` and `/40` secondary). Follow that convention
rather than introducing a competing one.

Theme is `next-themes`, class-based, dark by default. When reading the resolved theme on the
client, use the `mounted` guard pattern in
`src/components/MessageRenderer/CodeBlock/index.tsx` or you will get a hydration mismatch.

---

## Verifying your work

`scripts/verify/` holds real browser-driven suites. They take a `BASE` env var.

**Run them against a production server, not `yarn dev`.** The Next dev overlay mounts a portal
that intercepts pointer events, so every click-driven check times out against a dev server.

```bash
yarn test                                  # 124 unit tests — must stay green
npx tsc --noEmit                           # must be clean
yarn build && yarn start                   # hosted build, then serve it on :3000
yarn build:desktop                         # desktop build (standalone output)

BASE=http://localhost:3000 node scripts/verify/canvas-test.mjs        # 10 canvas checks
BASE=http://localhost:3000 node scripts/verify/csp-proof.mjs          # sandbox isolation — a GATE
BASE=http://localhost:3000 node scripts/verify/responsive-canvas.mjs  # 17 checks, 390/1280/720px
BASE=http://localhost:3000 node scripts/verify/views-test.mjs         # 13 checks on the view router
BASE=http://localhost:3000 node scripts/verify/panel-test.mjs         # 5 checks; needs the panel pref
BASE=https://curiocity-desktop.vercel.app node scripts/verify/live-research.mjs
node scripts/verify/no-usage.mjs           # asserts no tokens/costs ever reappear
node scripts/verify/e2e-app.mjs            # real Electron app, 10 checks
```

`e2e-app.mjs` launches the actual desktop app and checks that a buffer survives a full restart
across different server ports. Run it after touching anything shared. It is macOS-only
(`Meta+a`, `~/Library/Application Support`) and allows 15 minutes for a first run, which
provisions ~150MB of SearXNG.

`panel-test.mjs` needs the floating panel enabled; it does not set that up itself:

```bash
curl -s -X POST localhost:3000/api/config -H 'Content-Type: application/json' \
  -d '{"key":"preferences.canvasSurface","value":"panel"}'
```

`responsive-canvas.mjs` and `views-test.mjs` also accept a deployed `BASE`, and both pass against
the hosted demo.

**Known environment quirk:** `ELECTRON_RUN_AS_NODE=1` may be set in the shell, which makes
Electron run as plain Node and resolve `electron` to the npm shim instead of the real module.
The scripts already unset it. If you launch Electron by hand and see
`does not provide an export named 'BrowserWindow'`, that is why.

---

## Definition of done — met; keep it met

- [x] Canvas genuinely usable at 390px and 1280px — `responsive-canvas.mjs`, 17/17, code written
      and run at both, plus a 720px container that gets the narrow layout
- [x] `#24A0ED` appears **zero** times outside `src/lib/theme/palette.ts`
- [x] One navigation component, one items array, no duplicated `navLinks.map`
- [x] Settings usable on a phone
- [x] Discover and Library reachable without adding routes — views on `/`, zero functions added
- [x] `vercel deploy` succeeds — function count measured against a HEAD baseline, unchanged
- [x] `yarn test` green (124), `tsc --noEmit` clean
- [x] `scripts/verify/e2e-app.mjs` passes — 10/10, buffer survives a real restart
- [x] The canvas sandbox still cannot reach the network — `csp-proof.mjs` is now a real gate that
      exits nonzero on a breach, rather than a report nobody reads. This is a security boundary,
      not a feature; if a refactor weakens it, that is a regression

**Known pre-existing issues, not introduced here and not fixed:**

- `yarn lint` does not run — eslint 8 against eslint-config-next 16 throws on config load.
- `vitest.config.ts` includes only `src/**/*.test.ts`, so a `.tsx` test would silently never run.
- `package.json`'s `name` is still `vane`, a legacy npm package name. It is not user-facing;
  `productName` is what Electron uses for the app name and its userData directory.

## What not to do

- Do not add routes without checking the function budget first.
- Do not put the desktop app on Serper — its searches must stay local.
- Do not weaken the sandbox CSP to make something convenient.
- Do not re-show token counts or costs in responses; they were deliberately removed.
- Do not commit. The user commits their own work.
- Do not run the browser suites against `yarn dev`; use a production server (see above).
- Do not rename the accent away from `src/lib/theme/palette.ts` — three files derive from it.
