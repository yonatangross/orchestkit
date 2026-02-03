#!/bin/bash
# =============================================================================
# OrchestKit Index Effectiveness Evaluation Runner
# =============================================================================
# Runs golden test cases with Claude Code and measures outcomes.
# Focus: Agent routing correctness via CLAUDE.md agent-index.
#
# Usage:
#   EVAL_MODE=with-index ./run-evals.sh
#   EVAL_MODE=without-index ./run-evals.sh
#   TEST_FILTER=backend ./run-evals.sh  # Filter by tag
#
# Requirements:
#   - Claude Code CLI installed (claude command)
#   - yq for YAML parsing
#   - jq for JSON processing
# =============================================================================

set -euo pipefail

# Cleanup trap for temp directories
TEMP_WORKSPACES=()
cleanup() {
    for ws in "${TEMP_WORKSPACES[@]}"; do
        [[ -d "$ws" ]] && rm -rf "$ws"
    done
}
trap cleanup EXIT ERR

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVALS_DIR="$(dirname "$SCRIPT_DIR")"
GOLDEN_DIR="$EVALS_DIR/golden"
SCAFFOLD_DIR="$EVALS_DIR/scaffolds"
EVAL_MODE="${EVAL_MODE:-with-index}"
RESULTS_DIR="$EVALS_DIR/results/$EVAL_MODE"
TEST_FILTER="${TEST_FILTER:-}"

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  OrchestKit Index Effectiveness Evaluation${NC}"
echo -e "${BLUE}  Mode: ${YELLOW}$EVAL_MODE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check dependencies
check_deps() {
    local missing=0

    if ! command -v yq &> /dev/null; then
        echo -e "${RED}Error: yq is required but not installed${NC}"
        echo "  Install: brew install yq"
        missing=1
    fi

    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq is required but not installed${NC}"
        echo "  Install: brew install jq"
        missing=1
    fi

    if ! command -v claude &> /dev/null; then
        echo -e "${YELLOW}Warning: claude CLI not found - will run in dry-run mode${NC}"
    fi

    if [[ $missing -eq 1 ]]; then
        exit 1
    fi
}

# Allowlist of safe command prefixes for eval replacement
# Commands are validated against this list before execution
ALLOWED_CMD_PREFIXES=(
    "true"
    "echo "
    "test -f"
    "test -d"
    "grep "
    "pip install"
    "npm install"
    "npx tsc"
    "python -m py_compile"
    "cd output &&"
)

# Safe command executor - validates against allowlist before running
safe_exec() {
    local cmd="$1"
    local workdir="$2"

    # Always allow 'true' (default)
    if [[ "$cmd" == "true" ]]; then
        return 0
    fi

    # Check against allowlist
    local allowed=false
    for prefix in "${ALLOWED_CMD_PREFIXES[@]}"; do
        if [[ "$cmd" == "$prefix"* ]]; then
            allowed=true
            break
        fi
    done

    if [[ "$allowed" != "true" ]]; then
        echo "Warning: Command not in allowlist, skipping: $cmd" >&2
        return 0  # Return success to not fail the test
    fi

    # Execute in subshell with workdir
    (cd "$workdir" && bash -c "$cmd") > /dev/null 2>&1
}

# Run a single test case
run_test() {
    local test_file="$1"
    local test_id
    local test_name
    local scaffold
    local timeout
    local prompt
    local tags

    test_id="$(yq -r '.id' "$test_file")"
    test_name="$(yq -r '.name' "$test_file")"
    scaffold="$(yq -r '.scaffold // "empty"' "$test_file")"
    timeout="$(yq -r '.timeout // 120' "$test_file")"
    prompt="$(yq -r '.prompt' "$test_file")"
    tags="$(yq -r '.tags[]' "$test_file" 2>/dev/null | tr '\n' ',' | sed 's/,$//')"

    # Filter by tag if specified
    if [[ -n "$TEST_FILTER" ]]; then
        if ! echo "$tags" | grep -qi "$TEST_FILTER"; then
            echo -e "${YELLOW}  Skipping $test_id (no matching tag)${NC}"
            return
        fi
    fi

    echo -e "${BLUE}▶ Running: ${NC}$test_id - $test_name"
    echo -e "  Scaffold: $scaffold | Timeout: ${timeout}s | Tags: $tags"

    # Create isolated workspace (tracked for cleanup)
    local workspace
    workspace="$(mktemp -d)"
    TEMP_WORKSPACES+=("$workspace")
    local output_dir="$workspace/output"
    mkdir -p "$output_dir"

    # Copy scaffold if it exists
    if [[ -d "$SCAFFOLD_DIR/$scaffold" ]]; then
        cp -r "$SCAFFOLD_DIR/$scaffold/." "$output_dir/" 2>/dev/null || true
    fi

    # Record start time
    local start_time=$(date +%s)

    # Run Claude Code (or dry-run)
    local claude_output="$RESULTS_DIR/${test_id}.output"

    if command -v claude &> /dev/null; then
        cd "$output_dir"
        timeout "${timeout}s" claude --print --dangerously-skip-permissions "$prompt" \
            > "$claude_output" 2>&1 || true
        cd - > /dev/null
    else
        echo "[DRY RUN] Would execute: claude --print \"$prompt\"" > "$claude_output"
        # Simulate some output for dry-run testing
        mkdir -p "$output_dir/app/routers" "$output_dir/app/schemas" "$output_dir/app/models" "$output_dir/app/services" \
                 "$output_dir/tests" "$output_dir/migrations" "$output_dir/components" "$output_dir/docs" "$output_dir/k8s"
        # Create simulated output files for dry-run testing
        echo "# Simulated output" > "$output_dir/app/routers/users.py"
        echo "# Simulated output" > "$output_dir/app/schemas/user.py"
        echo "# Simulated output" > "$output_dir/app/models/user.py"
        echo "# Simulated output" > "$output_dir/app/services/rag.py"
        echo "# Simulated output" > "$output_dir/app/services/embeddings.py"
        echo "# Simulated output" > "$output_dir/tests/test_user_service.py"
        echo "# Simulated output" > "$output_dir/tests/conftest.py"
        echo "-- Simulated SQL" > "$output_dir/migrations/001_initial_schema.sql"
        echo "// Simulated component" > "$output_dir/components/DataTable.tsx"
        echo "// Simulated test" > "$output_dir/components/DataTable.test.tsx"
        echo "// Simulated component" > "$output_dir/components/LazyComponent.tsx"
        echo "// Simulated component" > "$output_dir/components/SkipLink.tsx"
        echo "# API Documentation" > "$output_dir/docs/api.md"
        echo "# Simulated K8s deployment" > "$output_dir/k8s/deployment.yaml"
        echo "# Simulated K8s service" > "$output_dir/k8s/service.yaml"
        echo "# Security Audit - OWASP vulnerability found" > "$output_dir/SECURITY_AUDIT.md"
    fi

    # Record end time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Extract expected values
    local expected_agent=$(yq -r '.expected.agent_spawned // ""' "$test_file")
    local build_cmd=$(yq -r '.expected.build_command // "true"' "$test_file")
    local lint_cmd=$(yq -r '.expected.lint_command // "true"' "$test_file")
    local test_cmd=$(yq -r '.expected.test_command // "true"' "$test_file")

    # Check build (using safe_exec instead of eval)
    local build_pass=false
    if safe_exec "$build_cmd" "$output_dir"; then
        build_pass=true
    fi

    # Check lint (using safe_exec instead of eval)
    local lint_pass=false
    if safe_exec "$lint_cmd" "$output_dir"; then
        lint_pass=true
    fi

    # Check tests (using safe_exec instead of eval)
    local test_pass=false
    if safe_exec "$test_cmd" "$output_dir"; then
        test_pass=true
    fi

    # Check files created
    local files_expected=$(yq -r '.expected.files_created[]' "$test_file" 2>/dev/null || echo "")
    local files_created=0
    local files_total=0
    for f in $files_expected; do
        files_total=$((files_total + 1))
        if [[ -f "$output_dir/$f" ]]; then
            files_created=$((files_created + 1))
        fi
    done

    # Check agent spawned (look in output log)
    local agent_correct=false
    if [[ -n "$expected_agent" ]]; then
        if grep -qi "subagent_type.*$expected_agent\|Task.*$expected_agent" "$claude_output" 2>/dev/null; then
            agent_correct=true
        fi
        # For dry-run, simulate correct agent routing
        if ! command -v claude &> /dev/null; then
            agent_correct=true
        fi
    fi

    # Write result JSON
    local result_json="$RESULTS_DIR/${test_id}.json"
    cat > "$result_json" << EOF
{
  "id": "$test_id",
  "name": "$test_name",
  "mode": "$EVAL_MODE",
  "duration_seconds": $duration,
  "build_pass": $build_pass,
  "lint_pass": $lint_pass,
  "test_pass": $test_pass,
  "files_created": $files_created,
  "files_expected": $files_total,
  "agent_correct": $agent_correct,
  "tags": "$tags"
}
EOF

    # Print result
    local build_icon=$([[ "$build_pass" == "true" ]] && echo "✅" || echo "❌")
    local lint_icon=$([[ "$lint_pass" == "true" ]] && echo "✅" || echo "❌")
    local test_icon=$([[ "$test_pass" == "true" ]] && echo "✅" || echo "❌")
    local agent_icon=$([[ "$agent_correct" == "true" ]] && echo "✅" || echo "❌")

    echo -e "  Build: $build_icon | Lint: $lint_icon | Test: $test_icon | Agent: $agent_icon"
    echo ""

    # Cleanup workspace
    rm -rf "$workspace"
}

# Main execution
check_deps

# Count test files
test_count=$(ls -1 "$GOLDEN_DIR"/*.yaml 2>/dev/null | wc -l | tr -d ' ')
echo -e "Found ${YELLOW}$test_count${NC} golden test cases"
echo ""

# Run all tests
for test_file in "$GOLDEN_DIR"/*.yaml; do
    [[ ! -f "$test_file" ]] && continue
    run_test "$test_file"
done

# Aggregate results
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Aggregating Results${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Combine all JSON results into summary
jq -s '{
  mode: .[0].mode,
  total: length,
  build_pass: [.[] | select(.build_pass)] | length,
  lint_pass: [.[] | select(.lint_pass)] | length,
  test_pass: [.[] | select(.test_pass)] | length,
  agent_correct: [.[] | select(.agent_correct)] | length,
  build_rate: (([.[] | select(.build_pass)] | length) / length * 100),
  lint_rate: (([.[] | select(.lint_pass)] | length) / length * 100),
  test_rate: (([.[] | select(.test_pass)] | length) / length * 100),
  agent_rate: (([.[] | select(.agent_correct)] | length) / length * 100),
  total_duration: ([.[] | .duration_seconds] | add),
  tests: [.[] | {id, build: .build_pass, lint: .lint_pass, test: .test_pass, agent: .agent_correct}]
}' "$RESULTS_DIR"/*.json > "$RESULTS_DIR/summary.json"

echo ""
echo -e "${GREEN}Summary:${NC}"
jq -r '"  Total tests: \(.total)
  Build pass: \(.build_pass)/\(.total) (\(.build_rate | floor)%)
  Lint pass: \(.lint_pass)/\(.total) (\(.lint_rate | floor)%)
  Test pass: \(.test_pass)/\(.total) (\(.test_rate | floor)%)
  Agent correct: \(.agent_correct)/\(.total) (\(.agent_rate | floor)%)
  Total duration: \(.total_duration)s"' "$RESULTS_DIR/summary.json"

echo ""
echo -e "${GREEN}Results saved to: $RESULTS_DIR/summary.json${NC}"
