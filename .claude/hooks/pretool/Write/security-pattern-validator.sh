#!/usr/bin/env bash
# Security Pattern Validator - LLM-powered validation hook
# Detects security anti-patterns before write
# CC 2.1.3 Feature: Uses 10-minute timeout for comprehensive analysis

set -euo pipefail

# Get the file content from environment or stdin
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_INPUT_CONTENT:-}"

if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

# Only analyze code files
case "$FILE_PATH" in
    *.py|*.ts|*.tsx|*.js|*.jsx)
        # Code files - analyze
        ;;
    *)
        # Non-code files - skip
        exit 0
        ;;
esac

# Security patterns to check (regex-based quick scan)
SECURITY_ISSUES=()

# Check for hardcoded secrets patterns
if echo "$CONTENT" | grep -qiE "(api[_-]?key|password|secret|token)\s*[=:]\s*['\"][^'\"]+['\"]"; then
    SECURITY_ISSUES+=("Potential hardcoded secret detected")
fi

# Check for SQL injection patterns (raw string concatenation in queries)
if echo "$CONTENT" | grep -qE "execute\s*\(\s*['\"].*\+|f['\"].*SELECT.*\{"; then
    SECURITY_ISSUES+=("Potential SQL injection vulnerability")
fi

# Check for eval/exec patterns
if echo "$CONTENT" | grep -qE "eval\s*\(|exec\s*\("; then
    SECURITY_ISSUES+=("Dangerous eval/exec usage detected")
fi

# Check for subprocess without shell=False
if echo "$CONTENT" | grep -qE "subprocess\.(run|call|Popen).*shell\s*=\s*True"; then
    SECURITY_ISSUES+=("Subprocess with shell=True detected")
fi

# Log results
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs"
mkdir -p "$LOG_DIR"

if [[ ${#SECURITY_ISSUES[@]} -gt 0 ]]; then
    echo "[$(date -Iseconds)] SECURITY_WARN: $FILE_PATH" >> "$LOG_DIR/security-validator.log"
    for issue in "${SECURITY_ISSUES[@]}"; do
        echo "  - $issue" >> "$LOG_DIR/security-validator.log"
    done

    # Output warning to stderr (visible to user)
    echo "⚠️  Security warnings for $FILE_PATH:" >&2
    for issue in "${SECURITY_ISSUES[@]}"; do
        echo "   - $issue" >&2
    done

    # Don't block - just warn
    exit 0
else
    echo "[$(date -Iseconds)] SECURITY_OK: $FILE_PATH" >> "$LOG_DIR/security-validator.log"
fi

exit 0