#!/usr/bin/env bash
# Test: a build-contract agent must have a maxTurns budget above its own
# documented workload (#4628).
#
# Why: when a subagent hits maxTurns, CC stops its query loop mid-task. Files are
# written but the commit and the StructuredOutput have not happened, and the
# Workflow runtime reports the generic "subagent completed without calling
# StructuredOutput (after in-conversation nudge)". The agent() options have no
# maxTurns override, so the frontmatter value is the only lever.
#
# Rule: for every agent whose body carries the build-result contract
# (mentions committed_sha), maxTurns >= upper bound of the second
# "N-M tool calls" line in its Resource Scaling section + HEADROOM.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
AGENTS_DIR="$REPO_ROOT/src/agents"
HEADROOM=5

FAILED=0
CHECKED=0

echo "=== Agent maxTurns Budget Test (#4628) ==="

for agent_file in "$AGENTS_DIR"/*.md; do
  name=$(basename "$agent_file" .md)
  grep -q "committed_sha" "$agent_file" || continue

  # awk exits 0 on no match; an empty value is failed loudly below
  max_turns=$(awk '/^---$/ {fm++; next} fm == 1 && /^maxTurns:/ {sub(/^maxTurns:[ \t]*/, ""); print; exit}' "$agent_file")
  upper=$(awk 'match($0, /[0-9]+-[0-9]+ tool calls/) {n++; if (n == 2) {s = substr($0, RSTART, RLENGTH); sub(/^[0-9]+-/, "", s); sub(/ .*/, "", s); print s; exit}}' "$agent_file")

  if [[ -z "$max_turns" || -z "$upper" ]]; then
    echo "FAIL: $name: cannot read maxTurns ('$max_turns') or the second Resource Scaling tier ('$upper')"
    FAILED=1
    continue
  fi

  CHECKED=$((CHECKED + 1))
  need=$((upper + HEADROOM))
  if (( max_turns < need )); then
    echo "FAIL: $name: maxTurns $max_turns < $need (second tier upper bound $upper + $HEADROOM headroom)"
    FAILED=1
  else
    echo "PASS: $name: maxTurns $max_turns >= $need"
  fi
done

if (( CHECKED == 0 )); then
  echo "FAIL: no agent with committed_sha found, the check matched nothing"
  exit 1
fi

echo "checked $CHECKED agents"
exit $FAILED
