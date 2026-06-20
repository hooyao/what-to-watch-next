# What To Watch Next

A Claude Code plugin that recommends **TV shows, movies, and games** for any time window you ask for —
"TV shows from 2010–2015", "games from 2020 to now", or just "recommend a show" (defaults to the last 5
years). It learns your taste over the conversation — genres, per-title opinions, platforms, even how you
like to be talked to — and personalizes every suggestion.

## Features

- **Time-aware recommendations** across TV, film, and games. Give an explicit range, an open-ended one
  ("2020 to now"), a single year ("2026"), a decade ("the 90s"), or nothing (→ last 5 years). The window
  is **sticky**: once set in the conversation, a follow-up like "now just sci-fi" keeps it.
- **Taste profiling that announces itself.** As you react, it records durable preferences (liked/disliked
  genres, favorite titles, platforms, content limits) and tells you — one line — what it saved.
- **Per-title verdicts.** Tell it what you thought of something ("Severance dragged", "loved Andor") and
  it distills your opinion into a one-line note in your profile, so future picks sharpen.
- **High-priority communication preferences.** Tell it how to talk to you (e.g. "reply in Chinese, keep
  titles in English") — it saves that and applies it to every reply, surfaced first each session.
- **Grounded, never fabricated.** A background agent searches the web (your search MCP, or the built-in
  `WebSearch`) and verifies titles and release years before recommending.
- **Cross-platform** (Windows, macOS, Linux); the core needs no runtime.

## How to use

Ask in natural language, or with the slash command:

```
recommend a sci-fi show
/what-to-watch-next:recommend tv shows 2010-2015
/what-to-watch-next:recommend a cozy game from the last 3 years
```

A typical session:

1. **Ask** — "recommend a show". With no year it uses the last 5 years; name a range and it uses that
   (and remembers it for follow-ups).
2. **React** — "I don't like turn-based games", "loved The Orville S1–2 but S3 was preachy". It saves
   these (and says so), then avoids or leans accordingly.
3. **Give constraints** — your platforms ("I'm on PC — Game Pass + Steam"), or how to talk to you
   ("reply in Chinese"). It records and applies them.
4. **Come back later** — your profile persists, so it keeps personalizing without you repeating yourself.

Manage the profile directly any time:

```
/what-to-watch-next:profile init     # optional guided setup (choose global or per-project)
/what-to-watch-next:profile show     # see what it knows about you
/what-to-watch-next:profile reset    # clear it
```

> Profile reads/writes happen **in the skills** as you chat; an optional Node hook also injects your
> profile at the start of each session, so personalization is active from the first message. Preferences
> you set mid-session apply right away and on every session afterward.

## How it works

| Component | What it does |
| --- | --- |
| `skills/recommend` | NL entry point + orchestrator: parses the request, resolves the (sticky) time window, loads your profile, delegates search/ranking to the agent, presents a shortlist, records new taste signals. |
| `skills/profile` | Manage the taste profile: init / show / edit / reset. |
| `agents/recommender` | Searches the web and ranks in its own context so raw results don't clutter the chat; returns a compact, verified shortlist. |
| `hooks/inject-profile.mjs` | *Optional.* At session start, injects your profile — communication preferences first (high priority), then taste. **Read-only; it never generates the profile.** |

**Profiling is LLM-driven:** extracting preferences and writing them is the skills' job; the hook only
reads and injects.

## The taste profile

- **Format:** a plain Markdown file, `profile.md`, you can read and edit by hand. Sections: Communication
  preferences, Liked, Disliked, Favorites, Platforms & access, Content preferences, Title verdicts, and a
  dated History.
- **Location (you choose at init):**
  - **Global:** `~/.what-to-watch-next/profile.md` — shared across every project.
  - **Per-project:** `<project>/.what-to-watch-next/profile.md` — one per repo (wins over global).
- **It's yours:** local data — inspect, edit by hand, or `reset` it any time.

## Prerequisites

- **A web search capability** — a search MCP you configure (recommended), or the built-in `WebSearch`.
- **Node.js** — *optional*, only for the session-start profile-injection hook. No Node? Delete `hooks/`;
  the skills still read and write your profile on their own.

## Installation (local)

```bash
claude --plugin-dir .          # load the plugin into a session (also accepts a .zip)
claude plugin validate .       # validate manifest, skills, agent, hooks
/reload-plugins                # after editing components (hook changes need a restart)
```

## Search configuration

Add a search MCP to your **own** Claude Code config (it isn't bundled). See `.mcp.json.example` for a
template (Brave, or any HTTP/stdio search server). With none configured, the built-in `WebSearch` is used.

> Any `.mcp.json` in this repo is **local test config** (may hold a real API key); it is git-ignored and
> is **not** part of the distributable plugin. Distribute the key-free `.mcp.json.example`.

## Project layout

```
.claude-plugin/plugin.json     # manifest
skills/recommend/SKILL.md      # main recommendation flow
skills/profile/SKILL.md        # profile management
skills/profile/references/profile-template.md
agents/recommender.md          # search / filter / rank worker
hooks/hooks.json               # optional hook wiring (SessionStart)
hooks/inject-profile.mjs       # optional Node read-and-inject script
.mcp.json.example              # search-MCP template
```

## Development

See `CLAUDE.md` for architecture and conventions (English-only artifacts, time-window rules,
cross-platform hook guidance, and the validate/test workflow).

## License

MIT — see [`LICENSE`](LICENSE).
