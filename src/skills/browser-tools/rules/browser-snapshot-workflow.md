---
title: "Browser: Snapshot Workflow"
category: browser
impact: HIGH
impactDescription: "Extracting content without waiting or snapshotting produces empty results, stale refs, or bloated context from full-page dumps"
tags: [interaction, snapshot, extraction, workflow]
---

## Browser: Snapshot Workflow

Always follow the wait-then-snapshot-then-extract pattern: wait for the page to fully load, take an accessibility snapshot to discover element refs, then extract targeted content using those refs. Re-snapshot after any navigation or significant DOM change.

**Incorrect:**
```bash
# Extracting immediately without waiting — content may be empty or partial
agent-browser open https://docs.example.com/article
agent-browser get text body > /tmp/article.txt

# Using stale refs after navigating — @e5 refers to the OLD page
agent-browser snapshot -i
agent-browser click @e3
agent-browser get text @e5

# Full-page dump captures nav, header, footer, ads — massive noise
agent-browser wait --load networkidle
agent-browser get text body > /tmp/article.txt
```

**Correct:**
```bash
# 1. Navigate and wait for full page load
agent-browser open https://docs.example.com/article
agent-browser wait --load networkidle

# 2. Snapshot to discover element refs (93% less context than full DOM)
agent-browser snapshot -i
# Output: @e1 [nav] "Navigation", @e5 [article] "Main Content Area"

# 3. Extract targeted content using refs
agent-browser get text @e5  # Only the article, not the full page
```

```bash
# Re-snapshot after navigation or DOM changes
agent-browser snapshot -i
agent-browser fill @e1 "search query"
agent-browser click @e2

agent-browser wait --load networkidle
agent-browser snapshot -i          # NEW refs after page change
agent-browser get text @e1         # Extract from updated page
```

```bash
# Extraction preference order (lowest to highest context cost):
agent-browser get text @e5           # 1. Targeted ref (best)
agent-browser get html @e5           # 2. HTML when formatting matters
agent-browser eval "JSON.stringify(  # 3. Custom JS for structured data
  Array.from(document.querySelectorAll('h2')).map(h => h.innerText))"
agent-browser get text body          # 4. Full body (last resort)
```

**Key rules:**
- Always `wait --load networkidle` after `open` before any extraction or snapshotting
- Always `snapshot -i` before interacting with elements -- refs are only valid within their snapshot
- Re-snapshot after every navigation, form submission, or significant DOM change
- Use `get text @e#` for targeted extraction instead of `get text body` -- 93% less context
- Prefer semantic wait strategies (`--text`, `--url`, `@e#`) over fixed `wait` delays
- Verify extracted content is non-empty before saving to avoid capturing blank pages

Reference: `references/page-interaction.md` (Snapshot + Refs), `references/content-extraction.md` (Extraction Methods)
