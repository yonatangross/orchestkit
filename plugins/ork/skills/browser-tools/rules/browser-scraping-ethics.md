---
title: Respect robots.txt and terms of service to avoid legal issues and IP bans
category: browser
impact: CRITICAL
impactDescription: "Violating robots.txt or ToS can lead to IP bans, legal action, or permanent API blocks"
tags: [scraping, ethics, robots-txt, compliance]
---

## Browser: Scraping Ethics

Always scrape responsibly: check robots.txt, comply with Terms of Service, identify yourself as an automated agent, and never scrape personal or auth-gated data without explicit permission.

**Incorrect:**
```bash
# Ignoring robots.txt entirely
agent-browser open https://example.com/private-api/users
agent-browser get text body > /tmp/users.txt

# Spoofing user-agent to appear as a real browser
agent-browser eval "
  Object.defineProperty(navigator, 'userAgent', {
    get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120'
  });
"

# Scraping auth-gated content without permission
agent-browser state load /tmp/stolen-session.json
agent-browser open https://app.example.com/admin/user-data
agent-browser get text body > /tmp/scraped-pii.txt
```

**Correct:**
```bash
# 1. Check robots.txt BEFORE crawling any site
ROBOTS=$(curl -s "https://docs.example.com/robots.txt")

if echo "$ROBOTS" | grep -q "Disallow: /docs"; then
    echo "Crawling /docs is disallowed by robots.txt"
    exit 1
fi

# 2. Parse and respect crawl-delay directives
CRAWL_DELAY=$(echo "$ROBOTS" | grep -i "Crawl-delay" | head -1 | awk '{print $2}')
DELAY=${CRAWL_DELAY:-1}  # Default to 1 second if not specified

# 3. Use an identifiable user-agent string
# (agent-browser identifies itself by default — do NOT override it)

# 4. Only scrape publicly accessible, non-personal content
agent-browser open "https://docs.example.com/public/guide"
agent-browser wait --load networkidle
agent-browser get text @e5  # Extract specific content area, not full page
```

**Key rules:**
- Always check `robots.txt` before crawling any domain and honor `Disallow` directives
- Respect `Crawl-delay` values; default to at least 1 second between requests
- Never spoof user-agent strings to bypass bot detection -- identify as an automated tool
- Do not scrape personal data, auth-gated content, or content behind paywalls without explicit authorization
- Comply with the site's Terms of Service; when in doubt, do not scrape
- Use targeted extraction (`get text @e#`) instead of full-page dumps to minimize data collection

Reference: `references/anti-bot-handling.md` (Respectful Scraping Principles, Check robots.txt)
