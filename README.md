# Curiocity

**A free, private, Perplexity-style answer engine that runs entirely on your computer — now with a built-in code canvas.** No account. No subscription. Your searches never leave your machine — a local search engine does the searching, and answers come from your own AI models: free local ones, your existing Claude subscription, or your own API keys.

## ⬇️ Download

| Platform                             | Download                                                                                                                           | Status                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **macOS** (Apple Silicon, macOS 13+) | [Curiocity-mac-arm64.dmg](https://github.com/Ejimone/perplexity/releases/latest/download/Curiocity-mac-arm64.dmg)         | Signed & notarized by Apple · opens clean · tested                                                                                                                                        |
| **Windows** (10/11, 64-bit)          | [Curiocity-Setup-Windows.exe](https://github.com/Ejimone/perplexity/releases/latest/download/Curiocity-Setup-Windows.exe) | **Beta** — built natively on Windows CI; install and uninstall are machine-tested on every build. If it misbehaves, [open an issue](https://github.com/Ejimone/perplexity/issues). |

### 🌐 Try it in your browser

**[curiocity-desktop.vercel.app](https://curiocity-desktop.vercel.app)**

Ask a question and get a cited answer, browse Discover, or open the canvas and run JavaScript and Python. Nothing to download and nothing to set up.

The hosted version is a demo, and it is not the private one. It searches through a third-party search service instead of the local engine, and it keeps nothing between visits — so Library only ever shows the threads from the session you are in. The download above is the real thing: it runs its own search engine on your computer, and your searches and chats stay there.

### First-open notes

**macOS** — the app is signed with an Apple Developer ID and notarized by Apple. It opens like any other app, no warnings.

**Windows — SmartScreen warning (normal).** You'll see _"Windows protected your PC."_ This appears for any new app that hasn't accumulated download reputation with Microsoft — it is not a malware verdict. Click **More info → Run anyway**. Two clicks, one time.

### First launch

The first run downloads the local search engine (~150 MB, one time). If you want free local AI models, the setup screen installs [Ollama](https://ollama.com) for you with one click on macOS (Windows: install Ollama yourself from [ollama.com/download](https://ollama.com/download), then click Install again — Curiocity picks it up automatically) — or plug in an API key (OpenAI, Anthropic, Google, Groq, xAI) or connect your existing Claude subscription for free frontier-model answers.

### Uninstalling

See [UNINSTALL.md](UNINSTALL.md) for exactly what Curiocity writes to disk and how to remove all of it — on macOS, `./scripts/uninstall.sh` does it in one step.

---

## ⚠️ Starting point, not a finished product

This is an early beta — a starting point. The core loop (search → sources → cited answer) is solid and tested, but edges are rough: some surfaces are still being brought to parity, and things will change fast. Use it, break it, [tell us what broke](https://github.com/Ejimone/perplexity/issues).

## What it does

- **Search-first answers** — every factual question triggers real web retrieval through your own local [SearxNG](https://github.com/searxng/searxng) metasearch (7 engines, no single point of failure), then the model writes a cited answer. The model never gets to "answer from memory" on facts.
- **Behind-the-scenes transparency** — watch the exact search queries, every source found, and each research step as it happens.
- **Deep research** — a capped multi-round research loop that scrapes and reads pages, then writes a long-form sectioned report.
- **Model council** — up to 3 models from different vendors answer the same question in parallel from the same sources; a chair model compares them and calls out where they agree and disagree.
- **Code canvas** — write and run code right inside the app, with AI help on tap. [More below.](#-code-canvas)
- **Your models, your choice** — pick per message: local Ollama (free), your Claude plan (free), or GPT-5.1 / Gemini 2.5 Pro / Claude Opus 4.8 / Grok on your keys. Nothing is locked.
- **Incognito threads** — flip the lock and the thread is never written to disk.
- **Export** — Markdown, PDF, or CSV of any answer.
- **Private by construction** — searches run through your local metasearch, chats live in a local SQLite file, API keys stay on your device. There is no server of ours to send anything to.

---

## 🧑‍💻 Code canvas

A proper little code editor built into Curiocity — **Canvas** in the sidebar. Write something, press **⌘↵**, and see what it does.

### Write

- **Four languages** — JavaScript, Python, C++ and Java, with syntax highlighting, code folding, autocomplete and find-and-replace.
- **Matches the app** — the editor uses the same colours as the code in your answers, and follows your light or dark theme automatically.
- **Your work is saved** — close the app, reopen it tomorrow, and your code is exactly where you left it. Each language keeps its own file, so switching between them never loses anything.

### Run

- **JavaScript and Python run right there** — no toolchain to install, no terminal, no setup. Python is fully included in the app, so it works with no internet connection at all.
- **See what happened** — printed output, error messages and how long the run took, all in a panel under the editor.
- **Errors point at the problem** — a failure tells you the line number, and clicking it jumps the cursor straight there and underlines it.
- **Nothing can run away from you** — a program stuck in a loop is stopped automatically. You choose the limit: 2, 5, 10 or 30 seconds.
- **It cannot touch your computer** — code you run in the canvas has no access to your files, your network, or anything else on your machine. It is sealed off, so pasting in something you don't fully trust is not a gamble.

> C++ and Java can be written and edited, but not run — running them would mean bundling a full compiler. The Run button says so rather than quietly doing nothing.

### Ask

- **Help with what's in front of you** — press **⌘I** and Curiocity sends your code, whatever you've selected, and the most recent error to the model. The answer streams into a panel beside the editor.
- **Just ask** — there's a box at the bottom of that panel for questions in your own words.
- **You stay in control** — suggestions are _never_ applied for you. Every block of code the model writes gets **Insert** and **Replace** buttons, and nothing changes in your file until you press one.

### Open it wherever suits you

Three ways, and you pick which ones you want under **Settings → Preferences → Coding canvas**:

|                    | What it is                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Sidebar**        | A full-size Canvas page inside the app. Always available.                                                                               |
| **Floating panel** | A small draggable window that floats over whatever you're doing, so you can keep a chat open beside it.                                 |
| **Floating bar**   | A separate always-on-top window that appears over _any_ app on your computer — press **⌘⇧\\** (Ctrl+Shift+\\ on Windows) from anywhere. |

The sidebar page is always there. The floating panel and the floating bar are off until you turn them on.

---

## Build from source

```bash
git clone https://github.com/Ejimone/perplexity.git
cd Curiocity
yarn install
yarn dist:mac   # or: yarn dist:win
```

Requires Node 24+. Development: `yarn dev`, tests: `yarn test`.
