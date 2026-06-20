#!/usr/bin/env node
/*
 * What To Watch Next — profile injection hook.
 *
 * Reads the user's profile (per-project first, then global) and emits it as `additionalContext`.
 * READ-ONLY: it never writes or "generates" the profile — extracting preferences from conversation
 * is the job of the `recommend` / `profile` skills (the LLM).
 *
 * Injection layout:
 *   1. "Communication preferences" first, as a HIGH-PRIORITY directive that applies to every reply.
 *   2. The taste profile, with the **History** section capped to the most recent entries so a growing
 *      activity log can never blow up the injected context (read-side compaction). A hard char cap is
 *      the final backstop.
 *
 * Dependencies: none (Node built-ins only). It must never break the event: on any error, or when no
 * profile exists, it exits 0 and prints nothing. Event-agnostic: echoes back `hook_event_name`.
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROFILE_DIR = ".what-to-watch-next";
const PROFILE_FILE = "profile.md";
const MAX_CHARS = 6000; // hard backstop on total injected size
const MAX_HISTORY = 6; // most-recent History entries to inject

function readStdin() {
  try {
    return readFileSync(0, "utf8"); // fd 0 = stdin
  } catch {
    return "";
  }
}

// Meaningful, de-bulleted lines under a "## <name>" section. `cleanMd` must have comments stripped.
function sectionLines(cleanMd, name) {
  const target = name.toLowerCase();
  let inSection = false;
  const out = [];
  for (const raw of cleanMd.split("\n")) {
    const heading = raw.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      inSection = heading[1].trim().toLowerCase() === target;
      continue;
    }
    if (!inSection) continue;
    const text = raw.trim();
    if (!text || text === "-") continue;
    out.push(text.replace(/^[-*]\s*/, "").trim());
  }
  return out.filter(Boolean);
}

// Keep only the most recent `n` bullets under "## History" so a long log can't bloat the injection.
function boundHistory(cleanMd, n) {
  const lines = cleanMd.split("\n");
  const idx = lines.findIndex((l) => /^##\s+History\b/i.test(l));
  if (idx === -1) return cleanMd;
  const out = lines.slice(0, idx + 1);
  let kept = 0;
  let trimmed = false;
  for (const line of lines.slice(idx + 1)) {
    if (/^##\s+/.test(line)) {
      out.push(line); // a later section (defensive — History is normally last)
      continue;
    }
    if (/^\s*-\s+/.test(line)) {
      if (kept < n) {
        out.push(line);
        kept++;
      } else {
        trimmed = true;
      }
    } else if (!trimmed) {
      out.push(line);
    }
  }
  if (trimmed) out.push("- … (older history trimmed; full log is in the profile file)");
  return out.join("\n");
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    input = {};
  }

  const cwd =
    typeof input.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const eventName =
    typeof input.hook_event_name === "string" && input.hook_event_name
      ? input.hook_event_name
      : "SessionStart";

  // Per-project profile takes precedence over the global one.
  const candidates = [
    join(cwd, PROFILE_DIR, PROFILE_FILE),
    join(homedir(), PROFILE_DIR, PROFILE_FILE),
  ];

  let profile = "";
  for (const path of candidates) {
    try {
      if (existsSync(path)) {
        const contents = readFileSync(path, "utf8");
        if (contents.trim()) {
          profile = contents;
          break;
        }
      }
    } catch {
      /* unreadable candidate — try the next one */
    }
  }

  const clean = profile.replace(/<!--[\s\S]*?-->/g, "");
  if (!clean.trim()) return; // no profile (or empty) → inject nothing

  let body = boundHistory(clean, MAX_HISTORY).trim();
  if (body.length > MAX_CHARS) {
    body = body.slice(0, MAX_CHARS) + "\n… (profile truncated)";
  }

  // High-priority, always-on communication preferences come first.
  const comm = sectionLines(clean, "Communication preferences");

  let context = "";
  if (comm.length) {
    context +=
      "⚠ HIGH PRIORITY — the user's communication preferences. Apply these to EVERY reply this " +
      "session, including the recommendations themselves:\n" +
      comm.map((line) => "- " + line).join("\n") +
      "\n\n";
  }
  context +=
    "The user keeps a What To Watch Next taste profile (below). Use it when recommending or discussing " +
    "TV shows, movies, or games — personalize to it and update the profile file when you learn a durable " +
    "preference. Ignore it for unrelated requests.\n\n" +
    body;

  const output = {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: context,
    },
  };

  process.stdout.write(JSON.stringify(output));
}

try {
  main();
} catch {
  // Never fail the event on account of profiling.
}
