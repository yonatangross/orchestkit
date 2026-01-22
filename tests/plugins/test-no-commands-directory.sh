#!/usr/bin/env bash
# ============================================================================
# No Commands Directory Test
# ============================================================================
# Verifies that the deprecated commands/ directory does not exist.
#
# As of CC 2.1.16, commands are replaced by skills with `user-invocable: true`
# in their SKILL.md frontmatter. The commands/ directory is no longer used.
#
# Reference: https://code.claude.com/docs/en/plugins-reference
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

echo "Testing: commands/ directory should not exist"
echo ""

if [[ -d "$PROJECT_ROOT/commands" ]]; then
    echo "FAIL: commands/ directory exists"
    echo ""
    echo "The commands/ directory is deprecated in CC 2.1.16."
    echo "Use skills with 'user-invocable: true' in SKILL.md frontmatter instead."
    echo ""
    echo "To fix:"
    echo "  1. Ensure all commands have corresponding skills with user-invocable: true"
    echo "  2. Delete the commands/ directory: rm -rf commands/"
    exit 1
fi

echo "PASS: commands/ directory correctly absent"
echo ""

# Verify user-invocable skills exist as replacement
user_invocable_count=$(grep -l "user-invocable: true" "$PROJECT_ROOT/skills"/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
echo "Found $user_invocable_count user-invocable skills (replacements for commands)"

if [[ $user_invocable_count -eq 0 ]]; then
    echo "WARN: No user-invocable skills found"
    exit 1
fi

echo ""
echo "PASS: User-invocable skills available as /ork:<skill-name>"
exit 0
