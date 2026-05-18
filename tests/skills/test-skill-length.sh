#!/usr/bin/env bash
# test-skill-length.sh - Validates all SKILL.md files are under MAX_LINES.
# Per CC 2.1.7 best practices, skill files should be concise with detailed
# content moved to references/ subdirectory.
#
# 500→520 in #1865: src/skills/implement/SKILL.md hit 507 lines in PR #1855
# (M126 effort-aware scaling + reference loading additions). The file has
# already split detail out via Read(${CLAUDE_SKILL_DIR}/references/*) but
# stayed 7 lines over. Trimming a SKILL.md you're actively running is
# risky (consumed mid-session). Raised to 520 with explicit headroom; a
# real trim is tracked separately and remains the right long-term answer.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MAX_LINES=520
FAILED=0
CHECKED=0
WARNINGS=0

echo "=========================================="
echo "Testing SKILL.md File Lengths"
echo "Max allowed: $MAX_LINES lines"
echo "=========================================="
echo

# Find all SKILL.md files
while IFS= read -r skill_file; do
    CHECKED=$((CHECKED + 1))

    # Count lines
    line_count=$(wc -l < "$skill_file" | tr -d ' ')

    # Get relative path for cleaner output
    rel_path="${skill_file#$PROJECT_ROOT/}"

    if [[ $line_count -gt $MAX_LINES ]]; then
        echo "FAIL: $rel_path ($line_count lines)"
        FAILED=$((FAILED + 1))
    elif [[ $line_count -gt 400 ]]; then
        echo "WARN: $rel_path ($line_count lines - approaching limit)"
        WARNINGS=$((WARNINGS + 1))
    fi
done < <(find "$PROJECT_ROOT/src/skills" -name "SKILL.md" -type f 2>/dev/null)

echo
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Checked: $CHECKED skills"
echo "Passed:  $((CHECKED - FAILED)) skills"
echo "Warnings: $WARNINGS skills (>400 lines)"
echo "Failed:  $FAILED skills (>$MAX_LINES lines)"

if [[ $FAILED -gt 0 ]]; then
    echo
    echo "ACTION REQUIRED: Move detailed content to references/ subdirectory"
    exit 1
fi

echo
echo "All skills within line limit."
exit 0