#!/usr/bin/env bash
# similar-issue-finder.sh - Search for similar issues in GitHub and memory
#
# Usage: ./similar-issue-finder.sh "error message" [file.py]
#
# Arguments:
#   $1 - Error message or search query (required)
#   $2 - Related file name (optional, improves search)
#
# Output: Similar issues with relevance scores

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 \"error message\" [file.py]"
    echo ""
    echo "Examples:"
    echo "  $0 \"TypeError: Cannot read property\""
    echo "  $0 \"connection timeout\" database.py"
    exit 1
fi

QUERY="$1"
FILE="${2:-}"

echo -e "${BLUE}=== Similar Issue Finder ===${NC}"
echo -e "Query: ${YELLOW}$QUERY${NC}"
[[ -n "$FILE" ]] && echo -e "File: ${YELLOW}$FILE${NC}"
echo ""

# Function to calculate simple relevance score
calculate_score() {
    local title="$1"
    local state="$2"
    local score=0

    # Base score for closed issues (they have solutions)
    [[ "$state" == "closed" ]] && score=$((score + 20))

    # Check for keyword matches
    query_lower=$(echo "$QUERY" | tr '[:upper:]' '[:lower:]')
    title_lower=$(echo "$title" | tr '[:upper:]' '[:lower:]')

    for word in $query_lower; do
        if [[ "$title_lower" == *"$word"* ]]; then
            score=$((score + 15))
        fi
    done

    # Cap at 100
    [[ $score -gt 100 ]] && score=100

    echo $score
}

echo -e "${GREEN}--- GitHub Issues ---${NC}"

# Search GitHub issues
if command -v gh &> /dev/null; then
    # Build search query
    search_query="$QUERY"
    [[ -n "$FILE" ]] && search_query="$search_query $FILE"

    # Search all issues
    issues=$(gh issue list --search "$search_query" --state all --limit 10 --json number,title,state,closedAt 2>/dev/null || echo "[]")

    if [[ "$issues" != "[]" && -n "$issues" ]]; then
        echo "$issues" | jq -r '.[] | "\(.number)|\(.title)|\(.state)|\(.closedAt // "open")"' | while IFS='|' read -r num title state closed; do
            score=$(calculate_score "$title" "$state")
            status_icon="[OPEN]"
            [[ "$state" == "closed" ]] && status_icon="${GREEN}[CLOSED]${NC}"

            echo -e "  #$num (${YELLOW}${score}%${NC}) $status_icon $title"
        done
    else
        echo "  No similar issues found in GitHub"
    fi
else
    echo "  gh CLI not available - skipping GitHub search"
fi

echo ""
echo -e "${GREEN}--- Memory Search ---${NC}"

# Search memory (if MCP is available, this would be called differently)
# For now, check local knowledge files
MEMORY_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/context/knowledge"

if [[ -d "$MEMORY_DIR" ]]; then
    # Search in knowledge files
    matches=$(grep -r -l -i "$QUERY" "$MEMORY_DIR" 2>/dev/null | head -5 || true)

    if [[ -n "$matches" ]]; then
        for match in $matches; do
            filename=$(basename "$match")
            echo -e "  ${YELLOW}[MEMORY]${NC} $filename"
        done
    else
        echo "  No matches in local memory"
    fi
else
    echo "  No local memory directory found"
fi

echo ""
echo -e "${GREEN}--- Recommendations ---${NC}"

# Provide recommendations based on findings
echo "  1. Review closed issues with >70% similarity for past solutions"
echo "  2. Check if this is a regression (same issue, previously fixed)"
echo "  3. Use memory search results to find past debugging insights"
echo ""
echo -e "${BLUE}=== Search Complete ===${NC}"
