#!/bin/bash
# Runs on Stop for code-review-playbook skill
# Generates review summary - silent operation, logs to file
set -euo pipefail

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs/review-summary.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Log to file instead of stdout (silent operation)
{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Code Review Summary"
  echo "Review checklist:"
  echo "  [ ] All blocking issues addressed"
  echo "  [ ] Non-blocking suggestions noted"
  echo "  [ ] Tests pass"
  echo "  [ ] No security concerns"
  echo "  [ ] Documentation updated if needed"
  echo ""
  echo "Conventional comment prefixes used:"
  echo "  - blocking: Must fix before merge"
  echo "  - suggestion: Consider this improvement"
  echo "  - nitpick: Minor style issue"
  echo "  - question: Needs clarification"
  echo "  - praise: Good work!"
} >> "$LOG_FILE" 2>/dev/null || true

# Silent success - no visible output
echo '{"continue":true,"suppressOutput":true}'
exit 0
