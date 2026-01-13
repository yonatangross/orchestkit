#!/bin/bash
# output-validator.sh - Validates agent output quality and completeness

set -euo pipefail

# Get agent name from environment
AGENT_NAME="${CLAUDE_AGENT_NAME:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Read stdin (the agent's output)
OUTPUT=$(cat)

# Basic validation checks
VALIDATION_ERRORS=()
VALIDATION_WARNINGS=()

# Check 1: Output is not empty
if [ -z "$OUTPUT" ]; then
    VALIDATION_ERRORS+=("Agent produced empty output")
fi

# Check 2: Minimum length check (should have substantial content)
OUTPUT_LENGTH=${#OUTPUT}
if [ "$OUTPUT_LENGTH" -lt 50 ]; then
    VALIDATION_WARNINGS+=("Output seems very short ($OUTPUT_LENGTH chars)")
fi

# Check 3: Check for common error patterns
if echo "$OUTPUT" | grep -iq "error\|failed\|exception"; then
    VALIDATION_WARNINGS+=("Output contains error-related keywords")
fi

# Check 4: For backend architect, validate JSON structure if present
if [ "$AGENT_NAME" = "backend-system-architect" ]; then
    if echo "$OUTPUT" | grep -q "{"; then
        # Extract JSON and validate it
        if ! echo "$OUTPUT" | grep -o '{[^}]*}' | jq . > /dev/null 2>&1; then
            VALIDATION_WARNINGS+=("JSON structure may be malformed")
        fi
    fi
fi

# Build validation result
VALIDATION_STATUS="passed"
if [ ${#VALIDATION_ERRORS[@]} -gt 0 ]; then
    VALIDATION_STATUS="failed"
fi

# Create system message
SYSTEM_MESSAGE="Output Validation [$VALIDATION_STATUS] - Agent: $AGENT_NAME, Timestamp: $TIMESTAMP, Output length: $OUTPUT_LENGTH chars"

if [ ${#VALIDATION_ERRORS[@]} -gt 0 ]; then
    SYSTEM_MESSAGE="$SYSTEM_MESSAGE | Errors:"
    for error in "${VALIDATION_ERRORS[@]}"; do
        SYSTEM_MESSAGE="$SYSTEM_MESSAGE $error;"
    done
fi

if [ ${#VALIDATION_WARNINGS[@]} -gt 0 ]; then
    SYSTEM_MESSAGE="$SYSTEM_MESSAGE | Warnings:"
    for warning in "${VALIDATION_WARNINGS[@]}"; do
        SYSTEM_MESSAGE="$SYSTEM_MESSAGE $warning;"
    done
fi

# Log to file
LOG_DIR="$CLAUDE_PROJECT_DIR/.claude/logs/agent-validation"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${AGENT_NAME}_$(date +%Y%m%d_%H%M%S).log"

{
    echo "=== OUTPUT VALIDATION ==="
    echo "$SYSTEM_MESSAGE"
    echo ""
    echo "=== AGENT OUTPUT ==="
    echo "$OUTPUT"
} > "$LOG_FILE"

# CC 2.1.6 compliant: Always output JSON with continue field
if [ "$VALIDATION_STATUS" = "failed" ]; then
    jq -n --arg msg "$SYSTEM_MESSAGE" '{systemMessage: $msg, continue: false}'
    exit 0
fi

# Output systemMessage for user visibility
jq -n --arg msg "$SYSTEM_MESSAGE" '{systemMessage: $msg, continue: true}'
exit 0
