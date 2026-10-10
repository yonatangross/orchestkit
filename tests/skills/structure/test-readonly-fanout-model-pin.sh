#!/usr/bin/env bash
# Test: read-only fan-out is pinned to haiku; review and security agents stay on opus.
# Card haiku55-adopt (Track C). Evidence: ~/.claude/hq/haiku55-adopt-desk/subagent-usage-7d.md
# (52 Opus Explore spawns in 7 days, 366M cache-read tokens, none used a file-writing tool).
#
# Check 1: every subagent_type="Explore" call in the explore rule pins model="haiku".
# Check 2: the review, security and design-review agents stay on opus (the saving must not creep onto them).
# Check 3: component-curator is haiku, has no Write/Edit tool, and has at most 25 tools.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RULE="$REPO_ROOT/src/skills/explore/rules/exploration-agents.md"
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

# Prints "<total> <unpinned>". The pin must sit in the same call: before the next subagent_type.
counts=$(python3 - "$RULE" <<'PYEOF'
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
total = 0
bad = 0
for m in re.finditer(r'subagent_type="Explore"', text):
    total += 1
    window = text[m.end(): m.end() + 80]
    nxt = window.find("subagent_type")
    if nxt != -1:
        window = window[:nxt]
    if 'model="haiku"' not in window:
        bad += 1
print(f"{total} {bad}")
PYEOF
)
total=${counts%% *}
bad=${counts##* }

if [[ "$total" -lt 1 ]]; then
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
if [[ "$model" != "haiku" ]]; then
  echo "FAIL: component-curator is $model, expected haiku"
  FAILED=1
else
  echo "PASS: component-curator is haiku"
fi

# Prints "<tool count> <write tool count>".
tools_check=$(python3 - "$cc" <<'PYEOF'
import re
import sys

content = open(sys.argv[1], encoding="utf-8").read()
fm = re.match(r"^---\n(.*?)\n---", content, re.DOTALL).group(1)
tm = re.search(r"^tools:\n((?:  - .+\n?)+)", fm, re.MULTILINE)
tools = re.findall(r"  - (.+)", tm.group(1)) if tm else []
tools = [t.strip() for t in tools]
writes = [t for t in tools if t in ("Write", "Edit", "MultiEdit", "NotebookEdit")]
print(f"{len(tools)} {len(writes)}")
PYEOF
)
ntools=${tools_check%% *}
nwrite=${tools_check##* }
if [[ "$nwrite" -gt 0 ]]; then
  echo "FAIL: component-curator is haiku but lists $nwrite write tool(s)"
  FAILED=1
elif [[ "$ntools" -gt 25 ]]; then
  echo "FAIL: component-curator lists $ntools tools (max 25 for haiku)"
  FAILED=1
else
  echo "PASS: component-curator has $ntools tools and no write tools"
fi

echo ""
if [[ $FAILED -ne 0 ]]; then
  echo "Read-only fan-out model pin test FAILED"
  exit 1
fi
echo "All read-only fan-out pins hold"
