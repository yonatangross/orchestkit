#!/usr/bin/env bash
# Test: Validates CC 2.1.6 compliant YAML frontmatter
# All agents must have: name, description, model, tools, skills

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/src/agents"

REQUIRED_FIELDS=(
  "name:"
  "description:"
  "model:"
  "tools:"
  "skills:"
)

VALID_MODELS=("opus" "sonnet" "haiku" "inherit")

FAILED=0

echo "=== Agent Frontmatter Test ==="
echo ""

for agent_file in "$AGENTS_DIR"/*.md; do
  agent_name=$(basename "$agent_file" .md)
  agent_failed=0

  # Check required fields
  for field in "${REQUIRED_FIELDS[@]}"; do
    if ! grep -q "^$field" "$agent_file"; then
      echo "FAIL: $agent_name missing required field: $field"
      agent_failed=1
      FAILED=1
    fi
  done

  # Check model is valid
  model=$(grep "^model:" "$agent_file" | awk '{print $2}' || echo "")
  if [[ -n "$model" ]]; then
    valid=0
    for valid_model in "${VALID_MODELS[@]}"; do
      if [[ "$model" == "$valid_model" ]]; then
        valid=1
        break
      fi
    done
    if [[ $valid -eq 0 ]]; then
      echo "FAIL: $agent_name has invalid model: $model (must be opus|sonnet|haiku)"
      agent_failed=1
      FAILED=1
    fi
  fi

  # Check frontmatter delimiters
  if ! head -1 "$agent_file" | grep -q "^---$"; then
    echo "FAIL: $agent_name missing opening frontmatter delimiter (---)"
    agent_failed=1
    FAILED=1
  fi

  # Check closing delimiter exists
  if [[ $(grep -c "^---$" "$agent_file") -lt 2 ]]; then
    echo "FAIL: $agent_name missing closing frontmatter delimiter (---)"
    agent_failed=1
    FAILED=1
  fi

  if [[ $agent_failed -eq 0 ]]; then
    echo "PASS: $agent_name has CC 2.1.6 compliant frontmatter"
  fi
done

echo ""

if [[ $FAILED -eq 1 ]]; then
  echo "❌ Agent frontmatter test FAILED"
  exit 1
else
  echo "✅ All agents have CC 2.1.6 compliant frontmatter"
  exit 0
fi