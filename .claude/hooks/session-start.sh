#!/usr/bin/env bash
# SessionStart hook. Syncs the branch and prints a short safety banner.
# Never fails the session — all steps are best-effort.
set -uo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
git fetch origin "$BRANCH" --quiet 2>/dev/null || true

# Warn loudly if any sensitive artifact is tracked — it should never be.
TRACKED_RISK=$(git ls-files 2>/dev/null | grep -Ei '(^|/)\.env|\.(sqlite3?|db|dump)$|export.*\.(csv|pdf|xlsx?)$' || true)

cat <<BANNER
CarePlanning — care/health data. Safety rules in effect:
  • RLS deny-by-default · no service_role in app · no PHI in logs/commits/seeds
  • Med/care-task logic is safety-critical — surface uncertainty, don't guess
  • Offline + accessibility + low-energy are requirements, not polish
  Skills: /build-feature /supabase-rls /care-safety-review /evidence-export /a11y-low-energy
BANNER

if [ -n "$TRACKED_RISK" ]; then
  echo ""
  echo "  ⚠ Sensitive files appear to be tracked in git — review immediately:"
  echo "$TRACKED_RISK" | sed 's/^/    /'
fi

exit 0
