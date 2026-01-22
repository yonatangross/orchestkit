#!/bin/bash
set -euo pipefail
# Satisfaction Detector - UserPromptSubmit Hook
# CC 2.1.7 Compliant: includes continue field and suppressOutput in all outputs
# Detects user satisfaction signals from conversation patterns
#
# Strategy:
# - Analyze user prompt for positive/negative signals
# - Track satisfaction per session
# - Log to feedback system for reporting
#
# Performance optimization (2026-01-14):
# - Sampling mode: only analyzes every Nth prompt to reduce overhead
# - Configure via SATISFACTION_SAMPLE_RATE (default: 3)
#
# Version: 1.2.0
# Part of Feedback System (#57)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
if [[ -t 0 ]]; then
    _HOOK_INPUT=""
else
    _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true

# -----------------------------------------------------------------------------
# Sampling Configuration (Performance Optimization)
# -----------------------------------------------------------------------------

# Sample rate: analyze every Nth prompt (default: 3 = every 3rd prompt)
# Set SATISFACTION_SAMPLE_RATE=1 to analyze every prompt
SAMPLE_RATE="${SATISFACTION_SAMPLE_RATE:-3}"
COUNTER_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/.satisfaction-counter"

# Ensure directory exists
mkdir -p "$(dirname "$COUNTER_FILE")" 2>/dev/null || true

# Read and increment counter
COUNTER=0
if [[ -f "$COUNTER_FILE" ]]; then
  COUNTER=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")
fi
COUNTER=$((COUNTER + 1))
echo "$COUNTER" > "$COUNTER_FILE" 2>/dev/null || true

# Skip if not on sampling interval (for performance)
if [[ "$SAMPLE_RATE" -gt 1 ]] && (( COUNTER % SAMPLE_RATE != 0 )); then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# -----------------------------------------------------------------------------
# Source Feedback Library
# -----------------------------------------------------------------------------

FEEDBACK_LIB="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/feedback-lib.sh"
if [[ -f "$FEEDBACK_LIB" ]]; then
    source "$FEEDBACK_LIB"
else
    # Fallback: check plugin root
    PLUGIN_FEEDBACK_LIB="${CLAUDE_PLUGIN_ROOT:-}/.claude/scripts/feedback-lib.sh"
    if [[ -f "$PLUGIN_FEEDBACK_LIB" ]]; then
        source "$PLUGIN_FEEDBACK_LIB"
    else
        # feedback-lib not available - silent pass (CC 2.1.7)
        echo '{"continue":true,"suppressOutput":true}'
        exit 0
    fi
fi

log_hook "Satisfaction detector hook starting (sample $COUNTER)" 2>/dev/null || true

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Minimum prompt length to analyze (skip very short messages)
MIN_PROMPT_LENGTH=2

# Session ID for tracking
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

# -----------------------------------------------------------------------------
# Extract User Prompt
# -----------------------------------------------------------------------------

USER_PROMPT=""
if [[ -n "$_HOOK_INPUT" ]]; then
    USER_PROMPT=$(echo "$_HOOK_INPUT" | jq -r '.prompt // ""' 2>/dev/null || echo "")
fi

# Skip empty prompts
if [[ -z "$USER_PROMPT" ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Skip very short prompts (likely commands)
if [[ ${#USER_PROMPT} -lt $MIN_PROMPT_LENGTH ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Skip prompts that look like commands (start with /)
if [[ "$USER_PROMPT" == /* ]]; then
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# -----------------------------------------------------------------------------
# Detect Satisfaction
# -----------------------------------------------------------------------------

# Run detection
SENTIMENT=$(detect_satisfaction "$USER_PROMPT")

# Only log non-neutral signals to avoid noise
if [[ "$SENTIMENT" != "neutral" ]]; then
    # Extract first 50 chars of prompt as context (truncate)
    CONTEXT="${USER_PROMPT:0:50}"
    if [[ ${#USER_PROMPT} -gt 50 ]]; then
        CONTEXT="${CONTEXT}..."
    fi

    # Log the satisfaction signal
    log_satisfaction "$SESSION_ID" "$SENTIMENT" "$CONTEXT"

    log_hook "Detected $SENTIMENT satisfaction signal" 2>/dev/null || true
fi

# Output CC 2.1.7 compliant JSON (silent success)
echo '{"continue":true,"suppressOutput":true}'
exit 0