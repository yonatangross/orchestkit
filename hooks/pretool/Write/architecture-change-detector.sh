#!/usr/bin/env bash
# Architecture Change Detector - LLM-powered validation hook
# Detects breaking architectural changes before write
# CC 2.1.4+ Compliant: includes continue field in all outputs

set -euo pipefail

# Get the file path from environment
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"

if [[ -z "$FILE_PATH" ]]; then
    # No file path, allow write
    echo '{"continue": true, "suppressOutput": true}'
    exit 0
fi

# Only analyze significant files
case "$FILE_PATH" in
    **/api/**|**/services/**|**/db/**|**/models/**|**/workflows/**)
        # Architectural files - analyze
        ;;
    *)
        # Non-architectural files - skip
        echo '{"continue": true, "suppressOutput": true}'
        exit 0
        ;;
esac

# Check if file exists (new file vs modification)
if [[ ! -f "$FILE_PATH" ]]; then
    # New file - allow without analysis
    echo '{"continue": true, "suppressOutput": true}'
    exit 0
fi

# Load known patterns if available
PATTERNS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/context/patterns"

if [[ -d "$PATTERNS_DIR" ]]; then
    # Patterns exist - could enhance analysis
    HAS_PATTERNS=true
else
    HAS_PATTERNS=false
fi

# Get file extension for context
EXT="${FILE_PATH##*.}"

# For now, just log the detection
# Full LLM analysis would require API integration
LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs"
mkdir -p "$LOG_DIR"

echo "[$(date -Iseconds)] ARCH_DETECT: $FILE_PATH (patterns=$HAS_PATTERNS)" >> "$LOG_DIR/architecture-detector.log"

# Allow write - detection is informational only
echo '{"continue": true, "suppressOutput": true}'
exit 0