#!/bin/bash
# =============================================================================
# OrchestKit A/B Comparison Script
# =============================================================================
# Compares with-index vs without-index evaluation results.
#
# In dry-run mode (no Claude CLI): reports structural validation only.
# With Claude CLI: compares agent routing accuracy and quality metrics.
#
# Usage:
#   ./compare.sh
#
# Expects:
#   - tests/evals/results/with-index/summary.json
#   - tests/evals/results/without-index/summary.json
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVALS_DIR="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$EVALS_DIR/results"

WITH_FILE="$RESULTS_DIR/with-index/summary.json"
WITHOUT_FILE="$RESULTS_DIR/without-index/summary.json"
COMPARISON_FILE="$EVALS_DIR/comparison.json"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  A/B Comparison: With Index vs Without Index${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check files exist
if [[ ! -f "$WITH_FILE" ]]; then
    echo -e "${RED}Error: Missing $WITH_FILE${NC}"
    echo "Run: EVAL_MODE=with-index ./scripts/run-evals.sh"
    exit 1
fi

if [[ ! -f "$WITHOUT_FILE" ]]; then
    echo -e "${RED}Error: Missing $WITHOUT_FILE${NC}"
    echo "Run: EVAL_MODE=without-index ./scripts/run-evals.sh"
    exit 1
fi

# Read summaries
WITH=$(cat "$WITH_FILE")
WITHOUT=$(cat "$WITHOUT_FILE")

# Calculate comparison
jq -n \
    --argjson with "$WITH" \
    --argjson without "$WITHOUT" \
    '{
      dry_run: ($with.dry_run // false),
      with: {
        build: $with.build_rate,
        lint: $with.lint_rate,
        test: $with.test_rate,
        agent: $with.agent_rate
      },
      without: {
        build: $without.build_rate,
        lint: $without.lint_rate,
        test: $without.test_rate,
        agent: $without.agent_rate
      },
      delta: {
        build: ($with.build_rate - $without.build_rate),
        lint: ($with.lint_rate - $without.lint_rate),
        test: ($with.test_rate - $without.test_rate),
        agent: ($with.agent_rate - $without.agent_rate)
      },
      total_tests: $with.total,
      duration_seconds: ($with.total_duration + $without.total_duration),
      regression_detected: (
        if ($with.dry_run // false) then false
        else (
          ($with.build_rate - $without.build_rate) < -5 or
          ($with.test_rate - $without.test_rate) < -10 or
          ($with.agent_rate - $without.agent_rate) < -10
        )
        end
      ),
      tests: $with.tests
    }' > "$COMPARISON_FILE"

# Check if dry-run
dry_run=$(jq -r '.dry_run // false' "$COMPARISON_FILE")

if [[ "$dry_run" == "true" ]]; then
    echo -e "${YELLOW}⚠ Dry-run mode — Claude CLI was not available${NC}"
    echo -e "${YELLOW}  Structural validation only. Agent routing not evaluated.${NC}"
    echo ""

    total=$(jq -r '.total_tests' "$COMPARISON_FILE")
    echo -e "| Check               | Result                      |"
    echo -e "|---------------------|-----------------------------|"
    printf  "| %-19s | %-27s |\n" "Golden YAML parsed" "${total} test cases"
    printf  "| %-19s | %-27s |\n" "Scaffold integrity" "Files created"
    printf  "| %-19s | %-27s |\n" "Agent routing" "Skipped (no Claude CLI)"

    echo ""
    echo -e "${GREEN}✅ Structural validation passed${NC}"
else
    # Display full A/B results
    echo -e "| Metric           | Without Index | With Index | Delta     |"
    echo -e "|------------------|---------------|------------|-----------|"

    build_without=$(jq -r '.without.build | floor' "$COMPARISON_FILE")
    build_with=$(jq -r '.with.build | floor' "$COMPARISON_FILE")
    build_delta=$(jq -r '.delta.build | floor' "$COMPARISON_FILE")

    lint_without=$(jq -r '.without.lint | floor' "$COMPARISON_FILE")
    lint_with=$(jq -r '.with.lint | floor' "$COMPARISON_FILE")
    lint_delta=$(jq -r '.delta.lint | floor' "$COMPARISON_FILE")

    test_without=$(jq -r '.without.test | floor' "$COMPARISON_FILE")
    test_with=$(jq -r '.with.test | floor' "$COMPARISON_FILE")
    test_delta=$(jq -r '.delta.test | floor' "$COMPARISON_FILE")

    agent_without=$(jq -r '.without.agent | floor' "$COMPARISON_FILE")
    agent_with=$(jq -r '.with.agent | floor' "$COMPARISON_FILE")
    agent_delta=$(jq -r '.delta.agent | floor' "$COMPARISON_FILE")

    printf "| %-16s | %13s | %10s | %+9s |\n" "Build Success" "${build_without}%" "${build_with}%" "${build_delta}%"
    printf "| %-16s | %13s | %10s | %+9s |\n" "Lint Compliance" "${lint_without}%" "${lint_with}%" "${lint_delta}%"
    printf "| %-16s | %13s | %10s | %+9s |\n" "Test Passing" "${test_without}%" "${test_with}%" "${test_delta}%"
    printf "| %-16s | %13s | %10s | %+9s |\n" "Agent Routing" "${agent_without}%" "${agent_with}%" "${agent_delta}%"

    echo ""

    # Check for regression
    regression=$(jq -r '.regression_detected' "$COMPARISON_FILE")
    if [[ "$regression" == "true" ]]; then
        echo -e "${RED}⚠️  REGRESSION DETECTED${NC}"
        echo "   Build, test, or agent routing dropped significantly."
        echo "   Review changes before merging."
        exit 1
    else
        echo -e "${GREEN}✅ All metrics stable or improved${NC}"
    fi
fi

echo ""
echo -e "Comparison saved to: ${YELLOW}$COMPARISON_FILE${NC}"
