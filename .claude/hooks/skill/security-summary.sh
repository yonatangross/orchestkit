#!/bin/bash
# Runs on Stop for security-scanning skill
# Generates a summary of security scan completion

echo "========================================"
echo "  SECURITY SCAN COMPLETE"
echo "========================================"
echo ""
echo "Review findings above for:"
echo "  - Critical/High vulnerabilities (fix immediately)"
echo "  - Dependency CVEs (update packages)"
echo "  - Hardcoded secrets (move to env vars)"
echo "  - OWASP Top 10 violations"
echo ""
echo "Next steps:"
echo "  1. Triage findings by severity"
echo "  2. Create issues for critical/high"
echo "  3. Update dependencies with CVEs"
echo "========================================"

# Output systemMessage for user visibility
echo '{"systemMessage":"Security summary generated","continue":true}'
exit 0
