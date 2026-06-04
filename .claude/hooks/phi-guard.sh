#!/usr/bin/env bash
# PreToolUse(Bash) guard for PHI/privacy. Blocks committing or exfiltrating health data:
# .env files, database dumps, exported reports, sqlite caches, and `git add .` sweeps that
# could catch them. Exit 0 = allow, exit 2 = block.
set -uo pipefail

INPUT=$(cat)
if command -v jq >/dev/null 2>&1; then
  TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
  CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
else
  TOOL=$(printf '%s' "$INPUT" | sed -n 's/.*"tool_name"[ ]*:[ ]*"\([^"]*\)".*/\1/p')
  CMD=$(printf '%s' "$INPUT" | sed -n 's/.*"command"[ ]*:[ ]*"\(.*\)".*/\1/p')
fi
[ "$TOOL" = "Bash" ] || exit 0
case "$CMD" in *"# SAFE-OVERRIDE:"*) exit 0 ;; esac

block() { echo "BLOCKED by phi-guard: $1" >&2; exit 2; }

# Block git add/commit that names sensitive artifacts.
if echo "$CMD" | grep -Eq 'git[[:space:]]+(add|commit)'; then
  echo "$CMD" | grep -Eiq '\.env(\.|[[:space:]]|$)'                && block "staging a .env file. Secrets/PHI config must not be committed."
  echo "$CMD" | grep -Eiq '\.(sql|dump|sqlite3?|db)\b'            && block "staging a database dump/cache. May contain real health data."
  echo "$CMD" | grep -Eiq '\.(csv|pdf|xlsx?|json)\b.*export|export.*\.(csv|pdf|xlsx?|json)\b' && block "staging an export. Real-data exports must not be committed."
  # `git add .`, `git add -A`, `git add --all` sweep up everything — force explicit paths.
  echo "$CMD" | grep -Eq 'git[[:space:]]+add[[:space:]]+(\.|-A\b|--all\b|\*)' && block "broad 'git add' can sweep in .env/exports/dumps. Add specific files."
fi

# Block obvious exfiltration of local data to the network.
echo "$CMD" | grep -Eiq '(curl|wget|nc|scp)\b.*(\.env|\.sqlite|\.db|dump|export)' && block "uploading local data files off-device."

exit 0
