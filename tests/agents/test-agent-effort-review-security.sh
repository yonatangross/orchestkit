#!/usr/bin/env bash
# Test: review and security agents run at effort high
#
# claude.dev "Spending your effort": start at medium and raise effort only
# where it measurably pays. Edge-case-heavy work (security audits, brownfield
# code review) is where high earns its tokens, so these agents are pinned
# above the medium default. Lowering one back is a deliberate change that
# has to edit this list.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/src/agents"

HIGH_EFFORT_AGENTS=(
    security-auditor
    code-quality-reviewer
)

FAILED=0

echo "=== Review and security agent effort test ==="

for agent in "${HIGH_EFFORT_AGENTS[@]}"; do
    agent_file="$AGENTS_DIR/$agent.md"
    if [[ ! -f "$agent_file" ]]; then
        echo "FAIL: $agent_file not found"
        FAILED=1
        continue
    fi
    # Read effort from the frontmatter block only (between the first two ---).
    effort=$(awk '/^---$/{n++; next} n==1 && /^effort:/{print $2; exit}' "$agent_file")
    if [[ "$effort" == "high" ]]; then
        echo "PASS: $agent effort: high"
    else
        echo "FAIL: $agent effort: ${effort:-<unset>} (want high)"
        FAILED=1
    fi
done

exit "$FAILED"
