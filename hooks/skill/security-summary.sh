#!/bin/bash
# Runs on Stop for security-scanning skill
# Generates a summary of security scan completion - silent operation
set -euo pipefail

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs/security-summary.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Log to file instead of stdout (silent operation)
{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Security Scan Complete"
  echo "Review findings for:"
  echo "  - Critical/High vulnerabilities (fix immediately)"
  echo "  - Dependency CVEs (update packages)"
  echo "  - Hardcoded secrets (move to env vars)"
  echo "  - OWASP Top 10 violations"
  echo ""
  echo "Next steps:"
  echo "  1. Triage findings by severity"
  echo "  2. Create issues for critical/high"
  echo "  3. Update dependencies with CVEs"
} >> "$LOG_FILE" 2>/dev/null || true

# Silent success - no visible output
echo '{"continue":true,"suppressOutput":true}'
exit 0
