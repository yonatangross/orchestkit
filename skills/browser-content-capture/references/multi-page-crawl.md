# Multi-Page Crawl

Patterns for extracting content from multiple pages using agent-browser.

## Overview

Multi-page crawling is needed when:
- Documentation spans multiple pages
- Content is paginated
- Need to follow navigation links
- Building comprehensive content index

---

## Basic Crawl Pattern

### Extract Links, Then Visit

```bash
# 1. Navigate to starting page
agent-browser open https://docs.example.com

# 2. Wait for page to load
agent-browser wait --load networkidle

# 3. Extract all navigation links
LINKS=$(agent-browser eval "
JSON.stringify(
    Array.from(document.querySelectorAll('nav a, .sidebar a'))
        .map(a => a.href)
        .filter(href => href.startsWith('https://docs.example.com'))
)
")

# 4. Visit each link and extract
for link in $(echo "$LINKS" | jq -r '.[]'); do
    echo "Extracting: $link"
    agent-browser open "$link"
    agent-browser wait --load networkidle
    agent-browser get text body > "/tmp/$(basename "$link").txt"
done

# 5. Close browser
agent-browser close
```

---

## Structured Crawl with Metadata

```bash
#!/bin/bash
# Crawl with metadata extraction

OUTPUT_DIR="/tmp/docs-crawl"
mkdir -p "$OUTPUT_DIR"

agent-browser open https://docs.example.com
agent-browser wait --load networkidle

# Get links with titles
PAGES=$(agent-browser eval "
JSON.stringify(
    Array.from(document.querySelectorAll('nav a'))
        .map(a => ({
            url: a.href,
            title: a.innerText.trim()
        }))
        .filter(p => p.url.startsWith(window.location.origin))
)
")

# Process each page
echo "$PAGES" | jq -c '.[]' | while read -r page; do
    URL=$(echo "$page" | jq -r '.url')
    TITLE=$(echo "$page" | jq -r '.title')
    FILENAME=$(echo "$TITLE" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

    echo "Crawling: $TITLE"
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
done

agent-browser close
echo "Crawl complete: $(ls "$OUTPUT_DIR" | wc -l) pages"
```

---

## Pagination Handling

### Click-Based Pagination

```bash
#!/bin/bash
# Handle "Next" button pagination

PAGE=1
while true; do
    echo "Extracting page $PAGE..."

    # Extract current page content
    agent-browser get text body > "/tmp/page-$PAGE.txt"

    # Check for next button
    agent-browser snapshot -i
    NEXT_BUTTON=$(agent-browser eval "
        const next = document.querySelector('.next, [rel=\"next\"], a:has-text(\"Next\")');
        next ? 'found' : 'none';
    ")

    if [[ "$NEXT_BUTTON" == "none" ]]; then
        echo "No more pages"
        break
    fi

    # Click next
    agent-browser click @e1  # Next button ref from snapshot
    agent-browser wait --load networkidle
    ((PAGE++))
done
```

### URL-Based Pagination

```bash
#!/bin/bash
# Handle URL parameter pagination

BASE_URL="https://api.example.com/docs"
PAGE=1

while true; do
    URL="${BASE_URL}?page=${PAGE}"
    echo "Fetching: $URL"

    agent-browser open "$URL"
    agent-browser wait --load networkidle

    # Check if page has content
    HAS_CONTENT=$(agent-browser eval "
        document.querySelector('.content').children.length > 0
    ")

    if [[ "$HAS_CONTENT" != "true" ]]; then
        echo "No more content at page $PAGE"
        break
    fi

    agent-browser get text body > "/tmp/page-$PAGE.txt"
    ((PAGE++))
done
```

---

## Recursive Crawl

### Follow All Links (Depth-Limited)

```bash
#!/bin/bash
# Recursive crawl with depth limit

MAX_DEPTH=3
VISITED_FILE="/tmp/visited-urls.txt"
touch "$VISITED_FILE"

crawl_page() {
    local url="$1"
    local depth="$2"

    # Skip if already visited
    grep -qF "$url" "$VISITED_FILE" && return

    # Skip if too deep
    [[ $depth -gt $MAX_DEPTH ]] && return

    echo "[$depth] Crawling: $url"
    echo "$url" >> "$VISITED_FILE"

    agent-browser open "$url"
    agent-browser wait --load networkidle

    # Save content
    local filename
    filename=$(echo "$url" | md5sum | cut -d' ' -f1)
    agent-browser get text body > "/tmp/crawl/$filename.txt"

    # Get child links
    local links
    links=$(agent-browser eval "
        JSON.stringify(
            Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(h => h.startsWith('$BASE_URL'))
        )
    ")

    # Recursively crawl children
    for link in $(echo "$links" | jq -r '.[]' | head -20); do
        crawl_page "$link" $((depth + 1))
    done
}

BASE_URL="https://docs.example.com"
mkdir -p /tmp/crawl
crawl_page "$BASE_URL" 0
agent-browser close
```

---

## Parallel Crawling with Sessions

```bash
#!/bin/bash
# Use multiple sessions for parallel crawling

URLS=(
    "https://docs.example.com/page1"
    "https://docs.example.com/page2"
    "https://docs.example.com/page3"
    "https://docs.example.com/page4"
)

# Start parallel sessions
for i in "${!URLS[@]}"; do
    SESSION="crawler-$i"
    URL="${URLS[$i]}"

    (
        agent-browser --session "$SESSION" open "$URL"
        agent-browser --session "$SESSION" wait --load networkidle
        agent-browser --session "$SESSION" get text body > "/tmp/page-$i.txt"
        agent-browser --session "$SESSION" close
    ) &
done

# Wait for all to complete
wait
echo "All pages crawled"
```

---

## Best Practices

### 1. Rate Limiting

```bash
# Add delay between requests
for url in "${URLS[@]}"; do
    agent-browser open "$url"
    agent-browser wait --load networkidle
    agent-browser get text body > "/tmp/$(basename "$url").txt"
    sleep 1  # 1 second delay between requests
done
```

### 2. Error Handling

```bash
# Handle failed pages gracefully
for url in "${URLS[@]}"; do
    if ! agent-browser open "$url" 2>/dev/null; then
        echo "Failed to load: $url" >> /tmp/failed-urls.txt
        continue
    fi
    agent-browser get text body > "/tmp/$(basename "$url").txt"
done
```

### 3. Resume Capability

```bash
# Skip already crawled pages
CRAWLED_DIR="/tmp/crawled"
mkdir -p "$CRAWLED_DIR"

for url in "${URLS[@]}"; do
    HASH=$(echo "$url" | md5sum | cut -d' ' -f1)
    OUTPUT="$CRAWLED_DIR/$HASH.txt"

    if [[ -f "$OUTPUT" ]]; then
        echo "Skipping (already crawled): $url"
        continue
    fi

    agent-browser open "$url"
    agent-browser wait --load networkidle
    agent-browser get text body > "$OUTPUT"
done
```

### 4. Respect robots.txt

```bash
# Check robots.txt before crawling
ROBOTS=$(curl -s "https://docs.example.com/robots.txt")
if echo "$ROBOTS" | grep -q "Disallow: /docs"; then
    echo "Crawling /docs is disallowed by robots.txt"
    exit 1
fi
```
