# Anti-Bot Handling

Patterns for respectful scraping, rate limiting, CAPTCHA handling, and resilient crawling.

## Respectful Scraping Principles

1. **Check robots.txt** before crawling any site
2. **Add delays** between page navigations
3. **Don't crawl faster** than a human would browse
4. **Honor rate limits** (HTTP 429 responses)
5. **Identify yourself** when possible

---

## Check robots.txt

```bash
# Check robots.txt before crawling
ROBOTS=$(curl -s "https://docs.example.com/robots.txt")

if echo "$ROBOTS" | grep -q "Disallow: /docs"; then
    echo "Crawling /docs is disallowed by robots.txt"
    exit 1
fi

# Parse specific rules
CRAWL_DELAY=$(echo "$ROBOTS" | grep -i "Crawl-delay" | head -1 | awk '{print $2}')
DELAY=${CRAWL_DELAY:-1}  # Default to 1 second if not specified
```

---

## Rate Limiting

### Between Requests

```bash
# Add delay between requests
for url in "${URLS[@]}"; do
    agent-browser open "$url"
    agent-browser wait --load networkidle
    agent-browser get text body > "/tmp/$(basename "$url").txt"
    sleep 1  # Respect server resources
done
```

### Adaptive Rate Limiting

```bash
#!/bin/bash
# Back off when seeing rate limit responses

DELAY=1

for url in "${URLS[@]}"; do
    agent-browser open "$url"

    # Check for rate limiting indicators
    STATUS=$(agent-browser eval "
        // Check for common rate limit responses
        const h1 = document.querySelector('h1');
        if (h1 && (h1.innerText.includes('429') || h1.innerText.includes('Too Many'))) {
            'rate-limited';
        } else if (document.title.includes('Access Denied')) {
            'blocked';
        } else {
            'ok';
        }
    ")

    case "$STATUS" in
        "rate-limited")
            echo "Rate limited, backing off..."
            DELAY=$((DELAY * 2))
            sleep $DELAY
            continue
            ;;
        "blocked")
            echo "Access denied for: $url"
            continue
            ;;
        *)
            agent-browser get text body > "/tmp/$(basename "$url").txt"
            DELAY=1  # Reset delay on success
            ;;
    esac

    sleep $DELAY
done
```

---

## CAPTCHA Handling

CAPTCHAs require manual intervention. Use headed mode:

```bash
# Switch to headed mode for CAPTCHA sites
AGENT_BROWSER_HEADED=1 agent-browser open https://captcha-site.com

echo "Please solve the CAPTCHA in the browser window..."

# Wait for user to complete CAPTCHA
agent-browser wait --url "**/content" --timeout 120000

# Save state to avoid future CAPTCHAs
agent-browser state save /tmp/captcha-solved.json

# Continue automated extraction
agent-browser get text body
```

---

## Error Handling

### Handle Failed Pages

```bash
# Graceful error handling per page
for url in "${URLS[@]}"; do
    if ! agent-browser open "$url" 2>/dev/null; then
        echo "Failed to load: $url" >> /tmp/failed-urls.txt
        continue
    fi

    agent-browser wait --load networkidle

    # Verify content loaded
    HAS_CONTENT=$(agent-browser eval "document.body.innerText.trim().length > 100")
    if [[ "$HAS_CONTENT" != "true" ]]; then
        echo "Empty content: $url" >> /tmp/failed-urls.txt
        continue
    fi

    agent-browser get text body > "/tmp/$(basename "$url").txt"
done
```

### Retry Logic

```bash
#!/bin/bash
# Retry failed pages with exponential backoff

fetch_with_retry() {
    local url="$1"
    local output="$2"
    local max_retries=3
    local retry=0
    local delay=1

    while [[ $retry -lt $max_retries ]]; do
        if agent-browser open "$url" 2>/dev/null; then
            agent-browser wait --load networkidle
            agent-browser get text body > "$output"
            if [[ -s "$output" ]]; then
                return 0
            fi
        fi

        ((retry++))
        echo "Retry $retry/$max_retries for: $url (waiting ${delay}s)"
        sleep $delay
        delay=$((delay * 2))
    done

    echo "Failed after $max_retries retries: $url" >> /tmp/failed-urls.txt
    return 1
}
```

---

## Resume Capability

### Skip Already Crawled Pages

```bash
# Resume interrupted crawls
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

### Progress Tracking

```bash
#!/bin/bash
# Track crawl progress

PROGRESS_FILE="/tmp/crawl-progress.json"
TOTAL=${#URLS[@]}
COMPLETED=0

for url in "${URLS[@]}"; do
    ((COMPLETED++))
    echo "[$COMPLETED/$TOTAL] Crawling: $url"

    agent-browser open "$url"
    agent-browser wait --load networkidle
    agent-browser get text body > "/tmp/page-$COMPLETED.txt"

    # Save progress
    echo "{\"completed\": $COMPLETED, \"total\": $TOTAL, \"last_url\": \"$url\"}" > "$PROGRESS_FILE"
done
```

---

## Iframe and Shadow DOM

### Content in Iframes

```bash
# Switch to iframe
agent-browser frame @e3
agent-browser get text body
# Return to main frame
agent-browser frame main
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Empty content | Add `wait --load networkidle` after navigation |
| Partial render | Use `wait --text "Expected content"` |
| Login required | Use authentication flow with `state save/load` |
| CAPTCHA blocking | Use headed mode for manual intervention |
| Content in iframe | Use `frame @e#` then extract |
| Rate limited (429) | Increase delay, implement exponential backoff |
| Access denied | Check robots.txt, try headed mode |
