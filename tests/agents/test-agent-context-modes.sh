#!/usr/bin/env bash
# Test: Validates all agents have explicit context mode declaration
# CC 2.1.6 requires explicit context: fork|inherit|none

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/src/agents"

FAILED=0

echo "=== Agent Context Modes Test ==="
echo ""

for agent_file in "$AGENTS_DIR"/*.md; do
  agent_name=$(basename "$agent_file" .md)

  if ! grep -q "^context:" "$agent_file"; then
    echo "FAIL: $agent_name missing explicit context: declaration"
    FAILED=1
  else
    context_mode=$(grep "^context:" "$agent_file" | awk '{print $2}')

    # Validate context mode is valid
    if [[ "$context_mode" != "fork" && "$context_mode" != "inherit" && "$context_mode" != "none" ]]; then
      echo "FAIL: $agent_name has invalid context mode: $context_mode (must be fork|inherit|none)"
      FAILED=1
    else
      echo "PASS: $agent_name has context: $context_mode"
    fi
  fi
done

echo ""

if [[ $FAILED -eq 1 ]]; then
  echo "❌ Agent context modes test FAILED"
  exit 1
else
  echo "✅ All agents have explicit context modes"
  exit 0
fi