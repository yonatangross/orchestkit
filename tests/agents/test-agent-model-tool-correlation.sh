#!/usr/bin/env bash
# Test: Validates v7.0.0 model routing optimization
# Checks that agent model assignments correlate correctly with their tool access.
#
# Rule 1: Haiku agents in NON-OPERATIONAL categories (product, analytics) must not
#         have unguarded write-tool access. Write access must be blocked via:
#           (a) disallowedTools covering Write, Edit, or MultiEdit, OR
#           (b) a PreToolUse hook that guards write operations.
#         Operational categories (devops, docs, git, product, data, testing)
#         may have Write/Edit as writing files is their core function.
#
# Rule 2: ALL opus agents must be high-complexity:
#         name must contain one of: safety, security, event-driven, system-design, workflow
#
# Rule 3: NO haiku agent should have more than 12 tools listed.
#         Large tool sets signal a task that needs a more capable model tier.
#
# Rule 4: All agents with Write/Edit/MultiEdit in their tools list that use haiku
#         must be in operational categories (devops, docs, git).
#         Non-operational haiku agents (e.g. analytics) with write tools are a routing violation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/src/agents"

FAILED=0

# Categories where haiku + Write/Edit is expected (file creation is core work)
# devops/docs/git: obvious file operations
# product/data/testing: business cases, pipeline configs, eval results, metric specs
OPERATIONAL_CATEGORIES=("devops" "docs" "git" "product" "data" "testing")

echo "=== Agent Model-Tool Correlation Test (v7.0.0) ==="
echo ""

# ---------------------------------------------------------------------------
# Helper: list tools from frontmatter (one per line, stripped)
# ---------------------------------------------------------------------------
get_tools() {
  local file="$1"
  python3 - "$file" <<'PYEOF'
import sys, re

content = open(sys.argv[1]).read()
m = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
if not m:
    sys.exit(0)
fm = m.group(1)
tm = re.search(r'^tools:\n((?:  - .+\n?)+)', fm, re.MULTILINE)
if not tm:
    sys.exit(0)
for line in re.findall(r'  - (.+)', tm.group(1)):
    print(line.strip())
PYEOF
}

# ---------------------------------------------------------------------------
# Helper: get disallowedTools line value (spaces removed)
# ---------------------------------------------------------------------------
get_disallowed() {
  local file="$1"
  grep "^disallowedTools:" "$file" 2>/dev/null \
    | sed 's/^disallowedTools://' \
    | tr -d '[:space:]' \
    || true
}

# ---------------------------------------------------------------------------
# Helper: return 0 (true) if tool name is a write tool
# ---------------------------------------------------------------------------
is_write_tool() {
  case "$1" in
    Write|Edit|MultiEdit) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# Helper: return 0 if agent has a PreToolUse hook that guards write access
# Known write-guard hooks: agent/block-writes, ci-safety-check,
#                          pre-commit-simulation, agent/ci-safety-check
# ---------------------------------------------------------------------------
has_write_guard_hook() {
  local file="$1"
  python3 - "$file" <<'PYEOF'
import sys, re

content = open(sys.argv[1]).read()
m = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
if not m:
    sys.exit(1)
fm = m.group(1)

hooks_m = re.search(r'^hooks:\s*\n((?:[ \t].+\n?)*)', fm, re.MULTILINE)
if not hooks_m:
    sys.exit(1)

hooks_block = hooks_m.group(1)

GUARD_PATTERNS = [
    r'agent/block-writes',
    r'agent/ci-safety-check',
    r'ci-safety-check',
    r'pre-commit-simulation',
]

for pat in GUARD_PATTERNS:
    if re.search(pat, hooks_block):
        sys.exit(0)  # write guard found

sys.exit(1)  # no write guard
PYEOF
}

# ---------------------------------------------------------------------------
# Helper: return 0 if category is operational (write access is core function)
# ---------------------------------------------------------------------------
is_operational_category() {
  local file="$1"
  local cat
  cat=$(grep "^category:" "$file" | awk '{print $2}' || echo "")
  for op_cat in "${OPERATIONAL_CATEGORIES[@]}"; do
    if [[ "$cat" == "$op_cat" ]]; then
      return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------------
# Rule 1 & 4: Non-operational haiku agents must not have unguarded write tools
# ---------------------------------------------------------------------------
echo "--- Rule 1 & 4: Non-operational haiku agents must not have unguarded write-tool access ---"
echo "    (Operational categories: ${OPERATIONAL_CATEGORIES[*]} may use Write/Edit freely)"
echo ""

for agent_file in "$AGENTS_DIR"/*.md; do
  agent_name=$(basename "$agent_file" .md)
  model=$(grep "^model:" "$agent_file" | awk '{print $2}' || echo "")

  [[ "$model" != "haiku" ]] && continue

  # Collect write tools present in the tools list
  write_tools_found=()
  while IFS= read -r tool; do
    if is_write_tool "$tool"; then
      write_tools_found+=("$tool")
    fi
  done < <(get_tools "$agent_file")

  if [[ ${#write_tools_found[@]} -eq 0 ]]; then
    echo "PASS: $agent_name (haiku) — no write tools listed"
    continue
  fi

  # Has write tools — operational categories are exempt (writing is their job)
  if is_operational_category "$agent_file"; then
    cat=$(grep "^category:" "$agent_file" | awk '{print $2}')
    echo "PASS: $agent_name (haiku/$cat) — write tools expected for operational agent"
    continue
  fi

  # Non-operational haiku with write tools — must have a guard
  disallowed=$(get_disallowed "$agent_file")

  if echo "$disallowed" | grep -qE "Write|Edit|MultiEdit"; then
    echo "PASS: $agent_name (haiku) — write tools blocked via disallowedTools"
    continue
  fi

  if has_write_guard_hook "$agent_file"; then
    echo "PASS: $agent_name (haiku) — write tools guarded by PreToolUse hook"
    continue
  fi

  echo "FAIL: $agent_name (haiku, non-operational) has unguarded write tools (${write_tools_found[*]})"
  echo "      Add disallowedTools: [Write, Edit, MultiEdit] or a write-guard PreToolUse hook"
  FAILED=1
done

echo ""

# ---------------------------------------------------------------------------
# Rule 2: Opus agents must be high-complexity
# Patterns: security, safety, event-driven, system-design, workflow
# ---------------------------------------------------------------------------
echo "--- Rule 2: Opus agents must be high-complexity (security/safety/design/orchestration) ---"
echo ""

OPUS_COMPLEXITY_PATTERNS=(
  "security"
  "safety"
  "event-driven"
  "system-design"
  "workflow"
)

for agent_file in "$AGENTS_DIR"/*.md; do
  agent_name=$(basename "$agent_file" .md)
  model=$(grep "^model:" "$agent_file" | awk '{print $2}' || echo "")

  [[ "$model" != "opus" ]] && continue

  matched=0
  matched_pattern=""
  for pattern in "${OPUS_COMPLEXITY_PATTERNS[@]}"; do
    if [[ "$agent_name" == *"$pattern"* ]]; then
      matched=1
      matched_pattern="$pattern"
      break
    fi
  done

  if [[ $matched -eq 1 ]]; then
    echo "PASS: $agent_name (opus) — matches high-complexity pattern '$matched_pattern'"
  else
    echo "FAIL: $agent_name (opus) — name does not match any high-complexity pattern"
    echo "      Valid patterns: ${OPUS_COMPLEXITY_PATTERNS[*]}"
    echo "      Opus is reserved for security, safety, system-design, event-driven, or workflow agents"
    FAILED=1
  fi
done

echo ""

# ---------------------------------------------------------------------------
# Rule 3: No haiku agent should have more than 12 tools listed
# ---------------------------------------------------------------------------
HAIKU_MAX_TOOLS=12

echo "--- Rule 3: No haiku agent should have more than $HAIKU_MAX_TOOLS tools ---"
echo ""

for agent_file in "$AGENTS_DIR"/*.md; do
  agent_name=$(basename "$agent_file" .md)
  model=$(grep "^model:" "$agent_file" | awk '{print $2}' || echo "")

  [[ "$model" != "haiku" ]] && continue

  tool_count=$(get_tools "$agent_file" | wc -l | tr -d '[:space:]')

  if [[ "$tool_count" -le $HAIKU_MAX_TOOLS ]]; then
    echo "PASS: $agent_name (haiku) — $tool_count tools (<= $HAIKU_MAX_TOOLS)"
  else
    echo "FAIL: $agent_name (haiku) — $tool_count tools exceeds limit of $HAIKU_MAX_TOOLS"
    echo "      Large tool sets indicate a task that needs sonnet or opus"
    FAILED=1
  fi
done

echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
if [[ $FAILED -eq 1 ]]; then
  echo "FAILED: Agent model-tool correlation test found violations"
  exit 1
else
  echo "PASSED: All agent model-tool correlations are correct"
  exit 0
fi
