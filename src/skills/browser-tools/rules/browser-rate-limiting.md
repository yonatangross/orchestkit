---
title: "Browser: Rate Limiting"
category: browser
impact: HIGH
impactDescription: "Rapid-fire requests trigger 429 blocks, IP bans, and unreliable extraction results"
tags: [scraping, rate-limiting, backoff, reliability]
---

## Browser: Rate Limiting

Add delays between requests, implement exponential backoff on rate-limit responses (429/503), and limit concurrent connections to avoid overwhelming target servers.

**Incorrect:**
```bash
# Rapid-fire requests with no delay
for url in "${URLS[@]}"; do
    agent-browser open "$url"
    agent-browser get text body > "/tmp/$(basename "$url").txt"
done
# No delay, no wait, no rate-limit detection — will trigger 429 blocks
```

**Correct:**
```bash
# Adaptive rate limiting with exponential backoff
DELAY=1

for url in "${URLS[@]}"; do
    agent-browser open "$url"
    agent-browser wait --load networkidle

    STATUS=$(agent-browser eval "
        const h1 = document.querySelector('h1');
        if (h1 && (h1.innerText.includes('429') || h1.innerText.includes('Too Many'))) {
            'rate-limited';
        } else if (document.title.includes('Access Denied')) {
            'blocked';
        } else { 'ok'; }
    ")

    case "$STATUS" in
        "rate-limited")
            DELAY=$((DELAY * 2)); sleep $DELAY; continue ;;
        "blocked")
            echo "Access denied: $url"; continue ;;
        *)
            agent-browser get text body > "/tmp/$(basename "$url").txt"
            DELAY=1 ;;  # Reset delay on success
    esac
    sleep $DELAY
done
```

```bash
# Retry with exponential backoff (max 3 attempts)
fetch_with_retry() {
    local url="$1" output="$2" max_retries=3 retry=0 delay=1
    while [[ $retry -lt $max_retries ]]; do
        if agent-browser open "$url" 2>/dev/null; then
            agent-browser wait --load networkidle
            agent-browser get text body > "$output"
            [[ -s "$output" ]] && return 0
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

**Key rules:**
- Always add at least a 1-second delay between consecutive page requests
- Detect rate-limit responses (429, "Too Many Requests", "Access Denied") and back off exponentially
- Reset the backoff delay to baseline after a successful request
- Use a retry function with a max retry count and exponential backoff for failed pages
- Log failed URLs to a separate file instead of silently skipping them
Reference: `references/anti-bot-handling.md` (Rate Limiting, Adaptive Rate Limiting, Retry Logic)
