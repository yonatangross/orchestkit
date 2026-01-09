#!/bin/bash
set -euo pipefail
# Subagent Context Stager - Stages relevant context files for subagent
# Hook: SubagentStart
# CC 2.1.2 Compliant: includes continue field in all outputs
#
# This hook:
# 1. Checks if there are active todos from session state
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

# === CHECK FOR ACTIVE TODOS (Context Protocol 2.0) ===

SESSION_STATE="$CLAUDE_PROJECT_DIR/.claude/context/session/state.json"
DECISIONS_FILE="$CLAUDE_PROJECT_DIR/.claude/context/knowledge/decisions/active.json"
STAGED_CONTEXT=""

if [[ -f "$SESSION_STATE" ]]; then
  # Extract pending tasks from session state
  PENDING_TASKS=$(jq -r '.tasks_pending // [] | length' "$SESSION_STATE" 2>/dev/null || echo "0")

  if [[ "$PENDING_TASKS" -gt 0 ]]; then
    log_hook "Found $PENDING_TASKS pending tasks"

    # Extract task summaries
    TASK_SUMMARY=$(jq -r '.tasks_pending[:3][] | "- \(.)"' "$SESSION_STATE" 2>/dev/null || echo "")

    if [[ -n "$TASK_SUMMARY" ]]; then
      STAGED_CONTEXT="ACTIVE TODOS:\n$TASK_SUMMARY\n\n"
      log_hook "Staged active tasks"
    fi
  fi
else
  log_hook "No session state file found"
fi

# === STAGE RELEVANT ARCHITECTURE DECISIONS ===

if [[ -f "$DECISIONS_FILE" ]]; then
  # Check for task-specific keywords and stage relevant decisions
  if [[ "$TASK_DESCRIPTION" =~ (backend|api|endpoint|database|migration) ]]; then
    log_hook "Backend task detected - staging backend decisions"

    BACKEND_DECISIONS=$(jq -r '.decisions[]? | select(.category == "backend" or .category == "api" or .category == "database") | "- \(.title) (\(.status))"' "$DECISIONS_FILE" 2>/dev/null | head -5 || echo "")

    if [[ -n "$BACKEND_DECISIONS" ]]; then
      STAGED_CONTEXT="${STAGED_CONTEXT}RELEVANT DECISIONS:\n$BACKEND_DECISIONS\n\n"
    fi
  fi

  if [[ "$TASK_DESCRIPTION" =~ (frontend|react|ui|component) ]]; then
    log_hook "Frontend task detected - staging frontend decisions"

    FRONTEND_DECISIONS=$(jq -r '.decisions[]? | select(.category == "frontend" or .category == "ui") | "- \(.title) (\(.status))"' "$DECISIONS_FILE" 2>/dev/null | head -5 || echo "")

    if [[ -n "$FRONTEND_DECISIONS" ]]; then
      STAGED_CONTEXT="${STAGED_CONTEXT}RELEVANT DECISIONS:\n$FRONTEND_DECISIONS\n\n"
    fi
  fi
fi

# === STAGE TESTING REMINDERS ===

if [[ "$TASK_DESCRIPTION" =~ (test|testing|pytest|jest) ]]; then
  log_hook "Testing task detected - staging test context"
  STAGED_CONTEXT="${STAGED_CONTEXT}TESTING REMINDERS:\n- Use 'tee' for visible test output\n- Check test patterns in backend/tests/ or frontend/src/**/__tests__/\n- Ensure coverage meets threshold requirements\n\n"
fi

# === STAGE ISSUE DOCUMENTATION ===

if [[ "$TASK_DESCRIPTION" =~ (issue|#[0-9]+|bug|fix) ]]; then
  log_hook "Issue-related task detected"

  ISSUE_NUM=$(echo "$TASK_DESCRIPTION" | grep -oE '#[0-9]+' | head -1 | tr -d '#' || echo "")

  if [[ -n "$ISSUE_NUM" ]]; then
    ISSUE_DIR="$CLAUDE_PROJECT_DIR/docs/issues"
    if [[ -d "$ISSUE_DIR" ]]; then
      ISSUE_MATCH=$(find "$ISSUE_DIR" -maxdepth 1 -type d -name "*${ISSUE_NUM}*" 2>/dev/null | head -1 || echo "")

      if [[ -n "$ISSUE_MATCH" ]]; then
        STAGED_CONTEXT="${STAGED_CONTEXT}ISSUE DOCS: ${ISSUE_MATCH#$CLAUDE_PROJECT_DIR/}\n\n"
        log_hook "Staged issue documentation for #$ISSUE_NUM"
      fi
    fi
  fi
fi

# === RETURN SYSTEM MESSAGE (CC 2.1.2 Compliant) ===

if [[ -n "$STAGED_CONTEXT" ]]; then
  SYSTEM_MESSAGE="$STAGED_CONTEXT\nTask: $TASK_DESCRIPTION\nSubagent: $SUBAGENT_TYPE"

  jq -n \
    --arg msg "$SYSTEM_MESSAGE" \
    '{systemMessage: $msg, continue: true}' 2>/dev/null || {
    # Fallback if jq fails
    echo '{"systemMessage":"Context staged","continue":true}'
  }

  log_hook "Staged context with $(echo -e "$STAGED_CONTEXT" | wc -l) lines"
else
  log_hook "No context staged for this task"
  echo '{"continue":true}'
fi

exit 0