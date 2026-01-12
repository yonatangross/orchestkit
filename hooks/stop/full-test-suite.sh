#!/usr/bin/env bash
# SkillForge Quality Gate: Full Test Suite Runner
# Timeout: 600000ms (10 minutes) - CC 2.1.3 feature
#
# Runs the complete test suite on conversation stop.
# Uses CC 2.1.3's 10-minute hook timeout for comprehensive testing.

set -euo pipefail

# Source common utilities (check file exists first to avoid set -e exit)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SCRIPT_DIR/../common.sh" ]] && source "$SCRIPT_DIR/../common.sh" || true

# Log file
LOG_FILE="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/logs/full-test-suite.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "=== Full Test Suite Started ==="

# Detect project type and run appropriate tests
run_tests() {
    local exit_code=0

    # Python project (pytest)
    if [[ -f "pytest.ini" ]] || [[ -f "pyproject.toml" ]] || [[ -d "tests" && -f "requirements.txt" ]]; then
        log "Detected Python project, running pytest..."
        if command -v pytest &>/dev/null; then
            pytest --tb=short --timeout=300 -q 2>&1 | tee -a "$LOG_FILE" || exit_code=$?
        else
            log "pytest not found, skipping Python tests"
        fi
    fi

    # Node.js project (npm/yarn/pnpm)
    if [[ -f "package.json" ]]; then
        log "Detected Node.js project..."

        # Check for test script
        if jq -e '.scripts.test' package.json &>/dev/null; then
            log "Running npm test..."
            if command -v pnpm &>/dev/null; then
                pnpm test --passWithNoTests 2>&1 | tee -a "$LOG_FILE" || exit_code=$?
            elif command -v yarn &>/dev/null; then
                yarn test --passWithNoTests 2>&1 | tee -a "$LOG_FILE" || exit_code=$?
            else
                npm test -- --passWithNoTests --watchAll=false 2>&1 | tee -a "$LOG_FILE" || exit_code=$?
            fi
        else
            log "No test script in package.json, skipping"
        fi
    fi

    # Go project
    if [[ -f "go.mod" ]]; then
        log "Detected Go project, running go test..."
        if command -v go &>/dev/null; then
            go test -v -timeout 5m ./... 2>&1 | tee -a "$LOG_FILE" || exit_code=$?
        fi
    fi

    # Rust project
    if [[ -f "Cargo.toml" ]]; then
        log "Detected Rust project, running cargo test..."
        if command -v cargo &>/dev/null; then
            cargo test 2>&1 | tee -a "$LOG_FILE" || exit_code=$?
        fi
    fi

    return $exit_code
}

# Check if we should run tests
# Skip if no changes since last test
should_run_tests() {
    local last_run_file="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/logs/.last-test-run"

    # Always run if no previous run
    [[ ! -f "$last_run_file" ]] && return 0

    # Check if any code files changed since last run
    local last_run_time
    last_run_time=$(cat "$last_run_file")

    # Find modified files (simplified check)
    if git diff --name-only HEAD 2>/dev/null | grep -qE '\.(py|js|ts|go|rs)$'; then
        return 0
    fi

    log "No code changes detected, skipping tests"
    return 1
}

# Main execution
main() {
    cd "${CLAUDE_PROJECT_DIR:-$PWD}"

    if should_run_tests; then
        if run_tests; then
            log "=== All tests passed ==="
            echo "$(date +%s)" > "${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/logs/.last-test-run"
            exit 0
        else
            log "=== Some tests failed ==="
            # Don't block - just log the failure
            exit 0
        fi
    fi

    exit 0
}

main "$@"