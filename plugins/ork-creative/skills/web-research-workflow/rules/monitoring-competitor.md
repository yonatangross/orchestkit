---
title: Monitor competitor pages for pricing and feature changes to enable timely strategic response
impact: HIGH
impactDescription: "Missing competitor pricing or feature changes delays strategic response by days or weeks"
tags: competitive-intelligence, monitoring, pricing, features, snapshots
---

## Competitor Page Monitoring

Capture point-in-time snapshots of competitor pages for pricing, features, and positioning tracking.

**Incorrect -- manual one-off checks with no history:**
```bash
# Check competitor pricing once, no record kept
# No snapshot, no history, no comparison baseline
```

**Correct -- structured snapshot capture with change classification:**
```bash
# Create snapshots directory
mkdir -p .competitive-intel/snapshots

# Capture text content
agent-browser open https://competitor.com/pricing
agent-browser wait --load networkidle
agent-browser get text body > \
  .competitive-intel/snapshots/competitor-pricing-$(date +%Y%m%d).txt

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

**Change classification:**

| Severity | Examples | Action |
|----------|----------|--------|
| Critical | Price increase/decrease, major feature change | Immediate alert |
| High | New feature added, feature removed | Review required |
| Medium | Copy changes, positioning shift | Note for analysis |
| Low | Typos, minor styling | Log only |

**Config file for monitoring targets:**
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

**Key rules:**
- Always save both text and structured (JSON) snapshots for each capture
- Use consistent date-stamped filenames for chronological comparison
- Classify changes by severity to prioritize strategic response
- Store findings in knowledge graph for cross-session persistence
