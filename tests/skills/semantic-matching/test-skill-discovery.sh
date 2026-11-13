#!/usr/bin/env bash
# test-skill-discovery.sh - Validate semantic discovery signals in SKILL.md
# Ensures descriptions provide trigger phrases for automatic skill matching.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
# ORK_SKILLS_DIR lets tests/skills/test-description-standard-controls.sh point this
# check at a planted skills tree and prove it still warns on a bad description.
SKILLS_DIR="${ORK_SKILLS_DIR:-$PROJECT_ROOT/src/skills}"
# The description standard is shared with the other description checks (#5043).
# shellcheck source=../../fixtures/description-standard.sh
source "$SCRIPT_DIR/../../fixtures/description-standard.sh"

FAILED=0
CHECKED=0
WARNINGS=0

echo "=========================================="
echo "Testing Semantic Skill Discovery"
echo "=========================================="
echo

while IFS= read -r skill_file; do
    CHECKED=$((CHECKED + 1))

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
        FAILED=$((FAILED + 1))
        continue
    fi

    # The model sees "name: description" in the listing, and #5043 descriptions lead
    # with what the skill does, not its name. So a description is judged on its
    # trigger phrase ("Use when|for|before|after|to|only when ...", see
    # tests/fixtures/description-standard.sh), and the name or a name fragment only
    # matters when there is no trigger phrase at all.
    if ! description_has_trigger_phrase "$description"; then
        echo "WARN: $name - Missing trigger phrasing"
        echo "      File: $rel_path"
        WARNINGS=$((WARNINGS + 1))

        if ! description_mentions_name "$description" "$name"; then
            echo "WARN: $name - Description does not mention skill name or fragments"
            echo "      File: $rel_path"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
done < <(find "$SKILLS_DIR" -name "SKILL.md" -type f)

echo
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Checked:  $CHECKED skills"
echo "Failed:   $FAILED"
echo "Warnings: $WARNINGS"

# A run that looked at nothing must not read as a clean pass.
if [[ $CHECKED -eq 0 ]]; then
    echo
    echo "FAIL: no SKILL.md found under $SKILLS_DIR, nothing was checked."
    exit 1
fi

if [[ $FAILED -gt 0 ]]; then
    echo
    echo "ACTION REQUIRED: Fix missing name/description fields."
    exit 1
fi

echo
echo "Semantic discovery checks complete."
exit 0
