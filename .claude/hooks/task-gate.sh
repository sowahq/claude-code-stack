#!/usr/bin/env bash
set -euo pipefail

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

changed="$(git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)"
[ -z "$changed" ] && exit 0

src="$(printf '%s\n' "$changed" | grep -E '\.(go|ts|tsx|svelte|js|jsx)$' | grep -vE '(_test\.go|\.test\.|\.spec\.)' || true)"
tests="$(printf '%s\n' "$changed" | grep -E '(_test\.go|\.test\.|\.spec\.)' || true)"

if [ -n "$src" ] && [ -z "$tests" ]; then
  echo "Task gate: source files changed but no test/verification file was touched." >&2
  echo "Project rule: every task must include tests or verification logic. Add tests before completing, or state why none apply." >&2
  exit 2
fi

exit 0
