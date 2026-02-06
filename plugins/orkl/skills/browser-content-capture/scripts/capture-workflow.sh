#!/bin/bash
# Template: Content Capture Workflow
# Extracts content from JavaScript-rendered pages using agent-browser

set -euo pipefail

URL="${1:?Usage: $0 <url> [output-dir]}"
OUTPUT_DIR="${2:-./captured}"

mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "Capturing content from: $URL"

# Navigate to page
agent-browser open "$URL"

# Wait for dynamic content to load
agent-browser wait --load networkidle

# Get page metadata
TITLE=$(agent-browser get title)
CURRENT_URL=$(agent-browser get url)

echo "Title: $TITLE"
echo "URL: $CURRENT_URL"

# Take snapshot to analyze structure
agent-browser snapshot -i > "$OUTPUT_DIR/snapshot-$TIMESTAMP.txt"

# Extract main content
agent-browser get text body > "$OUTPUT_DIR/text-$TIMESTAMP.txt"

# Take screenshots
agent-browser screenshot "$OUTPUT_DIR/screenshot-$TIMESTAMP.png"
agent-browser screenshot --full "$OUTPUT_DIR/fullpage-$TIMESTAMP.png"

# Save as PDF
agent-browser pdf "$OUTPUT_DIR/page-$TIMESTAMP.pdf"

# Close browser
agent-browser close

echo "Content captured to: $OUTPUT_DIR"
echo "Files:"
ls -la "$OUTPUT_DIR"/*-$TIMESTAMP*
