---
name: competitive-monitoring
description: Tracks competitor page changes over time. Captures snapshots, detects diffs, alerts on significant changes. Supports Tavily site discovery for URL enumeration. Use when monitoring competitive intelligence, pricing changes, or feature tracking.
context: fork
agent: market-intelligence
version: 1.1.0
author: OrchestKit AI Agent Hub
tags: [competitive-intelligence, monitoring, diff, tracking, pricing, tavily]
user-invocable: true
allowedTools: [Bash, Read, Write, WebFetch]
complexity: medium
---

# Competitive Monitoring

Track competitor websites for changes in pricing, features, positioning, and content.

## Quick Start

```bash
# Capture initial snapshot
/ork:competitive-monitoring capture https://competitor.com/pricing

# Check for changes (compares to last snapshot)
/ork:competitive-monitoring diff https://competitor.com/pricing

# View change history
/ork:competitive-monitoring history competitor.com
```

## Core Concepts

### Snapshot
A point-in-time capture of a webpage including:
- **Text content** - Main body text
- **Structured data** - Pricing tiers, feature lists, etc.
- **Screenshot** - Visual state
- **Metadata** - Timestamp, URL, capture method

### Diff
Comparison between two snapshots showing:
- **Added content** - New text, features, prices
- **Removed content** - Deleted sections
- **Changed content** - Modified values
- **Visual changes** - Layout/design shifts

### Change Classification

| Severity | Examples | Action |
|----------|----------|--------|
| **Critical** | Price increase/decrease, major feature change | Immediate alert |
| **High** | New feature added, feature removed | Review required |
| **Medium** | Copy changes, positioning shift | Note for analysis |
| **Low** | Typos, minor styling | Log only |

## Site Discovery with Tavily (Optional Pre-Step)

When `TAVILY_API_KEY` is available, use Tavily's crawl API to discover and extract all key pages on a competitor's site in one call. This replaces the manual map→extract two-step workflow.

### Option A: Crawl (Recommended — Single Call)

```bash
# Crawl competitor site — discovers URLs and extracts content in one step
curl -s -X POST 'https://api.tavily.com/crawl' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{
    "url": "https://competitor.com",
    "max_depth": 2,
    "limit": 50,
    "include_raw_content": "markdown",
    "include_paths": ["/pricing*", "/features*", "/changelog*", "/blog*"]
  }' | python3 -c "
import json, sys
data = json.load(sys.stdin)
for page in data.get('results', []):
    fname = page['url'].replace('https://', '').replace('/', '_')
    with open(f'.competitive-intel/snapshots/{fname}.md', 'w') as f:
        f.write(page.get('raw_content', page.get('content', '')))
    print(f'Captured: {page[\"url\"]}')
"
```

### Option B: Map + Extract (Granular Control)

Use when you need to filter URLs before extracting:

```bash
# Step 1: Discover URLs
curl -s -X POST 'https://api.tavily.com/map' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d '{"url": "https://competitor.com", "max_depth": 2, "limit": 50}' \
  | python3 -c "
import json, sys
for url in json.load(sys.stdin).get('urls', []): print(url)
" > .competitive-intel/discovered-urls.txt

# Step 2: Filter and batch extract
URLS=$(grep -E '(pricing|features|changelog)' .competitive-intel/discovered-urls.txt \
  | head -20 | python3 -c "import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))")

curl -s -X POST 'https://api.tavily.com/extract' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -d "{\"urls\": $URLS}" | python3 -m json.tool
```

**Cost**: Crawl ~1 credit/5 pages. Map+Extract ~1 credit/10 mapped + 1 credit/5 extracted. Skip if `TAVILY_API_KEY` unset — proceed directly to browser-based capture below.

## Workflow

### Step 1: Initial Capture

```bash
# Create snapshots directory
mkdir -p .competitive-intel/snapshots

# Capture competitor pricing page
agent-browser open https://competitor.com/pricing
agent-browser wait --load networkidle

# Save text content
agent-browser get text body > .competitive-intel/snapshots/competitor-pricing-$(date +%Y%m%d).txt

# Save screenshot
agent-browser screenshot .competitive-intel/snapshots/competitor-pricing-$(date +%Y%m%d).png

# Extract structured pricing data
agent-browser eval "JSON.stringify(
  Array.from(document.querySelectorAll('.pricing-tier')).map(tier => ({
    name: tier.querySelector('h3')?.innerText,
    price: tier.querySelector('.price')?.innerText,
    features: Array.from(tier.querySelectorAll('li')).map(li => li.innerText)
  }))
)" > .competitive-intel/snapshots/competitor-pricing-$(date +%Y%m%d).json

agent-browser close
```

### Step 2: Diff Detection

```bash
# Get latest two snapshots
LATEST=$(ls -t .competitive-intel/snapshots/competitor-pricing-*.txt | head -1)
PREVIOUS=$(ls -t .competitive-intel/snapshots/competitor-pricing-*.txt | head -2 | tail -1)

# Text diff
diff -u "$PREVIOUS" "$LATEST" > .competitive-intel/diffs/competitor-pricing-$(date +%Y%m%d).diff

# Check if significant changes
if [ -s ".competitive-intel/diffs/competitor-pricing-$(date +%Y%m%d).diff" ]; then
  echo "Changes detected!"
  cat ".competitive-intel/diffs/competitor-pricing-$(date +%Y%m%d).diff"
fi
```

### Step 3: Structured Comparison

```bash
# Compare JSON pricing data
LATEST_JSON=$(ls -t .competitive-intel/snapshots/competitor-pricing-*.json | head -1)
PREVIOUS_JSON=$(ls -t .competitive-intel/snapshots/competitor-pricing-*.json | head -2 | tail -1)

# Use jq to compare
jq -s '
  .[0] as $old | .[1] as $new |
  {
    price_changes: [
      $new[] | . as $tier |
      ($old[] | select(.name == $tier.name)) as $old_tier |
      select($old_tier.price != $tier.price) |
      {name: .name, old_price: $old_tier.price, new_price: .price}
    ],
    new_tiers: [$new[] | select(.name as $n | $old | map(.name) | index($n) | not)],
    removed_tiers: [$old[] | select(.name as $n | $new | map(.name) | index($n) | not)]
  }
' "$PREVIOUS_JSON" "$LATEST_JSON"
```

## Monitoring Targets

### Pricing Pages
```bash
# Extract pricing structure
agent-browser eval "JSON.stringify({
  tiers: Array.from(document.querySelectorAll('[class*=pricing], [class*=plan]')).map(t => ({
    name: t.querySelector('h2, h3, [class*=title]')?.innerText?.trim(),
    price: t.querySelector('[class*=price], [class*=cost]')?.innerText?.trim(),
    period: t.querySelector('[class*=period], [class*=billing]')?.innerText?.trim(),
    cta: t.querySelector('button, [class*=cta]')?.innerText?.trim()
  }))
})"
```

### Feature Pages
```bash
# Extract feature list
agent-browser eval "JSON.stringify({
  features: Array.from(document.querySelectorAll('[class*=feature] h3, [class*=feature] h4')).map(f => f.innerText?.trim()),
  categories: Array.from(document.querySelectorAll('[class*=category]')).map(c => ({
    name: c.querySelector('h2, h3')?.innerText?.trim(),
    items: Array.from(c.querySelectorAll('li')).map(li => li.innerText?.trim())
  }))
})"
```

### Changelog/Release Notes
```bash
# Extract recent releases
agent-browser eval "JSON.stringify({
  releases: Array.from(document.querySelectorAll('[class*=release], [class*=changelog] > div')).slice(0, 10).map(r => ({
    version: r.querySelector('[class*=version], h2, h3')?.innerText?.trim(),
    date: r.querySelector('[class*=date], time')?.innerText?.trim(),
    notes: r.querySelector('[class*=notes], [class*=description]')?.innerText?.trim()?.slice(0, 200)
  }))
})"
```

## Storage Pattern

```
.competitive-intel/
├── config.json           # Monitored URLs and schedules
├── snapshots/
│   ├── competitor-a/
│   │   ├── pricing-0201.txt
│   │   ├── pricing-0201.json
│   │   └── pricing-0201.png
│   └── competitor-b/
│       └── ...
├── diffs/
│   ├── competitor-a/
│   │   └── pricing-0201.diff
│   └── competitor-b/
│       └── ...
└── reports/
    └── weekly-0201.md
```

## Config File

```json
{
  "monitors": [
    {
      "name": "Competitor A Pricing",
      "url": "https://competitor-a.com/pricing",
      "frequency": "daily",
      "selectors": {
        "pricing": ".pricing-tier",
        "features": ".feature-list li"
      },
      "alerts": {
        "price_change": "critical",
        "new_feature": "high",
        "copy_change": "low"
      }
    }
  ],
  "storage": ".competitive-intel",
  "retention_days": 90
}
```

## Change Report Template

```markdown
# Competitive Change Report

**Date:** 2026-02-04
**Competitor:** Competitor A
**URL:** https://competitor-a.com/pricing

## Summary
- **Critical Changes:** 1 (price increase)
- **High Changes:** 2 (new features)
- **Medium Changes:** 0
- **Low Changes:** 3 (copy updates)

## Critical: Price Change Detected

| Tier | Previous | Current | Change |
|------|----------|---------|--------|
| Pro  | $29/mo   | $39/mo  | +34%   |

## High: New Features Added

1. **AI Assistant** - Added to Pro tier
2. **API Access** - Now available in Team tier

## Recommendation
- Update competitive positioning
- Review our pricing strategy
- Consider matching new AI feature
```

## Integration with Memory

Store findings in knowledge graph for persistence:

```bash
# After detecting changes, store in memory
mcp__memory__add_node(
  name="Competitor A Price Increase -02",
  type="competitive_intelligence",
  content="Pro tier increased from $29 to $39 (+34%)"
)

# Query historical changes
mcp__memory__search_nodes(query="competitor pricing changes ")
```

## Automation Ideas

### Scheduled Monitoring (via cron/CI)
```yaml
# .github/workflows/competitive-monitor.yml
name: Competitive Monitor
on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM
jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g agent-browser
      - run: agent-browser install
      - run: ./scripts/run-competitive-monitor.sh
      - uses: actions/upload-artifact@v4
        with:
          name: competitive-intel
          path: .competitive-intel/
```

## Related Skills

- `web-research-workflow` - Decides WebFetch vs browser
- `browser-content-capture` - Detailed capture patterns
- `market-analysis-patterns` - Analysis frameworks

---

**Version:** 1.1.0 (February 2026)
