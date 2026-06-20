---
name: profile
description: This skill should be used when the user wants to manage their recommendation taste profile — e.g. "set up my profile", "initialize my profile", "show my taste profile", "what do you know about my taste", "edit my viewing preferences", "compact my profile", "reset my profile", or "forget my preferences". It creates, displays, edits, compacts, or resets the What To Watch Next taste profile.
argument-hint: "[init|show|edit|compact|reset]"
allowed-tools: Read, Write, Edit
version: 0.1.0
---

# Profile

Create, show, edit, or reset the user's What To Watch Next taste profile — a plain Markdown file the
plugin uses to personalize recommendations and that the user can read or edit by hand.

Determine the action from `$ARGUMENTS` (`init`, `show`, `edit`, `compact`, `reset`). If no action is
given, infer it from the user's phrasing; when still unclear, show the current profile and offer to set
one up.

## Profile location

Two supported locations — the user chooses the scope:

- **Per-project:** `<current working directory>/.what-to-watch-next/profile.md`
- **Global:** `<home directory>/.what-to-watch-next/profile.md` (home = `$HOME`, or `%USERPROFILE%`
  on Windows)

When reading, prefer a per-project profile, then fall back to global. When both exist, the per-project
file wins.

## Actions

### init

1. **Choose scope.** Ask whether to store the profile **globally** (shared across all projects) or
   **per-project** (this repository only), unless the user already said. Resolve the target path
   accordingly.
2. **Check for an existing file** at that path. If one exists, show it and ask whether to keep, edit,
   or overwrite it — do not silently replace it.
3. **Create the file** using the structure in `references/profile-template.md`.
4. **Seed it (optional, keep brief).** Ask up to a few light questions — favorite genres or titles,
   platforms (Netflix, Steam, PS5, Switch…), and anything to avoid. Make clear the user can skip any of
   them; record only what they offer.
5. **Confirm** the absolute path where the profile was saved.

### show

Read the active profile (per-project, then global) and present it clearly. If none exists, say so and
offer to run `init`.

### edit

Apply the user's requested change to the active profile file with Edit, preserving the template's
section structure. Confirm what changed in one line.

### compact

Roll up the profile so it stays small and contradiction-free:

1. Make sure every durable fact still living only in **History** is reflected in the right section above
   (Liked / Disliked / Favorites / Platforms / Content preferences / Title verdicts); merge duplicates
   within each section.
2. Trim **History** to roughly its **8 newest entries** — delete older entries (their takeaways now live
   above) and any superseded / contradictory lines.
3. Report in a line or two what was rolled up and how many History entries were dropped.

### reset

Confirm intent first. Then overwrite the active profile with the blank template from
`references/profile-template.md` (this clears recorded preferences while keeping the file and its
structure). Confirm that the profile was reset.

## Notes

- After any change to the profile (including seeding during `init`), state in one short line what was
  recorded or changed — e.g. "Noted: you like slow-burn mysteries — added under Liked."
- Keep the file human-readable and edits minimal and well-placed under the right section.
- The sections above **History** are the memory of record (deduped). **History** is only a short recent
  log (~8 entries): durable facts get rolled up into the sections above and superseded entries are
  removed, so the profile never grows without bound. The session hook also injects only the most recent
  few History entries.
- Opinions about specific titles are distilled (summarized in your own words, never stored verbatim) and
  kept under **Title verdicts** as `Title (year) — verdict`.
- **Communication preferences** (e.g. reply language, how to render titles / names / places) are
  high-priority: the session hook surfaces them first so they apply to the whole conversation, not just
  recommendations.
- Never store anything the user did not express or agree to.
- The profile is local to the user's machine; treat it as personal data.

## Resources

- **`references/profile-template.md`** — the canonical blank profile structure used by `init` and
  `reset`.
