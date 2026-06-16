---
name: atomic-commit
description: >
  Breaks a large set of uncommitted changes into clean, atomic, conventional Git
  commits. Use when I ask to "commit this atomically", run /atomic-commit, or have
  a messy working tree that mixes several logical changes. Plans the split, gets
  my approval, then commits group by group.
---

# Atomic commit

Turn a messy working tree into a sequence of atomic commits — one logical change
each. This skill plans and executes the split; it does not invent a commit
convention (see "Convention" below).

## 1. Analyze

- `git status` to list modified/untracked files.
- `git diff` (and `git diff --staged` if anything is already staged) to read the
  ACTUAL semantic changes, not just filenames.
- Group changes by logical intent: e.g. a bug fix, an unrelated refactor, a style
  tweak. A single file may belong to MORE THAN ONE group — watch for this.

## 2. Plan (show me before doing anything)

Present the proposed commits. For each:
- The conventional **type(scope)** and a one-line description (imperative, "why"
  over "what").
- The files — and, when a file is split across commits, WHICH part of it.
Wait for my approval before executing. Adjust if I push back.

## 3. Execute (only after approval)

For each approved commit, in order:
1. Stage exactly what belongs to it:
   - File belongs wholly to one commit -> `git add <file>`.
   - File mixes changes for several commits -> stage only the relevant parts.
     The clean way is `git add -p <file>` (hunk-by-hunk: `y`/`n`, and `s` to
     split a hunk that glues two changes together). Claude can't drive the
     interactive `-p` prompt itself, so for mixed files: tell me which hunks go
     where and let me run `git add -p`, OR stage precise line ranges
     non-interactively if feasible. NEVER lump a mixed file into one commit just
     because per-file staging is easier.
2. `git commit -m "<type>(<scope>): <description>"` (scope optional).
3. `git status` to confirm the commit landed and see what remains.

## Standards

- **Atomicity is the whole point**: never mix unrelated changes in one commit
  (no "fix bug + add feature" commits). When a file mixes concerns, split at the
  hunk level — do not let per-file convenience defeat atomicity.
- **No blanket `git add .`** unless the entire diff is genuinely one logical change.
- **Convention**: follow the project's commit convention (the git workflow in
  CLAUDE.md / the project's rules). Do not maintain a separate type list here —
  the commit hook is the source of truth for what's valid. Imperative, lowercase,
  no trailing period.
- **No co-author trailer.**
- Never `git push` unless I explicitly ask.
