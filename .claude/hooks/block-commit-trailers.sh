#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

case "$command" in
  *"git commit"*|*"git tag"*|*"gh pr create"*|*"gh pr edit"*) ;;
  *) exit 0 ;;
esac

pattern='Co-Authored-By:|Co-authored-by:|Claude-Session:|Generated with .*Claude|claude\.ai/code/session'

if printf '%s' "$command" | grep -qiE "$pattern"; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Trailer/footer interdit (Co-Authored-By, Claude-Session, Generated with, lien de session). Reformule le message sans aucune ligne d attribution."
    }
  }'
fi

exit 0
