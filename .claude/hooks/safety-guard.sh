#!/usr/bin/env bash
# PreToolUse(Bash) guard. Blocks destructive shell commands and hardcoded secrets.
# Exit 0 = allow, exit 2 = block (message on stderr is shown to Claude).
# Pattern adapted from jonathanmalkin/jules safety-guard, retargeted for this app.
# Fail-open on parse errors (never crash the session); only block() exits non-zero.
set -uo pipefail

INPUT=$(cat)

# Parse with jq if present, else a best-effort fallback.
if command -v jq >/dev/null 2>&1; then
  TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
  CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
else
  TOOL=$(printf '%s' "$INPUT" | sed -n 's/.*"tool_name"[ ]*:[ ]*"\([^"]*\)".*/\1/p')
  CMD=$(printf '%s' "$INPUT" | sed -n 's/.*"command"[ ]*:[ ]*"\(.*\)".*/\1/p')
fi

[ "$TOOL" = "Bash" ] || exit 0

# Allow an explicit, deliberate override.
case "$CMD" in
  *"# SAFE-OVERRIDE:"*) exit 0 ;;
esac

# Strip commit message text so keywords inside -m "..." don't trip patterns.
SCAN=$(printf '%s' "$CMD" | sed -E 's/-m[[:space:]]+"[^"]*"//g; s/-m[[:space:]]+'"'"'[^'"'"']*'"'"'//g')

block() { echo "BLOCKED by safety-guard: $1" >&2; exit 2; }

# --- Destructive command patterns ---
echo "$SCAN" | grep -Eq '(^|[;&|])[[:space:]]*rm[[:space:]]+-[a-zA-Z]*[rf]' && block "recursive/force rm. Remove specific files explicitly or ask the owner."
echo "$SCAN" | grep -Eq '\bfind\b.*(-delete|-exec[[:space:]]+rm)'            && block "find with bulk delete."
echo "$SCAN" | grep -Eq '(^|[^>])>[[:space:]]*/'                              && block "redirect/truncate to an absolute path."
echo "$SCAN" | grep -Eq '\b(sudo|doas)\b'                                     && block "privilege escalation."
echo "$SCAN" | grep -Eq '\b(mkfs|fdisk)\b|\bdd[[:space:]]+if=|[[:space:]]of=/dev/' && block "disk/filesystem operation."
echo "$SCAN" | grep -Eq '(curl|wget)[^|]*\|[[:space:]]*(bash|sh|zsh)'         && block "piping remote code into a shell."
echo "$SCAN" | grep -Eq 'git[[:space:]]+push[[:space:]].*(-f\b|--force\b)'    && block "git force-push. Use --force-with-lease and ask first."
echo "$SCAN" | grep -Eq 'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f'         && block "git clean -f (destroys untracked files)."
echo "$SCAN" | grep -Eq 'git[[:space:]]+reset[[:space:]]+--hard'             && block "git reset --hard. Confirm with the owner first."
echo "$SCAN" | grep -Eq '\b(killall|shutdown|reboot)\b|kill[[:space:]]+-9[[:space:]]+1\b' && block "process/power management."

# --- Secret scanning (don't run/commit hardcoded credentials) ---
echo "$CMD" | grep -Eq 'AKIA[0-9A-Z]{16}'              && block "looks like an AWS access key."
echo "$CMD" | grep -Eq 'ghp_[0-9A-Za-z]{36}'           && block "looks like a GitHub token."
echo "$CMD" | grep -Eq 'sk-ant-api03-|sk-[0-9A-Za-z]{20,}' && block "looks like an API key."
echo "$CMD" | grep -Eq -- '-----BEGIN[[:space:]].*PRIVATE KEY' && block "private key material."
# Supabase service_role key must never be used in app/shell context.
echo "$CMD" | grep -Eiq 'service_role'                 && block "service_role key reference. This key must never touch the app."

exit 0
