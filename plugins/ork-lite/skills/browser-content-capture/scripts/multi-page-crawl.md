---
name: multi-page-crawl
description: Crawl multiple pages from a base URL with sitemap detection. Use when capturing multi-page documentation.
user-invocable: true
argument-hint: [base-url]
allowed-tools: Bash, Read, Write, WebFetch
---

Crawl multi-page content from: $ARGUMENTS

## Crawl Context (Auto-Detected)

- **Base URL**: $ARGUMENTS
- **Agent-Browser Available**: !`which agent-browser >/dev/null 2>&1 && echo "✅ Yes" || echo "❌ Not found"`
- **Curl Available**: !`which curl >/dev/null 2>&1 && echo "✅ Yes" || echo "❌ Not found"`
- **Output Directory**: !`pwd`/crawled
- **Timestamp**: !`date +%Y%m%d-%H%M%S`

## Your Task

Crawl multiple pages from base URL: **$ARGUMENTS**

First check for a sitemap at `$ARGUMENTS/sitemap.xml`, then discover pages from navigation.

## Crawl Workflow

### 1. Discover Pages

```bash
# Check for sitemap
curl -s "$ARGUMENTS/sitemap.xml" | grep -oP '<loc>\K[^<]+' || echo "No sitemap"

# Or discover from navigation
agent-browser open "$ARGUMENTS"
agent-browser eval "
  JSON.stringify(
    Array.from(document.querySelectorAll('nav a, .sidebar a'))
      .map(a => a.href)
      .filter(h => h.startsWith(window.location.origin))
  )
"
```

### 2. Crawl Script

```bash
#!/bin/bash
START_URL="$ARGUMENTS"
OUTPUT_DIR="./crawled"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$OUTPUT_DIR"

# Discover pages
agent-browser open "$START_URL"
agent-browser wait --load networkidle

# Extract links
LINKS=$(agent-browser eval "
  JSON.stringify(
    Array.from(document.querySelectorAll('nav a, .sidebar a'))
      .map(a => ({ href: a.href, title: a.innerText.trim() }))
      .filter(l => l.href && l.href.startsWith(window.location.origin))
  )
")

# Process each page
echo "$LINKS" | jq -c '.[]' | while read -r page; do
  URL=$(echo "$page" | jq -r '.href')
  TITLE=$(echo "$page" | jq -r '.title')
  
  agent-browser open "$URL"
  agent-browser wait --load networkidle
  agent-browser get text body > "$OUTPUT_DIR/$(echo "$TITLE" | tr ' /' '-').md"
  sleep 1
done

agent-browser close
echo "✅ Crawled to $OUTPUT_DIR"
```

## Output

All pages saved to `crawled/` directory with markdown format.
