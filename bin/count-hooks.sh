#!/bin/bash
# =============================================================================
# Single source of truth for hook counting
# =============================================================================
# Counts hooks from:
#   1. hooks.json entries (global) — "type": "command" and "type": "http" entries
#   2. Agent frontmatter — command:.*run-hook lines between --- markers
#   3. Skill frontmatter — command:.*run-hook lines between --- markers
#
# Output format (eval-friendly):
#   GLOBAL=93 AGENT=22 SKILL=6 TOTAL=121
#
# Usage:
#   eval "$(./bin/count-hooks.sh)"
#   echo "Total hooks: $TOTAL"
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Global hooks: count "type": "command" and "type": "http" entries in hooks.json
GLOBAL_CMD=$(grep -c '"type": "command"' "$PROJECT_ROOT/src/hooks/hooks.json" 2>/dev/null || true)
GLOBAL_CMD=${GLOBAL_CMD:-0}
GLOBAL_HTTP=$(grep -c '"type": "http"' "$PROJECT_ROOT/src/hooks/hooks.json" 2>/dev/null || true)
GLOBAL_HTTP=${GLOBAL_HTTP:-0}
GLOBAL=$(( GLOBAL_CMD + GLOBAL_HTTP ))

# Count `command:.*run-hook` lines under a directory.
#
# grep's exit codes are three-valued: 0 found, 1 no-match, >=2 real error. Under
# this script's `set -euo pipefail`, piping a no-match grep into awk propagated
# the 1 and killed the script BEFORE the final echo, leaving TOTAL unbound in
# every caller (stamp-counts.sh died with "TOTAL: unbound variable"). Zero
# agent-scoped hooks is a legitimate state — #3461 removed all 45 of them — so
# no-match must count as 0.
#
# A blanket `|| true` would also swallow rc>=2, turning a broken grep into a
# silent zero and quietly shrinking the advertised hook count. So rc is inspected:
# 1 yields 0, anything higher fails loudly with grep's own stderr.
count_run_hook_lines() {
  local dir="$1"; shift
  local out rc errfile
  errfile="$(mktemp)"
  set +e
  out="$(grep -rch 'command:.*run-hook' "$dir" "$@" 2>"$errfile")"
  rc=$?
  set -e
  if [ "$rc" -ge 2 ]; then
    echo "count-hooks: grep failed on $dir (exit $rc): $(cat "$errfile")" >&2
    rm -f "$errfile"
    return 1
  fi
  rm -f "$errfile"
  printf '%s\n' "$out" | awk '{s+=$1} END{print s+0}'
}

# Agent-scoped hooks: command:.*run-hook in YAML frontmatter
# NOTE: Scans entire file, not just frontmatter. Safe because no agent/skill
# markdown body contains 'command:.*run-hook' patterns. CI test-count-components.sh
# will catch any drift if this assumption is violated.
AGENT=$(count_run_hook_lines "$PROJECT_ROOT/src/agents/")

# Skill-scoped hooks: command:.*run-hook in YAML frontmatter (same assumption as above)
SKILL=$(count_run_hook_lines "$PROJECT_ROOT/src/skills/" --include='SKILL.md')

TOTAL=$((GLOBAL + AGENT + SKILL))

echo "GLOBAL=$GLOBAL AGENT=$AGENT SKILL=$SKILL TOTAL=$TOTAL"
