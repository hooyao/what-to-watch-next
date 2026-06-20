---
name: recommend
description: This skill should be used when the user asks for something to watch or play — e.g. "recommend a TV show", "what should I watch tonight", "suggest a movie", "good games from 2015-2018", "find me a sci-fi series from the 2000s", or any request for TV, film, or video-game recommendations, with or without a year range. It defaults to the last 5 years when no range is given and personalizes results using the saved taste profile.
argument-hint: "[tv|movie|game] [year range] [mood/genre/constraints]"
version: 0.1.0
---

# Recommend

Recommend TV shows, movies, or video games that match a time window and the user's taste. Parse the
request, resolve the time window, load the taste profile, delegate the search and ranking to the
`recommender` agent, then present a curated shortlist and record any new taste signals.

## Workflow

Follow these steps in order.

### 1. Parse the request

Extract three things from the user's message (and recent conversation):

- **Media type(s):** TV show, movie, or game. If unspecified and unclear from context, ask one brief
  clarifying question rather than guessing across all three.
- **Time window:** any explicit years ("2010 to 2015", "from 2020", "90s", "last 3 years"). See
  *Time-window rules* below.
- **Constraints:** genre, mood, themes, length, platform, language, "like X" comparisons, or anything
  to avoid.

### 2. Resolve the time window

Determine the current year from the environment date — do not assume a hard-coded year.

**Carry over the window already in play.** If a time window was established earlier in the conversation,
keep using it for follow-up requests — a refinement like "now just sci-fi" or "something lighter"
inherits the window already set and must **not** reset to the default. Only change it when the user
gives a new year or range, or clearly starts a fresh request.

Otherwise, resolve from the request:

- **Explicit closed range** ("2010 to 2015") → use as given, inclusive.
- **Single year** ("2026", "games from 2014") → that one calendar year only, inclusive.
- **Open-ended** ("from 2020", "2020 to now") → end at the current year.
- **Decade shorthand** ("the 90s") → 1990–1999.
- **No range given and none yet established** → default to **the most recent 5 years, inclusive**:
  `(current year − 4)` through `current year`.

Whenever you assume or carry over a window, state it in one short phrase so the user can correct it
("sticking with 2026", "from the last 5 years").

### 3. Load the taste profile

The profile is a Markdown file. Resolve its path in this order and use the first that exists
(per-project wins when both exist):

1. **Per-project:** `<current working directory>/.what-to-watch-next/profile.md`
2. **Global:** `<home directory>/.what-to-watch-next/profile.md` (home = `$HOME`, or `%USERPROFILE%`
   on Windows)

If the optional injection hook ran, the profile already appears in context — use it directly. Otherwise
read the file. If no profile exists, continue without one (cold start) and, after answering, offer once
to set one up via `/what-to-watch-next:profile init`. Never block recommendations on a missing profile.

If the profile has a **Communication preferences** section, treat it as **high-priority** instruction
for the whole conversation (e.g. reply language, and how to render titles / names / places) — apply it
to every reply, including the recommendations themselves, not just to which titles you pick.

### 4. Delegate search and ranking to the `recommender` agent

Use the Task tool to invoke the **`recommender`** agent (shipped with this plugin). Give it a precise
brief containing: the media type, the resolved year range (explicit numbers), and the user's
constraints and profile preferences distilled into concrete signals (liked/disliked genres, favorites,
platforms, content limits). The agent searches, filters strictly to the year window, ranks, and returns
a compact shortlist with one-line justifications. Delegating keeps raw search output out of this
conversation.

If the `recommender` agent is unavailable, perform the search inline following the same method, but
prefer delegation.

### 5. Present the shortlist

Present 4–6 picks (fewer if the window is narrow). For each item include, on one tight line each:

- **Title (year)** — for games, platform(s); for TV, status if relevant (ended/ongoing).
- One sentence on what it is and **why it fits** this user (tie back to their stated taste).

Lead with the single strongest pick. End by inviting a follow-up ("want more like #2?", "narrower to
just thrillers?"). Keep the framing concise — no long plot summaries.

**Ask about platforms once.** If the profile has no **Platforms & access** info and the picks span
several services (so what the user can actually watch matters), briefly ask which services they have
(e.g. Netflix, Apple TV+, Paramount+, Steam, PS5, Switch) and record the answer to the profile. Ask at
most once; never nag, and never block recommendations on it.

### 6. Record new taste signals (announce updates)

When the conversation reveals a **durable** preference — a like or dislike, a favorite, a platform, a
hard constraint, or a **communication/language preference** (which goes under **Communication
preferences** and is treated as high-priority) — and a profile file **already exists**, append it under
the matching section and tell
the user in one short line what was recorded:

> 📝 Noted: you enjoy slow-burn mysteries — added to your profile.

If **no profile exists yet** (cold start), do not silently create one mid-recommendation — that would
bypass the user's global-vs-per-project choice and could scatter a `.what-to-watch-next/` folder into an
unrelated project. Instead, keep the signal in mind for this session and, after presenting picks, offer
once to save it via `/what-to-watch-next:profile init` (which lets the user choose the scope).

**Per-title opinions.** When the user voices an opinion about a specific title — including one of your
past picks (e.g. "loved Severance", "Andor dragged for me", "that game's combat is repetitive") —
distill the gist into a concise one-line verdict **in your own words** (summarize the point; never store
the raw quote verbatim) and persist it under the profile's **Title verdicts** section as
`Title (year) — verdict`. Reflect any strong like/dislike into **Liked** / **Disliked** as a general
signal too. Announce what you recorded.

Record only durable signals. Do not record one-off, hypothetical, or uncertain reactions. When a profile
exists, also append a brief dated entry to its **History** section noting what was recommended and
accepted or rejected, so future runs improve — following the structure of the existing file (the
`profile` skill's template is the canonical layout).

**Keep the profile compact (so it never bloats context).** The sections above History — Communication
preferences, Liked, Disliked, Favorites, Platforms & access, Content preferences, Title verdicts — are
the **memory of record**: merge each durable signal into the right one and keep it deduplicated.
**History is only a short recent-activity log, not where conclusions live** — keep it to roughly the
**8 newest entries**. When you add an entry and the log is longer, first confirm each older entry's
durable takeaway is already captured in a section above, then **delete** the oldest and any
now-superseded lines (never leave "(superseded)" cruft). A correction replaces the wrong line; it does
not pile on top of it.

## Search backend

This plugin ships no search backend. The `recommender` agent prefers a user-configured search MCP and
falls back to the built-in `WebSearch`. Always ground recommendations in real search results — verify
titles and release years; never invent titles or guess years to fill the list.

## Edge cases

- **Ambiguous media type** → ask one short question.
- **Empty window / no results** → widen the window by a few years or relax one constraint, and say so.
- **User pushes back on a pick** → treat it as a taste signal (step 6) and offer alternatives.
