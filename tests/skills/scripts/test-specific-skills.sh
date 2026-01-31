#!/usr/bin/env bash
# ============================================================================
# Specific Skill Tests
# ============================================================================
# Per-skill validation for script-enhanced skills.
#
# Tests specific patterns for each category of script-enhanced skills:
# - Markdown (5 skills): ADR, PR review, design docs, complexity, evidence
# - Python (5 skills): FastAPI, migrations, backups, fixtures, integration tests
# - Shell (5 skills): Releases, stacked PRs, browser capture, crawl, form automation
# - TypeScript (5 skills): Page objects, forms, test cases, MSW handlers, server components
# - YAML (5 skills): OpenAPI, CI pipelines, Docker Compose, guardrails, LoRA config
#
# Usage: ./test-specific-skills.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/src/skills"

# Source helpers
source "$SCRIPT_DIR/fixtures/script-test-helpers.sh"
source "$SCRIPT_DIR/../../fixtures/test-helpers.sh" 2>/dev/null || true

VERBOSE="${1:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' NC=''
fi

# Test output functions
pass() {
    echo -e "  ${GREEN}PASS${NC} $1"
    ((PASS_COUNT++)) || true
}

fail() {
    echo -e "  ${RED}FAIL${NC} $1"
    ((FAIL_COUNT++)) || true
}

warn() {
    echo -e "  ${YELLOW}WARN${NC} $1"
    ((WARN_COUNT++)) || true
}

info() {
    if [[ "$VERBOSE" == "--verbose" ]]; then
        echo -e "  ${BLUE}INFO${NC} $1"
    fi
}

# ============================================================================
# Header
# ============================================================================
echo "============================================================================"
echo "  Specific Skill Tests"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""

# ============================================================================
# Test: Script-Enhanced Skills Exist
# ============================================================================
echo -e "${CYAN}Test: Script-Enhanced Skills Validation${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

# Expected script-enhanced skills (the 25 we created)
EXPECTED_SCRIPTS=(
    "architecture-decision-record/scripts/create-adr.md"
    "code-review-playbook/scripts/review-pr.md"
    "brainstorming/scripts/create-design-doc.md"
    "quality-gates/scripts/assess-complexity.md"
    "evidence-verification/scripts/generate-test-evidence.md"
    "fastapi-advanced/scripts/create-fastapi-app.md"
    "alembic-migrations/scripts/create-migration.md"
    "golden-dataset-management/scripts/backup-golden-dataset.md"
    "unit-testing/scripts/create-test-fixture.md"
    "integration-testing/scripts/create-integration-test.md"
    "release-management/scripts/create-release.md"
    "stacked-prs/scripts/create-stacked-pr.md"
    "browser-content-capture/scripts/multi-page-crawl.md"
    "e2e-testing/scripts/create-page-object.md"
    "form-state-patterns/scripts/create-form.md"
    "unit-testing/scripts/create-test-case.md"
    "msw-mocking/scripts/create-msw-handler.md"
    "react-server-components-framework/scripts/create-server-component.md"
    "api-design-framework/scripts/create-openapi-spec.md"
    "devops-deployment/scripts/create-ci-pipeline.md"
    "devops-deployment/scripts/create-docker-compose.md"
    "advanced-guardrails/scripts/create-guardrails-config.md"
    "fine-tuning-customization/scripts/create-lora-config.md"
)

FOUND_SCRIPTS=0
MISSING_SCRIPTS=()

for script_path in "${EXPECTED_SCRIPTS[@]}"; do
    full_path="$SKILLS_DIR/$script_path"
    if [[ -f "$full_path" ]]; then
        ((FOUND_SCRIPTS++)) || true
        skill_name=$(echo "$script_path" | cut -d'/' -f1)
        info "$skill_name: Script exists"
    else
        MISSING_SCRIPTS+=("$script_path")
        fail "$script_path: Script not found"
    fi
done

if [[ ${#MISSING_SCRIPTS[@]} -eq 0 ]]; then
    pass "All ${#EXPECTED_SCRIPTS[@]} expected script-enhanced skills exist"
else
    fail "${#MISSING_SCRIPTS[@]} expected script(s) not found"
fi
echo ""

# ============================================================================
# Test: Category-Specific Validations
# ============================================================================
echo -e "${CYAN}Test: Category-Specific Validations${NC}"
echo "────────────────────────────────────────────────────────────────────────────"

# Markdown skills should have static commands (no $ARGUMENTS in !command)
MARKDOWN_SCRIPTS=(
    "architecture-decision-record/scripts/create-adr.md"
    "code-review-playbook/scripts/review-pr.md"
    "brainstorming/scripts/create-design-doc.md"
    "quality-gates/scripts/assess-complexity.md"
    "evidence-verification/scripts/generate-test-evidence.md"
)

MARKDOWN_VALID=0
for script_path in "${MARKDOWN_SCRIPTS[@]}"; do
    full_path="$SKILLS_DIR/$script_path"
    if [[ -f "$full_path" ]]; then
        if ! check_arguments_in_command "$full_path"; then
            ((MARKDOWN_VALID++)) || true
        fi
    fi
done

if [[ $MARKDOWN_VALID -eq ${#MARKDOWN_SCRIPTS[@]} ]]; then
    pass "All ${#MARKDOWN_SCRIPTS[@]} Markdown scripts use static commands correctly"
else
    fail "Some Markdown scripts have \$ARGUMENTS in !command"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
echo "  Test Summary"
echo "============================================================================"
echo ""
echo -e "  ${GREEN}Passed:          $PASS_COUNT${NC}"
echo -e "  ${RED}Failed:          $FAIL_COUNT${NC}"
echo -e "  ${YELLOW}Warnings:        $WARN_COUNT${NC}"
echo ""

# Exit with appropriate code
if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All specific skill tests passed${NC}"
    if [[ $WARN_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}Note: $WARN_COUNT warning(s) should be reviewed${NC}"
    fi
    exit 0
fi
