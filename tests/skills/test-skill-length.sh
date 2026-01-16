#!/usr/bin/env bash
# test-skill-length.sh - Validates all SKILL.md files are under 500 lines
# Per CC 2.1.7 best practices, skill files should be concise with detailed
# content moved to references/ subdirectory

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MAX_LINES=500
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
    ((CHECKED++)) || true

    # Count lines
    line_count=$(wc -l < "$skill_file" | tr -d ' ')

    # Get relative path for cleaner output
    rel_path="${skill_file#$PROJECT_ROOT/}"

    if [[ $line_count -gt $MAX_LINES ]]; then
        echo "FAIL: $rel_path ($line_count lines)"
        ((FAILED++)) || true
    elif [[ $line_count -gt 400 ]]; then
        echo "WARN: $rel_path ($line_count lines - approaching limit)"
        ((WARNINGS++)) || true
    fi
done < <(find "$PROJECT_ROOT/skills" -name "SKILL.md" -type f 2>/dev/null)

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