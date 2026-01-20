#!/usr/bin/env bash
# test-skill-discovery.sh - Validate semantic discovery signals in SKILL.md
# Ensures descriptions provide trigger phrases for automatic skill matching.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

FAILED=0
CHECKED=0
WARNINGS=0

echo "=========================================="
echo "Testing Semantic Skill Discovery"
echo "=========================================="
echo

while IFS= read -r skill_file; do
    ((CHECKED++)) || true

    # Extract name and description from frontmatter
    name=$(awk '
        /^---$/ { in_frontmatter = !in_frontmatter; next }
        in_frontmatter && /^name:/ {
            sub(/^name: */, "")
            gsub(/^["'"'"']|["'"'"']$/, "")
            print
            exit
        }
    ' "$skill_file")

    description=$(awk '
        /^---$/ { in_frontmatter = !in_frontmatter; next }
        in_frontmatter && /^description:/ {
            sub(/^description: */, "")
            gsub(/^["'"'"']|["'"'"']$/, "")
            print
            exit
        }
    ' "$skill_file")

    rel_path="${skill_file#$PROJECT_ROOT/}"

    if [[ -z "$name" || -z "$description" ]]; then
        echo "FAIL: Missing name/description in $rel_path"
        ((FAILED++)) || true
        continue
    fi

    desc_lower=$(echo "$description" | tr '[:upper:]' '[:lower:]')
    name_lower=$(echo "$name" | tr '[:upper:]' '[:lower:]')

    # Heuristic: description should include trigger phrasing
    has_trigger=0
    if [[ "$desc_lower" =~ "use when" ]] || \
       [[ "$desc_lower" =~ "use for" ]] || \
       [[ "$desc_lower" =~ "triggers on" ]] || \
       [[ "$desc_lower" =~ "activates for" ]] || \
       [[ "$desc_lower" =~ "use this" ]]; then
        has_trigger=1
    fi

    if [[ $has_trigger -eq 0 ]]; then
        echo "WARN: $name - Missing trigger phrasing"
        echo "      File: $rel_path"
        ((WARNINGS++)) || true
    fi

    # Heuristic: description should mention skill name or a keyword fragment
    if ! [[ "$desc_lower" =~ "$name_lower" ]]; then
        # Allow partial match by splitting name on '-'
        found_fragment=0
        IFS='-' read -r -a parts <<< "$name_lower"
        for part in "${parts[@]}"; do
            if [[ ${#part} -ge 4 ]] && [[ "$desc_lower" =~ "$part" ]]; then
                found_fragment=1
                break
            fi
        done
        if [[ $found_fragment -eq 0 ]]; then
            echo "WARN: $name - Description does not mention skill name or fragments"
            echo "      File: $rel_path"
            ((WARNINGS++)) || true
        fi
    fi
done < <(find "$PROJECT_ROOT/skills" -name "SKILL.md" -type f 2>/dev/null)

echo
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Checked:  $CHECKED skills"
echo "Failed:   $FAILED"
echo "Warnings: $WARNINGS"

if [[ $FAILED -gt 0 ]]; then
    echo
    echo "ACTION REQUIRED: Fix missing name/description fields."
    exit 1
fi

echo
echo "Semantic discovery checks complete."
exit 0
