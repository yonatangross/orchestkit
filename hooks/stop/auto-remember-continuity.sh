#!/bin/bash
set -euo pipefail
# Auto-Remember Continuity - Stop Hook
# CC 2.1.7 Compliant: Prompts Claude to store session context before end
#
# Purpose:
# - Before session ends, suggest storing important decisions/context
# - Enables cross-session continuity via mem0
# - Only triggers if significant work was done (not for quick Q&A)
#
# Version: 1.0.0
# Part of mem0 Semantic Memory Integration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities if available
if [[ -f "$SCRIPT_DIR/../_lib/common.sh" ]]; then
    source "$SCRIPT_DIR/../_lib/common.sh"
fi

# Source mem0 library if available
MEM0_AVAILABLE=false
if [[ -f "$SCRIPT_DIR/../_lib/mem0.sh" ]]; then
    source "$SCRIPT_DIR/../_lib/mem0.sh"
    if is_mem0_available 2>/dev/null; then
        MEM0_AVAILABLE=true
    fi
fi

# Log function (fallback if common.sh not available)
log_hook() {
    local msg="$1"
    local log_file="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/stop-hooks.log"
    mkdir -p "$(dirname "$log_file")" 2>/dev/null || true
    echo "[$(date -Iseconds)] [auto-remember] $msg" >> "$log_file" 2>/dev/null || true
}

log_hook "Auto-remember continuity hook triggered"

# Skip if mem0 not available
if [[ "$MEM0_AVAILABLE" != "true" ]]; then
    log_hook "Mem0 not available, skipping"
    echo '{"continue":true}'
    exit 0
fi

# Get project info for the prompt
PROJECT_ID=""
if type mem0_get_project_id &>/dev/null; then
    PROJECT_ID=$(mem0_get_project_id)
fi

USER_ID_CONTINUITY=""
if type mem0_user_id &>/dev/null; then
    USER_ID_CONTINUITY=$(mem0_user_id "continuity")
fi

USER_ID_DECISIONS=""
if type mem0_user_id &>/dev/null; then
    USER_ID_DECISIONS=$(mem0_user_id "decisions")
fi

# Build the prompt for Claude to consider storing context
PROMPT_MSG="Before ending this session, consider preserving important context:

1. **Session Continuity** - If there's unfinished work or next steps:
   \`mcp__mem0__add_memory\` with:
   - text: \"Session summary: [what was done]. Next steps: [what remains]\"
   - user_id: \"${USER_ID_CONTINUITY}\"
   - metadata: {\"scope\": \"continuity\", \"project\": \"${PROJECT_ID}\"}

2. **Important Decisions** - If architectural/design decisions were made:
   \`mcp__mem0__add_memory\` with:
   - text: \"Decision: [what was decided]. Rationale: [why]\"
   - user_id: \"${USER_ID_DECISIONS}\"
   - metadata: {\"scope\": \"decisions\", \"category\": \"[category]\"}

3. **Patterns Learned** - If something worked well or failed:
   - Use \`/remember --success \"pattern that worked\"\`
   - Use \`/remember --failed \"pattern that caused issues\"\`

Skip if this was just a quick question/answer session."

log_hook "Outputting memory prompt for session end"

# Output CC 2.1.7 compliant JSON with stop prompt
jq -n \
    --arg prompt "$PROMPT_MSG" \
    '{
        continue: true,
        stopPrompt: $prompt
    }'

exit 0