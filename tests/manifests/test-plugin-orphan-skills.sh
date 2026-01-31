#!/usr/bin/env bash
# ============================================================================
# Orphaned Skills Detection
# ============================================================================
# Validates that every skill directory in src/skills/ is claimed by at least
# one plugin manifest. Orphaned skills are invisible to users — they exist
# in source but no plugin delivers them.
#
# Tests:
# 1. For each directory in src/skills/, check it appears in at least one
#    manifest's skills array (or is covered by a skills: "all" plugin)
# 2. Report all orphaned skill directories
#
# Related: GitHub Issue #252 (Plugin Consolidation)
# Usage: ./test-plugin-orphan-skills.sh [--verbose]
# Exit codes: 0 = no orphans, 1 = orphans found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
MANIFESTS_DIR="$PROJECT_ROOT/manifests"
SKILLS_DIR="$PROJECT_ROOT/src/skills"

VERBOSE="${1:-}"

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

log_pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; PASSED_CHECKS=$((PASSED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_fail() { echo -e "  ${RED}[FAIL]${NC} $1"; FAILED_CHECKS=$((FAILED_CHECKS + 1)); TOTAL_CHECKS=$((TOTAL_CHECKS + 1)); }
log_info() { [[ "$VERBOSE" == "--verbose" ]] && echo -e "  ${BLUE}[INFO]${NC} $1" || true; }

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  Manifest Integrity: Orphaned Skills Detection"
echo "  Every src/skills/ directory must appear in at least one manifest."
echo "══════════════════════════════════════════════════════════════════════"
echo ""

if [[ ! -d "$SKILLS_DIR" ]]; then
    echo -e "${RED}ERROR:${NC} Skills directory not found: $SKILLS_DIR"
    exit 1
fi

if [[ ! -d "$MANIFESTS_DIR" ]]; then
    echo -e "${RED}ERROR:${NC} Manifests directory not found: $MANIFESTS_DIR"
    exit 1
fi

# Collect all skills referenced in domain manifests (explicit arrays only)
# We exclude plugins with skills: "all" from the orphan check since those
# are meta-plugins — we want to ensure every skill has a DOMAIN plugin home.
CLAIMED_SKILLS=$(mktemp)
HAS_ALL_PLUGIN=false
trap "rm -f $CLAIMED_SKILLS" EXIT

for manifest in "$MANIFESTS_DIR"/*.json; do
    [[ -f "$manifest" ]] || continue
    plugin_name=$(jq -r '.name' "$manifest")
    skills_type=$(jq -r '.skills | type' "$manifest")

    if [[ "$skills_type" == "array" ]]; then
        jq -r '.skills[]' "$manifest" >> "$CLAIMED_SKILLS"
    elif [[ "$skills_type" == "string" ]]; then
        skills_value=$(jq -r '.skills' "$manifest")
        if [[ "$skills_value" == "all" ]]; then
            HAS_ALL_PLUGIN=true
            log_info "Plugin '$plugin_name' uses skills: \"all\" (meta-plugin, excluded from orphan check)"
        fi
    fi
done

# Deduplicate claimed skills
CLAIMED_UNIQUE=$(sort -u "$CLAIMED_SKILLS")

# Check each skill directory
ORPHAN_COUNT=0
CLAIMED_COUNT=0
TOTAL_SKILLS=0

echo "───────────────────────────────────────────────────────────────"
echo "  Checking each skill directory against domain manifests"
echo "───────────────────────────────────────────────────────────────"

for skill_dir in "$SKILLS_DIR"/*/; do
    [[ -d "$skill_dir" ]] || continue
    skill_name=$(basename "$skill_dir")
    TOTAL_SKILLS=$((TOTAL_SKILLS + 1))

    # Check if this skill appears in any domain manifest
    if echo "$CLAIMED_UNIQUE" | grep -qx "$skill_name"; then
        log_info "Claimed: $skill_name"
        CLAIMED_COUNT=$((CLAIMED_COUNT + 1))
    else
        log_fail "ORPHAN: '$skill_name' exists in src/skills/ but is NOT in any domain manifest"
        ORPHAN_COUNT=$((ORPHAN_COUNT + 1))
    fi
done

# Summary
echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  ORPHANED SKILLS SUMMARY"
echo "══════════════════════════════════════════════════════════════════════"
echo -e "  Total skill directories:   ${BLUE}$TOTAL_SKILLS${NC}"
echo -e "  Claimed by manifests:      ${GREEN}$CLAIMED_COUNT${NC}"
echo -e "  Orphaned (no manifest):    ${RED}$ORPHAN_COUNT${NC}"
if $HAS_ALL_PLUGIN; then
    echo -e "  ${YELLOW}Note:${NC} Meta-plugin with skills:\"all\" exists, but orphans"
    echo "  still need a domain manifest for a-la-carte install."
fi
echo ""

if [[ "$ORPHAN_COUNT" -gt 0 ]]; then
    echo -e "${RED}FAILED${NC} — $ORPHAN_COUNT skill(s) have no domain plugin manifest."
    echo "  These skills exist in src/skills/ but no domain manifest claims them."
    echo "  Users installing individual plugins will never see these skills."
    echo "  See: https://github.com/yonatangross/orchestkit/issues/252"
    exit 1
else
    echo -e "${GREEN}PASSED${NC} — All skills have a domain plugin home."
    exit 0
fi
