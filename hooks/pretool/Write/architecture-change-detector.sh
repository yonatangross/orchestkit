#!/usr/bin/env bash
# Architecture Change Detector - Detects breaking architectural changes
# CC 2.1.9 Enhanced: Injects architectural guidelines as additionalContext
set -euo pipefail

# Read stdin BEFORE sourcing common.sh
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"

# Self-guard: Only run for architectural paths
guard_path_pattern "**/api/**" "**/services/**" "**/db/**" "**/models/**" "**/workflows/**" || exit 0

# Get file path
FILE_PATH=$(get_field '.tool_input.file_path')
[[ -z "$FILE_PATH" ]] && { output_silent_success; exit 0; }

# Determine architectural layer from path
ARCH_LAYER="unknown"
case "$FILE_PATH" in
    **/api/**|**/routes/**|**/endpoints/**)
        ARCH_LAYER="api-layer"
        ;;
    **/services/**)
        ARCH_LAYER="service-layer"
        ;;
    **/db/**|**/models/**|**/repositories/**)
        ARCH_LAYER="data-layer"
        ;;
    **/workflows/**|**/agents/**)
        ARCH_LAYER="workflow-layer"
        ;;
esac

# Load known patterns if available
PATTERNS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/context/patterns"
PATTERN_HINTS=""
if [[ -d "$PATTERNS_DIR" ]]; then
    # Check for layer-specific patterns
    LAYER_PATTERN_FILE="$PATTERNS_DIR/${ARCH_LAYER}.json"
    if [[ -f "$LAYER_PATTERN_FILE" ]]; then
        PATTERN_COUNT=$(jq 'length' "$LAYER_PATTERN_FILE" 2>/dev/null || echo "0")
        if [[ "$PATTERN_COUNT" -gt 0 ]]; then
            PATTERN_HINTS=" | Patterns loaded: $PATTERN_COUNT"
        fi
    fi
fi

# Log the detection
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
echo "[$(date -Iseconds)] ARCH_DETECT: $FILE_PATH (layer=$ARCH_LAYER)" >> "$LOG_DIR/architecture-detector.log" 2>/dev/null || true

# CC 2.1.9: Build architecture context
ARCH_CONTEXT=""
if [[ "$ARCH_LAYER" != "unknown" ]]; then
    # Check if file exists (new file vs modification)
    if [[ ! -f "$FILE_PATH" ]]; then
        ARCH_CONTEXT="New $ARCH_LAYER file. Follow layer conventions: dependency injection, interface contracts$PATTERN_HINTS"
    else
        ARCH_CONTEXT="Modifying $ARCH_LAYER. Ensure: no breaking API changes, maintain layer boundaries$PATTERN_HINTS"
    fi
fi

log_permission_feedback "allow" "Architectural change: $FILE_PATH ($ARCH_LAYER)"

# CC 2.1.9: Inject context if we detected an architectural layer
if [[ -n "$ARCH_CONTEXT" ]]; then
    output_with_context "$ARCH_CONTEXT"
else
    output_silent_success
fi
exit 0