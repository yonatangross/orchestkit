#!/usr/bin/env bash
# OrchestKit Quality Gate: Security Scan Aggregator
# Timeout: 600000ms (10 minutes) - CC 2.1.3 feature
#
# Runs multiple security tools in parallel and aggregates results.
# Uses CC 2.1.3's 10-minute hook timeout for comprehensive scanning.

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

# Configuration
RESULTS_DIR="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/logs/security"
LOG_FILE="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/hooks/logs/security-scan.log"

mkdir -p "$RESULTS_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

log "=== Security Scan Started ==="

# Track running scans
declare -a PIDS=()

# Run npm audit (Node.js)
run_npm_audit() {
    if [[ -f "package.json" ]] && [[ -f "package-lock.json" || -f "yarn.lock" || -f "pnpm-lock.yaml" ]]; then
        log "Running npm audit..."
        npm audit --json > "$RESULTS_DIR/npm-audit.json" 2>&1 || true
        log "npm audit complete"
    fi
}

# Run pip-audit (Python)
run_pip_audit() {
    if [[ -f "requirements.txt" ]] || [[ -f "pyproject.toml" ]]; then
        if command -v pip-audit &>/dev/null; then
            log "Running pip-audit..."
            pip-audit --format json > "$RESULTS_DIR/pip-audit.json" 2>&1 || true
            log "pip-audit complete"
        else
            log "pip-audit not installed, skipping"
        fi
    fi
}

# Run semgrep (if installed)
run_semgrep() {
    if command -v semgrep &>/dev/null; then
        log "Running semgrep..."
        semgrep --config auto --json --quiet > "$RESULTS_DIR/semgrep.json" 2>&1 || true
        log "semgrep complete"
    else
        log "semgrep not installed, skipping"
    fi
}

# Run bandit (Python security)
run_bandit() {
    if [[ -d "backend" ]] || find . -name "*.py" -maxdepth 2 | grep -q .; then
        if command -v bandit &>/dev/null; then
            log "Running bandit..."
            bandit -r . -f json -o "$RESULTS_DIR/bandit.json" 2>&1 || true
            log "bandit complete"
        else
            log "bandit not installed, skipping"
        fi
    fi
}

# Run secret detection
run_secret_scan() {
    log "Running secret detection..."

    # Simple pattern-based secret detection
    local secrets_found=0
    local secrets_file="$RESULTS_DIR/secrets.json"

    echo '{"findings": [' > "$secrets_file"

    # Check for common secret patterns
    while IFS= read -r -d '' file; do
        if grep -qE '(api[_-]?key|secret[_-]?key|password|token)\s*[=:]\s*["\047][^"\047]{8,}' "$file" 2>/dev/null; then
            if [[ $secrets_found -gt 0 ]]; then
                echo "," >> "$secrets_file"
            fi
            echo "{\"file\": \"$file\", \"type\": \"potential_secret\"}" >> "$secrets_file"
            ((secrets_found++)) || true
        fi
    done < <(find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.env*" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -print0 2>/dev/null)

    echo '], "count": '"$secrets_found"'}' >> "$secrets_file"
    log "Secret detection complete: $secrets_found potential issues"
}

# Aggregate results
aggregate_results() {
    local total_critical=0
    local total_high=0
    local total_medium=0
    local report="$RESULTS_DIR/aggregated-report.json"

    log "Aggregating results..."

    # Parse npm audit
    if [[ -f "$RESULTS_DIR/npm-audit.json" ]]; then
        local npm_critical
        npm_critical=$(jq '.metadata.vulnerabilities.critical // 0' "$RESULTS_DIR/npm-audit.json" 2>/dev/null || echo 0)
        local npm_high
        npm_high=$(jq '.metadata.vulnerabilities.high // 0' "$RESULTS_DIR/npm-audit.json" 2>/dev/null || echo 0)
        total_critical=$((total_critical + npm_critical))
        total_high=$((total_high + npm_high))
    fi

    # Parse pip-audit
    if [[ -f "$RESULTS_DIR/pip-audit.json" ]]; then
        local pip_count
        pip_count=$(jq 'length' "$RESULTS_DIR/pip-audit.json" 2>/dev/null || echo 0)
        total_high=$((total_high + pip_count))
    fi

    # Parse semgrep
    if [[ -f "$RESULTS_DIR/semgrep.json" ]]; then
        local semgrep_high
        semgrep_high=$(jq '[.results[] | select(.extra.severity == "ERROR")] | length' "$RESULTS_DIR/semgrep.json" 2>/dev/null || echo 0)
        total_high=$((total_high + semgrep_high))
    fi

    # Generate report
    cat > "$report" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "summary": {
    "critical": $total_critical,
    "high": $total_high,
    "medium": $total_medium
  },
  "scans_completed": [
    $(ls -1 "$RESULTS_DIR"/*.json 2>/dev/null | grep -v aggregated | sed 's/.*\//"/;s/\.json/"/' | tr '\n' ',' | sed 's/,$//')
  ]
}
EOF

    log "=== Security Scan Complete ==="
    log "Critical: $total_critical, High: $total_high, Medium: $total_medium"

    # Output summary to stderr for visibility
    if [[ $total_critical -gt 0 ]]; then
        echo "Security: $total_critical critical, $total_high high vulnerabilities found" >&2
    fi
}

# Main execution
main() {
    cd "${CLAUDE_PROJECT_DIR:-$PWD}"

    # Run scans in parallel
    run_npm_audit &
    PIDS+=($!)

    run_pip_audit &
    PIDS+=($!)

    run_semgrep &
    PIDS+=($!)

    run_bandit &
    PIDS+=($!)

    run_secret_scan &
    PIDS+=($!)

    # Wait for all scans to complete
    for pid in "${PIDS[@]}"; do
        wait "$pid" 2>/dev/null || true
    done

    # Aggregate results
    aggregate_results
}

# Output CC 2.1.7 compliant JSON first
echo '{"continue":true,"suppressOutput":true}'
main "$@"
exit 0