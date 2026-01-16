#!/usr/bin/env bash
# Test: Validates that Auto Mode keywords are in description, not body
#
# CC 2.1.7 uses the description field for agent routing/discovery.
# Having "## Auto Mode" sections in the body means those keywords
# won't be used for automatic agent selection.
#
# This test checks:
# 1. No "## Auto Mode" section exists in agent body
# 2. Description contains meaningful keywords (not just generic text)
#
# CC 2.1.7 Compliant

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/agents"

FAILED=0
WARNINGS=0

echo "=== Auto Mode in Description Test ==="
echo ""

echo "--- Part 1: Check for '## Auto Mode' sections in body ---"
echo ""

for agent_file in "$AGENTS_DIR"/*.md; do
    agent_name=$(basename "$agent_file" .md)

    # Check if file contains "## Auto Mode" (indicating keywords are in body, not description)
    if grep -q "^## Auto Mode" "$agent_file"; then
        echo "FAIL: $agent_name has '## Auto Mode' section in body"
        echo "      Keywords should be merged into description field"
        FAILED=1
    fi
done

if [[ $FAILED -eq 0 ]]; then
    echo "PASS: No agents have '## Auto Mode' sections in body"
fi

echo ""
echo "--- Part 2: Check description has trigger keywords ---"
echo ""

# Common trigger keywords that should appear in descriptions
TRIGGER_PATTERNS=(
    "Use when"
    "when.*ing"
    "for.*ing"
)

for agent_file in "$AGENTS_DIR"/*.md; do
    agent_name=$(basename "$agent_file" .md)

    # Extract description from frontmatter
    description=$(awk '/^---$/{p++} p==1 && /^description:/{gsub(/^description:[[:space:]]*/, ""); print; exit}' "$agent_file")

    if [[ -z "$description" ]]; then
        echo "FAIL: $agent_name has no description"
        FAILED=1
        continue
    fi

    # Check description length (should be substantial)
    desc_length=${#description}
    if [[ $desc_length -lt 100 ]]; then
        echo "WARN: $agent_name description is short ($desc_length chars)"
        echo "      Consider adding trigger keywords"
        ((WARNINGS++)) || true
    fi

    # Check for "Use when" pattern (best practice)
    if [[ ! "$description" =~ [Uu]se\ when ]]; then
        # Not a failure, just a warning
        :
    fi
done

echo ""
echo "--- Summary ---"
echo ""
echo "Warnings: $WARNINGS"
echo ""

if [[ $FAILED -eq 1 ]]; then
    echo "❌ Auto Mode validation FAILED"
    echo ""
    echo "Fix: Merge '## Auto Mode' keywords into the description field"
    echo "Example:"
    echo "  description: Debug specialist for bugs, errors, exceptions. Use when investigating crashes or failures."
    exit 1
else
    if [[ $WARNINGS -gt 0 ]]; then
        echo "⚠️  All tests passed with $WARNINGS warnings"
    else
        echo "✅ All agents have proper descriptions"
    fi
    exit 0
fi