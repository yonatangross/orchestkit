#!/usr/bin/env bash
# =============================================================================
# Lifecycle Audit — meta-runner for all orphan/stale detectors
# =============================================================================
# Runs every test under tests/orphans/ plus the existing
# test-plugin-orphan-skills.sh. Advisory by default — reports all findings,
# doesn't fail. Set LIFECYCLE_ENFORCE=1 to fail on any detector's output.
#
# Use after merging a PR, before cutting a release, or any time you feel
# the repo has drifted.
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BOLD='\033[1m'; BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

ENFORCE="${LIFECYCLE_ENFORCE:-0}"

echo -e "${BLUE}${BOLD}OrchestKit Lifecycle Audit${NC}"
echo -e "$(date +%Y-%m-%d' '%H:%M:%S)"
echo ""

detectors=(
    "tests/orphans/test-stale-playgrounds.sh|stale playgrounds"
    "tests/manifests/test-plugin-orphan-skills.sh|orphan skills in manifest"
    "tests/orphans/test-orphan-agents.sh|orphan agents"
    "tests/orphans/test-orphan-rules.sh|orphan rule/reference files"
)

failures=()

for entry in "${detectors[@]}"; do
    IFS='|' read -r script label <<< "$entry"
    echo -e "${BOLD}── $label ──${NC}"
    full="$REPO_ROOT/$script"
    if [[ ! -f "$full" ]]; then
        echo -e "  ${YELLOW}skipped: script not found ($script)${NC}"
        echo ""
        continue
    fi
    if ! bash "$full"; then
        failures+=("$label")
    fi
    echo ""
done

echo -e "${BLUE}${BOLD}Audit summary${NC}"
if [[ ${#failures[@]} -eq 0 ]]; then
    echo -e "${GREEN}✓ All detectors reported clean (or advisory-only findings).${NC}"
    exit 0
fi

echo -e "${YELLOW}⚠ ${#failures[@]} detector(s) reported issues:${NC}"
printf '  - %s\n' "${failures[@]}"
echo ""

if [[ "$ENFORCE" == "1" ]]; then
    echo -e "${RED}LIFECYCLE_ENFORCE=1 — failing.${NC}"
    exit 1
fi

exit 0
