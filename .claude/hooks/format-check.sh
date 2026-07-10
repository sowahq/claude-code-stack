#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
file="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"

[ -z "${file:-}" ] && exit 0
[ -f "$file" ] || exit 0

case "$file" in
  *.go)
    if command -v gofmt >/dev/null 2>&1; then
      out="$(gofmt -l "$file" 2>/dev/null || true)"
      if [ -n "$out" ]; then
        echo "gofmt: $file is not formatted. Run: gofmt -w $file" >&2
        exit 2
      fi
    fi
    ;;
  *.rs)
    if command -v rustfmt >/dev/null 2>&1; then
      if ! rustfmt --check --edition 2021 "$file" >/dev/null 2>&1; then
        echo "rustfmt: $file is not formatted. Run: cargo fmt" >&2
        exit 2
      fi
    fi
    ;;
  *.svelte|*.ts|*.tsx)
    if [ -f package.json ] && grep -q '"svelte-check"' package.json 2>/dev/null; then
      if ! npx --no-install svelte-check --threshold error >/tmp/svelte-check.log 2>&1; then
        echo "svelte-check reported errors:" >&2
        tail -n 20 /tmp/svelte-check.log >&2
        exit 2
      fi
    fi
    ;;
esac

exit 0
