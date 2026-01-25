#!/usr/bin/env bash
# Test: Validates agent model selection is appropriate for task complexity
# Security and research agents should NEVER use haiku

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/src/agents"

# Agents that require deeper reasoning - should NOT use haiku
PROHIBITED_HAIKU_AGENTS=(
  "security-auditor"
  "security-layer-auditor"
  "ux-researcher"
  "rapid-ui-designer"
)

FAILED=0

echo "=== Agent Model Selection Test ==="
echo ""

for agent in "${PROHIBITED_HAIKU_AGENTS[@]}"; do
  agent_file="$AGENTS_DIR/${agent}.md"

  if [[ ! -f "$agent_file" ]]; then
    echo "WARN: Agent file not found: $agent_file"
    continue
  fi

  model=$(grep -E "^model:" "$agent_file" | awk '{print $2}' || echo "")

  if [[ "$model" == "haiku" ]]; then
    echo "FAIL: $agent uses haiku but requires sonnet/opus for complex reasoning"
    FAILED=1
  else
    echo "PASS: $agent uses $model (appropriate)"
  fi
done

echo ""

if [[ $FAILED -eq 1 ]]; then
  echo "❌ Agent model selection test FAILED"
  exit 1
else
  echo "✅ All agent model selections appropriate"
  exit 0
fi