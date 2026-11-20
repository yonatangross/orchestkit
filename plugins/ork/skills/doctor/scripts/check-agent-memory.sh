#!/usr/bin/env bash
# Agent-memory directory health for /ork:doctor.
#
# The memory: frontmatter feature writes .claude/agent-memory/NAME/MEMORY.md.
# Category 4 already checks the MCP graph and the auto-memory index. This script
# checks the per-agent directory those two miss.
#
#   orphan    a directory whose name is not an agent name in --agents-dir
#   stale     MEMORY.md older than --stale-days, and the activity file says
#             the agent ran after that write (idle agents are not stale)
#   size      MEMORY.md at or over --warn-lines (default 150). Spawn injection
#             silently drops past about 200 lines.
#   secret    a token-shaped or PII-shaped string anywhere under the root
#
# Usage:
#   check-agent-memory.sh --memory-root DIR --agents-dir DIR
#       [--stale-days N] [--warn-lines N] [--now EPOCH] [--activity-file PATH]
#
# Activity file: one "name<TAB>unix-epoch" line per agent that ran.
# Without it, staleness is skipped (no false stale on an agent that never ran).
#
# Exit 0 when nothing is wrong. Exit 1 when any finding is printed. Exit 2 on usage.

set -euo pipefail

MEMORY_ROOT=""
AGENTS_DIR=""
STALE_DAYS=30
WARN_LINES=150
NOW=""
ACTIVITY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --memory-root) MEMORY_ROOT="$2"; shift 2 ;;
    --agents-dir) AGENTS_DIR="$2"; shift 2 ;;
    --stale-days) STALE_DAYS="$2"; shift 2 ;;
    --warn-lines) WARN_LINES="$2"; shift 2 ;;
    --now) NOW="$2"; shift 2 ;;
    --activity-file) ACTIVITY="$2"; shift 2 ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$MEMORY_ROOT" || -z "$AGENTS_DIR" ]]; then
  echo "need --memory-root and --agents-dir" >&2
  exit 2
fi
if [[ ! -d "$AGENTS_DIR" ]]; then
  echo "agents dir missing: $AGENTS_DIR" >&2
  exit 2
fi

if [[ -z "$NOW" ]]; then
  NOW=$(python3 -c 'import time; print(int(time.time()))')
fi

mtime() {
  python3 -c 'import os,sys; print(int(os.stat(sys.argv[1]).st_mtime))' "$1"
}

# First frontmatter name: only, so a later "name:" in the body cannot match.
agent_names=$(
  for f in "$AGENTS_DIR"/*.md; do
    [[ -f "$f" ]] || continue
    awk 'BEGIN{fm=0} /^---$/{fm++; if (fm==2) exit} fm==1 && /^name:[[:space:]]*/{sub(/^name:[[:space:]]*/,""); print; exit}' "$f"
  done | sort -u
)

FINDINGS=0
note() { echo "$1"; FINDINGS=1; }

if [[ ! -d "$MEMORY_ROOT" ]]; then
  echo "OK agent-memory: directory absent ($MEMORY_ROOT)"
  exit 0
fi

known() {
  local name="$1"
  printf '%s\n' "$agent_names" | grep -Fxq "$name"
}

# Secrets and PII. Patterns are the backstop, not a copy of any other repo's list.
SECRET_RE='AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|[Pp]assword[[:space:]]*[:=][[:space:]]*[^[:space:]]+|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|([0-9]{3}-[0-9]{2}-[0-9]{4})'

while IFS= read -r dir; do
  [[ -n "$dir" ]] || continue
  name=$(basename "$dir")
  if ! known "$name"; then
    note "ORPHAN $name: no matching agent under $AGENTS_DIR"
  fi
  mem="$dir/MEMORY.md"
  if [[ -f "$mem" ]]; then
    lines=$(wc -l < "$mem" | tr -d ' ')
    if [[ "$lines" -ge "$WARN_LINES" ]]; then
      note "SIZE $name/MEMORY.md: ${lines} lines (warn at ${WARN_LINES}; injection drops past about 200)"
    fi
    if [[ -n "$ACTIVITY" && -f "$ACTIVITY" ]]; then
      ran=$(awk -F '\t' -v n="$name" '$1==n {print $2; exit}' "$ACTIVITY" || true)
      if [[ -n "${ran:-}" ]]; then
        written=$(mtime "$mem")
        age_days=$(( (NOW - written) / 86400 ))
        if [[ "$age_days" -ge "$STALE_DAYS" && "$ran" -gt "$written" ]]; then
          note "STALE $name/MEMORY.md: untouched ${age_days}d and the agent ran after that write"
        fi
      fi
    fi
  fi
done < <(find "$MEMORY_ROOT" -mindepth 1 -maxdepth 1 -type d | sort)

if [[ -n "$ACTIVITY" && ! -f "$ACTIVITY" ]]; then
  note "ACTIVITY missing file: $ACTIVITY"
elif [[ -z "$ACTIVITY" ]]; then
  echo "SKIP staleness: no --activity-file (idle agents are not reported stale)"
fi

# Scan file contents. grep -I skips binary. No pipe (grep -q plus pipefail is #603).
while IFS= read -r -d '' hit; do
  if grep -IqE "$SECRET_RE" "$hit"; then
    rel=${hit#"$MEMORY_ROOT"/}
    note "SECRET $rel: token or PII pattern"
  fi
done < <(find "$MEMORY_ROOT" -type f -print0)

if [[ "$FINDINGS" -eq 0 ]]; then
  echo "OK agent-memory: no orphan, stale, size, or secret findings"
  exit 0
fi
exit 1
