#!/usr/bin/env bash
# Test: read-only fan-out is pinned to haiku; review and security agents stay on opus.
# Card haiku55-adopt (Track C). Evidence: ~/.claude/hq/haiku55-adopt-desk/subagent-usage-7d.md
# (52 Opus Explore spawns in 7 days, 366M cache-read tokens, none used a file-writing tool).
#
# Check 1: every subagent_type="Explore" call in the explore rule pins model="haiku".
# Check 2: the review, security and design-review agents stay on opus (the saving must not creep onto them).
# Check 3: component-curator stays on sonnet outside the read-only trial.
# Check 4: the canonical skill agrees with the Explore model pin.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RULE="${FANOUT_RULE_PATH:-$REPO_ROOT/src/skills/explore/rules/exploration-agents.md}"
AGENTS_DIR="$REPO_ROOT/src/agents"

KEEP_OPUS=(
  code-quality-reviewer
  security-auditor
  ai-safety-auditor
  security-layer-auditor
  system-design-reviewer
  workflow-architect
)

FAILED=0

echo "=== Read-only fan-out model pin test ==="
echo ""

# --- Check 1 -----------------------------------------------------------------
if [[ ! -f "$RULE" ]]; then
  echo "FAIL: missing $RULE"
  exit 1
fi

# Parse Python examples without executing them. Prompt strings cannot supply arguments.
counts=$(python3 - "$RULE" <<'PYEOF'
import ast
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
whole = len(re.findall(r"""\bsubagent_type\s*=\s*(['"])Explore\1""", text))
total = 0
bad = 0
for block in re.findall(r"^```python\s*\n(.*?)^```", text, re.MULTILINE | re.DOTALL):
    for call in ast.walk(ast.parse(block)):
        if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name) or call.func.id != "Agent":
            continue
        types = [kw.value for kw in call.keywords if kw.arg == "subagent_type"]
        if not any(isinstance(value, ast.Constant) and value.value == "Explore" for value in types):
            continue
        total += 1
        models = [kw.value for kw in call.keywords if kw.arg == "model"]
        if len(types) != 1 or len(models) != 1 or not isinstance(models[0], ast.Constant) or models[0].value != "haiku":
            bad += 1
print(f"{total} {bad} {whole}")
PYEOF
)
read -r total bad whole <<< "$counts"

if [[ "$total" -ne "$whole" ]]; then
  echo "FAIL: Explore spawn count mismatch: AST found $total, whole file contains $whole"
  FAILED=1
elif [[ "$total" -lt 1 ]]; then
  echo "FAIL: no Explore spawn found in exploration-agents.md (test is blind)"
  FAILED=1
elif [[ "$bad" -gt 0 ]]; then
  echo "FAIL: $bad of $total Explore spawns in exploration-agents.md do not pin model=\"haiku\""
  FAILED=1
else
  echo "PASS: all $total Explore spawns pin model=\"haiku\""
fi

# --- Check 2 -----------------------------------------------------------------
for agent in "${KEEP_OPUS[@]}"; do
  f="$AGENTS_DIR/$agent.md"
  if [[ ! -f "$f" ]]; then
    echo "FAIL: keep-opus agent file missing: $agent"
    FAILED=1
    continue
  fi
  model=$(grep -m1 -E "^model:" "$f" | awk '{print $2}' | tr -d '[:space:]"'"'")
  if [[ "$model" != "opus" ]]; then
    echo "FAIL: $agent is $model but review, security and design-review agents must stay opus"
    FAILED=1
  else
    echo "PASS: $agent stays opus"
  fi
done

# --- Check 3 -----------------------------------------------------------------
cc="$AGENTS_DIR/component-curator.md"
model=$(grep -m1 -E "^model:" "$cc" | awk '{print $2}' | tr -d '[:space:]"'"'")
if [[ "$model" != "sonnet" ]]; then
  echo "FAIL: component-curator is $model, expected sonnet"
  FAILED=1
else
  echo "PASS: component-curator stays sonnet"
fi

# The curator keeps Bash and project memory, so it is outside this trial.
SKILL="$REPO_ROOT/src/skills/explore/SKILL.md"
if grep -Fq 'there is no knob' "$SKILL" || ! grep -Fq 'model="haiku"' "$SKILL"; then
  echo "FAIL: canonical explore guidance contradicts the model pin"
  FAILED=1
else
  echo "PASS: canonical explore guidance agrees with the model pin"
fi

echo ""
if [[ $FAILED -ne 0 ]]; then
  echo "Read-only fan-out model pin test FAILED"
  exit 1
fi
echo "All read-only fan-out pins hold"
