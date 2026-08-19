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
#
# The scratch file that carries that stderr is a REPORTING convenience and must
# never gate the count (#3564). It used to be a bare `mktemp`. When the system
# temp dir denied the write (EPERM, e.g. under a sandbox), `errfile` came back
# empty, `2>""` failed as a redirect, grep never ran, and rc came back 1, which
# this function is required to read as "no match" -> 0. A real SKILL count of 21
# silently became 0 and validate-counts reported "declared 171, actual 150"
# against a tree with no drift at all. Editing the manifest to match that 150
# would have introduced the very drift the check exists to catch.
#
# So: ask for the temp file, verify we can actually write it, and when we cannot,
# drop the stderr capture and keep counting. Losing a quoted error message is a
# cosmetic loss. Losing the count is a correctness one.
count_run_hook_lines() {
  local dir="$1"; shift
  local out rc errfile

  errfile="$(mktemp "${TMPDIR:-/tmp}/count-hooks.XXXXXX" 2>/dev/null || true)"
  if [ -n "$errfile" ] && [ ! -w "$errfile" ]; then
    errfile=""
  fi

  set +e
  if [ -n "$errfile" ]; then
    out="$(grep -rch 'command:.*run-hook' "$dir" "$@" 2>"$errfile")"
    rc=$?
  else
    # No writable scratch file: let grep's stderr reach the terminal rather than
    # redirecting it into a path that does not exist.
    out="$(grep -rch 'command:.*run-hook' "$dir" "$@")"
    rc=$?
  fi
  set -e

  if [ "$rc" -ge 2 ]; then
    local detail="(stderr not captured: no writable temp dir)"
    if [ -n "$errfile" ]; then
      detail="$(cat "$errfile")"
    fi
    echo "count-hooks: grep failed on $dir (exit $rc): $detail" >&2
    if [ -n "$errfile" ]; then
      rm -f "$errfile"
    fi
    return 1
  fi

  if [ -n "$errfile" ]; then
    rm -f "$errfile"
  fi

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
