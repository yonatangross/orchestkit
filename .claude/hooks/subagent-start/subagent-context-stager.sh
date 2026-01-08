#!/bin/bash
set -euo pipefail
# Subagent Context Stager - Stages relevant context files for subagent
# Hook: SubagentStart
#
# This hook:
# 1. Checks if there are active todos and includes them
# 2. Stages relevant context files based on the task description
# 3. Returns systemMessage with staged context

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

SUBAGENT_TYPE=$(get_field '.subagent_type')
TASK_DESCRIPTION=$(get_field '.task_description')
SESSION_ID=$(get_session_id)

log_hook "Staging context for $SUBAGENT_TYPE"

# === CHECK FOR ACTIVE TODOS ===

CONTEXT_FILE="$CLAUDE_PROJECT_DIR/.claude/context/shared-context.json"
STAGED_CONTEXT=""

if [[ -f "$CONTEXT_FILE" ]]; then
  # Extract pending tasks from shared context
  PENDING_TASKS=$(jq -r '.tasks_pending // [] | length' "$CONTEXT_FILE" 2>/dev/null || echo "0")

  if [[ "$PENDING_TASKS" -gt 0 ]]; then
    log_hook "Found $PENDING_TASKS pending tasks"

    # Extract high-priority tasks
    HIGH_PRIORITY=$(jq -r '.tasks_pending[] | select(.priority == "high" or .priority == "critical") | "- [\(.priority | ascii_upcase)] \(.task)"' "$CONTEXT_FILE" 2>/dev/null || echo "")

    if [[ -n "$HIGH_PRIORITY" ]]; then
      STAGED_CONTEXT="ACTIVE TODOS (High Priority):\n$HIGH_PRIORITY\n\n"
      log_hook "Staged high-priority tasks"
    fi
  fi
else
  log_hook "No shared context file found"
fi

# === STAGE RELEVANT CONTEXT FILES BASED ON TASK DESCRIPTION ===

# Check for task-specific keywords and stage relevant documentation
if [[ "$TASK_DESCRIPTION" =~ (backend|api|endpoint|database|migration) ]]; then
  log_hook "Backend task detected - staging backend context"

  # Check for architecture decisions related to backend
  if [[ -f "$CONTEXT_FILE" ]]; then
    BACKEND_DECISIONS=$(jq -r '.architectural_decisions[] | select(.decision | test("backend|api|database"; "i")) | "- \(.decision) (\(.status), \(.date))"' "$CONTEXT_FILE" 2>/dev/null || echo "")

    if [[ -n "$BACKEND_DECISIONS" ]]; then
      STAGED_CONTEXT="${STAGED_CONTEXT}RELEVANT ARCHITECTURE DECISIONS:\n$BACKEND_DECISIONS\n\n"
      log_hook "Staged backend architecture decisions"
    fi
  fi
fi

if [[ "$TASK_DESCRIPTION" =~ (frontend|react|ui|component) ]]; then
  log_hook "Frontend task detected - staging frontend context"

  # Check for frontend-related decisions
  if [[ -f "$CONTEXT_FILE" ]]; then
    FRONTEND_DECISIONS=$(jq -r '.architectural_decisions[] | select(.decision | test("frontend|react|ui|component"; "i")) | "- \(.decision) (\(.status), \(.date))"' "$CONTEXT_FILE" 2>/dev/null || echo "")

    if [[ -n "$FRONTEND_DECISIONS" ]]; then
      STAGED_CONTEXT="${STAGED_CONTEXT}RELEVANT ARCHITECTURE DECISIONS:\n$FRONTEND_DECISIONS\n\n"
      log_hook "Staged frontend architecture decisions"
    fi
  fi
fi

if [[ "$TASK_DESCRIPTION" =~ (test|testing|pytest|jest) ]]; then
  log_hook "Testing task detected - staging test context"

  # Add testing best practices reminder
  STAGED_CONTEXT="${STAGED_CONTEXT}TESTING REMINDERS:\n- Use 'tee' for visible test output\n- Check test patterns in backend/tests/ or frontend/src/**/__tests__/\n- Ensure coverage meets threshold requirements\n\n"
  log_hook "Staged testing reminders"
fi

if [[ "$TASK_DESCRIPTION" =~ (issue|#[0-9]+|bug|fix) ]]; then
  log_hook "Issue-related task detected - checking for issue docs"

  # Extract issue number if present
  ISSUE_NUM=$(echo "$TASK_DESCRIPTION" | grep -oE '#[0-9]+' | head -1 | tr -d '#' || echo "")

  if [[ -n "$ISSUE_NUM" ]]; then
    ISSUE_DIR="$CLAUDE_PROJECT_DIR/docs/issues"
    if [[ -d "$ISSUE_DIR" ]]; then
      # Find matching issue directory
      ISSUE_MATCH=$(find "$ISSUE_DIR" -maxdepth 1 -type d -name "*${ISSUE_NUM}*" | head -1 || echo "")

      if [[ -n "$ISSUE_MATCH" ]]; then
        STAGED_CONTEXT="${STAGED_CONTEXT}ISSUE DOCUMENTATION:\n- Found issue docs at: ${ISSUE_MATCH#$CLAUDE_PROJECT_DIR/}\n- Review implementation plans and architecture diagrams\n\n"
        log_hook "Staged issue documentation for #$ISSUE_NUM"
      fi
    fi
  fi
fi

# === STAGE QUALITY EVIDENCE ===

if [[ -f "$CONTEXT_FILE" ]]; then
  # Check for recent quality evidence
  LAST_TEST_STATUS=$(jq -r '.quality_evidence.backend_tests.result // "UNKNOWN"' "$CONTEXT_FILE" 2>/dev/null || echo "UNKNOWN")

  if [[ "$LAST_TEST_STATUS" != "UNKNOWN" ]]; then
    STAGED_CONTEXT="${STAGED_CONTEXT}LAST QUALITY CHECK:\n- Backend tests: $LAST_TEST_STATUS\n"
    log_hook "Staged quality evidence: $LAST_TEST_STATUS"
  fi
fi

# === RETURN SYSTEM MESSAGE WITH STAGED CONTEXT ===

if [[ -n "$STAGED_CONTEXT" ]]; then
  SYSTEM_MESSAGE="$STAGED_CONTEXT\nTask: $TASK_DESCRIPTION\nSubagent: $SUBAGENT_TYPE"

  jq -n \
    --arg msg "$SYSTEM_MESSAGE" \
    '{systemMessage: $msg}' 2>/dev/null || {
    # Fallback if jq fails
    echo "{\"systemMessage\":\"$SYSTEM_MESSAGE\"}"
  }

  log_hook "Staged context with $(echo "$STAGED_CONTEXT" | wc -l) lines"
else
  log_hook "No context staged for this task"
  echo "{}"
fi

exit 0
