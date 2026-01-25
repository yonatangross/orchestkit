#!/usr/bin/env bash
# test-description-triggers.sh - Validates SKILL.md descriptions have trigger keywords
# Per CC 2.1.7, skills are discovered via the description field in frontmatter
# Good descriptions include "Use when..." with trigger scenarios

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FAILED=0
CHECKED=0
MISSING_USE_WHEN=0

echo "=========================================="
echo "Testing SKILL.md Description Quality"
echo "=========================================="
echo

# Find all SKILL.md files
while IFS= read -r skill_file; do
    ((CHECKED++)) || true

    # Extract description from frontmatter
    # Look for description: line between --- markers
    description=$(awk '
        /^---$/ { in_frontmatter = !in_frontmatter; next }
        in_frontmatter && /^description:/ {
            # Get the description value (may be multi-line)
            sub(/^description: */, "")
            # Remove quotes if present
            gsub(/^["'"'"']|["'"'"']$/, "")
            print
            exit
        }
    ' "$skill_file")

    # Get relative path for cleaner output
    rel_path="${skill_file#$PROJECT_ROOT/}"
    skill_name=$(basename "$(dirname "$skill_file")")

    # Check for minimum description length
    if [[ ${#description} -lt 50 ]]; then
        echo "FAIL: $skill_name - Description too short (${#description} chars)"
        echo "      File: $rel_path"
        ((FAILED++)) || true
        continue
    fi

    # Check for "Use when" or similar trigger keywords
    # Convert to lowercase for case-insensitive matching
    desc_lower=$(echo "$description" | tr '[:upper:]' '[:lower:]')

    has_trigger=0
    if [[ "$desc_lower" =~ "use when" ]] || \
       [[ "$desc_lower" =~ "use for" ]] || \
       [[ "$desc_lower" =~ "triggers on" ]] || \
       [[ "$desc_lower" =~ "activates for" ]] || \
       [[ "$desc_lower" =~ "use this" ]]; then
        has_trigger=1
    fi

    if [[ $has_trigger -eq 0 ]]; then
        echo "WARN: $skill_name - Missing trigger keywords ('Use when...')"
        echo "      Description: ${description:0:80}..."
        ((MISSING_USE_WHEN++)) || true
    fi

done < <(find "$PROJECT_ROOT/src/skills" -name "SKILL.md" -type f 2>/dev/null)

echo
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Checked: $CHECKED skills"
echo "Failed:  $FAILED skills (description too short)"
echo "Warnings: $MISSING_USE_WHEN skills (missing 'Use when' triggers)"

if [[ $FAILED -gt 0 ]]; then
    echo
    echo "ACTION REQUIRED: Update descriptions to be at least 50 characters"
    echo "RECOMMENDED: Add 'Use when [trigger scenarios]' to descriptions"
    exit 1
fi

if [[ $MISSING_USE_WHEN -gt 20 ]]; then
    echo
    echo "NOTE: Many skills missing trigger keywords. Consider updating descriptions."
fi

echo
echo "All descriptions meet minimum requirements."
exit 0