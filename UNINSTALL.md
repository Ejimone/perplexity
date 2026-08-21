# Uninstalling Curiocity

Deleting the app from Applications (macOS) or using "Add or Remove Programs"
(Windows) removes the *program*, but Curiocity — like most desktop apps —
keeps its own data (chat history, provider settings, the local search engine,
and the downloaded Ollama binary if you installed it through the app) in a
separate per-user folder that the OS does not clean up for you. This page
lists every path Curiocity writes to, so you can remove exactly what you
want and nothing you don't.

If you're on a Mac, the fastest way to do all of this at once is
[`scripts/uninstall.sh`](scripts/uninstall.sh) (see below). There is no
equivalent script for Windows yet — follow the manual steps.

## What Curiocity writes to disk

Everything except the app bundle itself lives under one folder, so removing
that one folder removes all of Curiocity's data in one step:

| OS | App data folder |
|---|---|
| macOS | `~/Library/Application Support/Curiocity` |
| Windows | `%APPDATA%\Curiocity` (usually `C:\Users\<you>\AppData\Roaming\Curiocity`) |

Inside it:

- `data/config.json` — your provider connections (API keys, if you added any), preferences
- `data/db.sqlite` — chat history (unless you used Incognito threads, which are never written here)
- `drizzle/` — database migration files, refreshed on every launch
- `bin/` — the Ollama binary, **only if** you installed it through Curiocity's "Install" button rather than already having it on your machine
- `searxng/` — the local search engine: a self-contained Python runtime plus the SearXNG source, downloaded once on first launch (~150 MB)
- `logs/` — `curiocity.log` and `searxng.log`, plain text, useful for bug reports

Nothing here is a login item, background service, or system daemon —
Curiocity doesn't register anything to run at startup, so there's nothing to
disable before removing files, on either OS.

### The app itself

| OS | Location |
|---|---|
| macOS | `/Applications/Curiocity.app` |
| Windows | Wherever you chose during install (the installer lets you pick a folder; the default is under `%LOCALAPPDATA%\Programs\Curiocity`) |

### macOS cache/state Electron may also create

These are written by Electron/Chromium itself (window state, GPU shader
cache), not by Curiocity's own code — they're small, and normal to skip, but
`scripts/uninstall.sh` removes them for a fully clean slate:

- `~/Library/Caches/Curiocity`
- `~/Library/Saved Application State/com.curiocity.desktop.savedState`
- `~/Library/HTTPStorages/com.curiocity.desktop` (and `.binarycookies` next to it, if present)

## macOS: uninstall

**Option A — the script (recommended):**

```bash
curl -fsSL https://raw.githubusercontent.com/Ejimone/perplexity/desktop/scripts/uninstall.sh | bash
```

or, from a clone of this repo:

```bash
./scripts/uninstall.sh
```

It prints exactly what it's about to delete and asks for confirmation before
touching anything (`--dry-run` to preview with nothing removed, `--yes` to
skip the prompt).

**Option B — by hand:**

1. Quit Curiocity.
2. Drag `/Applications/Curiocity.app` to the Trash (or `rm -rf` it).
3. Remove its data: `rm -rf ~/Library/Application\ Support/Curiocity`
4. Optional, cosmetic: `rm -rf ~/Library/Caches/Curiocity ~/Library/Saved\ Application\ State/com.curiocity.desktop.savedState`

## Windows: uninstall

1. Quit Curiocity.
2. Settings → Apps → Installed apps → **Curiocity** → Uninstall (or run
   `Uninstall Curiocity.exe` from the folder you installed it into). This
   removes the program files but — same as almost every Windows app —
   **does not** touch your data folder.
3. To also remove your data: delete `%APPDATA%\Curiocity` (paste that
   into File Explorer's address bar, or `Remove-Item -Recurse -Force
   "$env:APPDATA\Curiocity"` in PowerShell).

## I just want to reset Curiocity, not remove it

Quit the app and delete only the `data/` subfolder (`~/Library/Application
Support/Curiocity/data` on macOS, `%APPDATA%\Curiocity\data` on Windows) —
this clears chat history and provider connections but leaves the downloaded
search engine and Ollama binary in place, so the next launch skips the ~150 MB
first-run download.
