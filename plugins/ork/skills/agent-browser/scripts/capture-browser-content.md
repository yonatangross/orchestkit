---
name: capture-browser-content
description: Capture content from a URL using agent-browser with validation. Use when capturing web content.
user-invocable: true
argument-hint: [url]
allowed-tools: Bash, Read, Write
---

Capture browser content from: $ARGUMENTS

## Capture Context (Auto-Validated)

- **Agent-Browser Available**: !`which agent-browser >/dev/null 2>&1 && echo "✅ Yes" || echo "❌ Not found - install: npm install -g @agent-browser/cli"`
- **Curl Available**: !`which curl >/dev/null 2>&1 && echo "✅ Yes" || echo "❌ Not found"`
- **Output Directory**: !`pwd`/captured
- **Timestamp**: !`date +%Y%m%d-%H%M%S`

## Your Task

Capture content from URL: **$ARGUMENTS**

First validate the URL is accessible, then proceed with capture.

## Capture Workflow

### 1. Validate URL

```bash
# Check if URL is accessible
curl -I "$ARGUMENTS" || echo "URL validation failed"
```

### 2. Capture Content

```bash
# Create output directory
mkdir -p captured

# Navigate and capture
agent-browser open "$ARGUMENTS"
agent-browser wait --load networkidle

# Get page info
TITLE=$(agent-browser get title)
agent-browser snapshot -i > "captured/snapshot-$(date +%Y%m%d-%H%M%S).txt"
agent-browser get text body > "captured/text-$(date +%Y%m%d-%H%M%S).txt"
agent-browser screenshot "captured/screenshot-$(date +%Y%m%d-%H%M%S).png"

agent-browser close
```

### 3. Full Capture Script

```bash
#!/bin/bash
URL="$ARGUMENTS"
OUTPUT_DIR="./captured"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$OUTPUT_DIR"

agent-browser open "$URL"
agent-browser wait --load networkidle
agent-browser snapshot -i > "$OUTPUT_DIR/snapshot-$TIMESTAMP.txt"
agent-browser get text body > "$OUTPUT_DIR/text-$TIMESTAMP.txt"
agent-browser screenshot "$OUTPUT_DIR/screenshot-$TIMESTAMP.png"
agent-browser close

echo "✅ Content captured to $OUTPUT_DIR"
```

## Output Files

- `snapshot-*.txt` - Page structure snapshot
- `text-*.txt` - Extracted text content
- `screenshot-*.png` - Visual capture
