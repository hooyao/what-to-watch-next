# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

What To Watch Next is a **Claude Code plugin** that recommends **TV shows, movies, and games** for a
user-specified time window — "TV shows from 2010–2015", "games from 2020 to now", or a bare "recommend a
show" (which defaults to the last 5 years, inclusive). It builds a taste profile over the conversation to
personalize results.

Plugin name: `what-to-watch-next` → slash invocations are `/what-to-watch-next:<skill>`.

## Language policy (hard rule)

Every committed artifact is **English**: code, comments, prompts, skill/agent instructions, the profile
template, and docs. The plugin speaks to end users in **English by default**, switching only when a user
explicitly asks. (Conversational replies to this repo's developer may follow their language; committed
files stay English.)

## Architecture

```
.claude-plugin/plugin.json                     # manifest
skills/recommend/SKILL.md                       # NL entry point + orchestration (model- & user-invocable)
skills/profile/SKILL.md                         # manage the taste profile (init / show / edit / reset)
skills/profile/references/profile-template.md   # canonical blank profile
agents/recommender.md                           # search → filter-to-window → rank, in its own context
hooks/hooks.json                                # optional SessionStart hook wiring
hooks/inject-profile.mjs                        # optional, Node, read-only profile injector
.mcp.json.example                               # template for a user-provided search MCP
.mcp.json                                       # LOCAL TEST ONLY (git-ignored; may hold a real API key)
```

**Component responsibilities (the part that needs the whole picture):**

- **`skills/recommend`** parses the request (media type, time window, constraints), resolves the time
  window, loads the profile, delegates search+rank to the `recommender` agent, presents a shortlist, and
  records new taste signals. Model-invocable, so "recommend a sci-fi show" triggers it directly.
- **`agents/recommender`** does the multi-step web search and ranking in its **own** context so raw
  results never flood the conversation; returns a compact ranked shortlist. It has **no `tools`
  restriction** on purpose — it must reach the user's (unknown-named) search MCP tools.
- **`hooks/inject-profile.mjs`** (SessionStart) is the **read** side of profiling: it loads the stored
  profile and emits it as `additionalContext` once per session. It is **read-only and optional** — it
  never generates the profile and is the only piece that needs Node.
- **Profile generation/writes are LLM-side**, in the skills: when `recommend` learns a durable
  preference it updates the profile file and **announces** it. The hook never does this.

**One request, end to end:** session starts → SessionStart hook injects the profile (if any) → user
asks → `recommend` parses intent + resolves the window → `recommender` searches, filters to the window,
ranks → `recommend` presents the shortlist and persists/announces new taste signals.

### Time-window resolution (in `recommend`)

- Explicit closed range → as given, inclusive.
- Single year ("2026") → that one calendar year only.
- Open-ended ("from 2020", "2020 to now") → end at the current year.
- Decade shorthand ("the 90s") → 1990–1999.
- None → **most recent 5 years, inclusive**: `(current year − 4)` … `current year`.
- **Sticky:** carry over the window established earlier in the conversation; a genre-only refinement
  ("now just sci-fi") keeps the current window and does not re-default. Only re-resolve when the user
  gives a new year/range or starts fresh.
- Read the current year from the runtime date; never hard-code it.

### Taste profile

- **Format:** a plain Markdown file, `profile.md` (structure in
  `skills/profile/references/profile-template.md`).
- **Location — the end user chooses the scope:**
  - Per-project: `<cwd>/.what-to-watch-next/profile.md`
  - Global: `<home>/.what-to-watch-next/profile.md` (`$HOME`, or `%USERPROFILE%` on Windows)
  - Read order: per-project, then global; per-project wins.
  - Deliberately **not** `${CLAUDE_PLUGIN_DATA}` — well-known home/cwd paths are resolvable by both the
    skills and the Node hook without relying on env-var expansion inside skill bodies.
- **Updates are announced** (one line per recorded preference). Init is optional; `recommend` must work
  cold and enrich the profile as it goes. Treat the profile as personal, local data.
- **Compaction (bounded growth — so the profile can't blow up injected context):** the sections above
  History (Liked / Disliked / Favorites / Platforms / Content preferences / Title verdicts) are the
  **deduped memory of record**; **History** is only a short recent-activity log (~8 entries). Two layers
  keep it bounded: (1) write-side — the skills roll durable facts up into the sections and delete
  superseded/old History lines (the `profile compact` action does this on demand); (2) read-side — the
  hook injects communication prefs first, then the profile with History capped to the most recent few
  entries. Durable taste lives in the sections, never in an ever-growing log.

### Search abstraction (user-provided)

- The plugin ships **no** search backend. The `recommender` agent prefers a user-configured search MCP
  (Brave, the test `Search-MCP`, etc.) and falls back to the built-in `WebSearch`/`WebFetch`. Keep
  search-tool selection inside the agent; never hard-code a specific MCP tool name. Ground every pick in
  real results — never fabricate titles or years.

### Cross-platform & runtime

- Targets Windows, macOS, Linux. **The core (skills + agent) needs no runtime.**
- Claude Code bundles **no** JS runtime for hooks (no `node` / `bun` / `python` is guaranteed on PATH),
  so the profile hook is the **only** Node dependency and is optional — delete `hooks/` to run
  dependency-free. The hook is invoked as a single shell-string command —
  `node "${CLAUDE_PLUGIN_ROOT}/hooks/inject-profile.mjs"` (quoted for paths with spaces; plugin
  `hooks.json` does **not** support an `args` array) — reads event JSON from **stdin**, writes result
  JSON to **stdout**, uses only Node built-ins, and exits 0 on any error.
- Reference plugin files via `${CLAUDE_PLUGIN_ROOT}`; never absolute paths.

## Development & testing

No build system (interpreted assets + one Node hook script). From the plugin root:

```bash
claude --plugin-dir .          # load into a dev session (also accepts a .zip)
claude plugin validate .       # validate manifest, skills, agent, hooks
claude plugin validate . --strict
```

In a running session, `/reload-plugins` picks up skill/agent edits; **hook changes require a restart**
(hooks load at session start).

Test the hook in isolation (it echoes back `hook_event_name`):

```bash
# macOS/Linux
echo '{"hook_event_name":"SessionStart","cwd":"'"$PWD"'"}' | node hooks/inject-profile.mjs
```
```powershell
# Windows PowerShell
'{"hook_event_name":"SessionStart","cwd":"."}' | node hooks/inject-profile.mjs
```

With no profile present it prints nothing (exit 0). With a profile at `<cwd>` or `<home>` +
`/.what-to-watch-next/profile.md`, it prints:

```json
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…profile…"}}
```

Smoke test in a session: `/what-to-watch-next:recommend tv shows 2010-2015`, then a bare "recommend a
game" to confirm the 5-year default and (with a profile set) personalization.

> Per the developer's standing rule, actually run `validate` and exercise the hook + skills locally
> before committing. "It loads" is not "it works."

## Security note

`.mcp.json` at the repo root is **local test config only** and may contain a real API key. It is
git-ignored and must **not** ship with the plugin (the plugin is search-agnostic). Distribute the
key-free `.mcp.json.example` instead.
