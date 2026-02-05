#!/bin/bash
# Template: Multi-Page Documentation Crawl
# Crawls all pages from a documentation site using agent-browser

set -euo pipefail

START_URL="${1:?Usage: $0 <start-url> [output-dir]}"
OUTPUT_DIR="${2:-./crawled}"

mkdir -p "$OUTPUT_DIR"

echo "Starting crawl from: $START_URL"

# Navigate to starting page
agent-browser open "$START_URL"
agent-browser wait --load networkidle

# Extract all navigation links
echo "Discovering pages..."
LINKS=$(agent-browser eval "
JSON.stringify(
    Array.from(document.querySelectorAll('nav a, .sidebar a, .toc a'))
        .map(a => ({
            href: a.href,
            title: a.innerText.trim()
        }))
        .filter(l => l.href && l.href.startsWith(window.location.origin))
        .filter(l => !l.href.includes('#'))
)
")

PAGE_COUNT=$(echo "$LINKS" | jq 'length')
echo "Found $PAGE_COUNT pages to crawl"

# Process each page
CURRENT=1
echo "$LINKS" | jq -c '.[]' | while read -r page; do
    URL=$(echo "$page" | jq -r '.href')
    TITLE=$(echo "$page" | jq -r '.title')

    # Create safe filename
    FILENAME=$(echo "$TITLE" | tr ' /' '-' | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]-')

    echo "[$CURRENT/$PAGE_COUNT] Crawling: $TITLE"

    # Navigate to page
    agent-browser open "$URL"
    agent-browser wait --load networkidle

    # Save content with metadata
    {
        echo "---"
        echo "title: $TITLE"
        echo "url: $URL"
        echo "crawled_at: $(date -Iseconds)"
        echo "---"
        echo ""
        agent-browser get text body
    } > "$OUTPUT_DIR/$FILENAME.md"

    # Rate limiting
    sleep 1

    ((CURRENT++)) || true
done

# Close browser
agent-browser close

echo ""
echo "Crawl complete!"
echo "Output directory: $OUTPUT_DIR"
echo "Pages crawled: $(ls "$OUTPUT_DIR"/*.md 2>/dev/null | wc -l)"
