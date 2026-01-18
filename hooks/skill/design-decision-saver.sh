#!/bin/bash
# Runs on Stop for brainstorming skill
# Reminds to save design decisions to context - silent operation
# CC 2.1.6 Compliant - Context Protocol 2.0
set -euo pipefail

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs/design-decision.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Log to file instead of stdout (silent operation)
{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Brainstorming Complete"
  echo "Recommended next steps:"
  echo "  1. Save key decisions to knowledge/decisions/active.json"
  echo "  2. Create ADR if architectural decision was made"
  echo "  3. Break down into implementation tasks"
  echo ""
  echo "Consider using these skills next:"
  echo "  - /architecture-decision-record (document decisions)"
  echo "  - /api-design-framework (if API was designed)"
  echo "  - /database-schema-designer (if schema was designed)"
} >> "$LOG_FILE" 2>/dev/null || true

# Silent success - no visible output
echo '{"continue":true,"suppressOutput":true}'
exit 0
