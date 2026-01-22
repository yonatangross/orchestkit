#!/usr/bin/env bash
# Security Pattern Validator - Detects security anti-patterns before write
# CC 2.1.7 Compliant: Self-contained hook with stdin reading and self-guard
set -euo pipefail

# Read stdin BEFORE sourcing common.sh
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"

# Self-guard: Only run for code files
guard_code_files || exit 0

# Get file path and content
FILE_PATH=$(get_field '.tool_input.file_path')
CONTENT=$(get_field '.tool_input.content')

[[ -z "$FILE_PATH" ]] && { output_silent_success; exit 0; }

# Security patterns to check (regex-based quick scan)
SECURITY_ISSUES=()

# Check for hardcoded secrets patterns
if echo "$CONTENT" | grep -qiE '(api[_-]?key|password|secret|token)\s*[=:]\s*['"'"'"][^'"'"'"]+['"'"'"]'; then
    SECURITY_ISSUES+=("Potential hardcoded secret detected")
fi

# Check for SQL injection patterns (raw string concatenation in queries)
if echo "$CONTENT" | grep -qE 'execute\s*\(\s*['"'"'"].*\+|f['"'"'"].*SELECT.*\{'; then
    SECURITY_ISSUES+=("Potential SQL injection vulnerability")
fi

# Check for eval/exec patterns
if echo "$CONTENT" | grep -qE 'eval\s*\(|exec\s*\('; then
    SECURITY_ISSUES+=("Dangerous eval/exec usage detected")
fi

# Check for subprocess without shell=False
if echo "$CONTENT" | grep -qE 'subprocess\.(run|call|Popen).*shell\s*=\s*True'; then
    SECURITY_ISSUES+=("Subprocess with shell=True detected")
fi

# Log results
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true

if [[ ${#SECURITY_ISSUES[@]} -gt 0 ]]; then
    echo "[$(date -Iseconds)] SECURITY_WARN: $FILE_PATH" >> "$LOG_DIR/security-validator.log" 2>/dev/null || true
    for issue in "${SECURITY_ISSUES[@]}"; do
        echo "  - $issue" >> "$LOG_DIR/security-validator.log" 2>/dev/null || true
    done

    # Build warning message
    WARNING_MSG="Security warnings for $(basename "$FILE_PATH"): ${SECURITY_ISSUES[*]}"
    log_permission_feedback "security-validator" "warn" "Security issues in $FILE_PATH: ${SECURITY_ISSUES[*]}"
    output_warning "$WARNING_MSG"
    output_silent_success
    exit 0
else
    echo "[$(date -Iseconds)] SECURITY_OK: $FILE_PATH" >> "$LOG_DIR/security-validator.log" 2>/dev/null || true
fi

log_permission_feedback "security-validator" "allow" "No security issues in $FILE_PATH"
output_silent_success
exit 0