---
title: Automate change detection and site discovery to catch competitor changes immediately
impact: HIGH
impactDescription: "Without automated diff detection, significant competitor changes go unnoticed until a customer or sales rep reports them"
tags: competitive-intelligence, diff, change-detection, tavily, site-discovery
---

## Change Detection and Site Discovery

Detect differences between snapshots and discover competitor pages for monitoring.

**Incorrect -- manual visual comparison:**
```bash
# Open two browser tabs and visually compare
# No structured diff, easy to miss changes
# No record of what changed or when
```

**Correct -- automated diff with structured comparison:**
```bash
# Text diff between latest two snapshots
LATEST=$(ls -t .competitive-intel/snapshots/competitor-pricing-*.txt | head -1)
PREVIOUS=$(ls -t .competitive-intel/snapshots/competitor-pricing-*.txt | head -2 | tail -1)

diff -u "$PREVIOUS" "$LATEST" > \
  .competitive-intel/diffs/competitor-pricing-$(date +%Y%m%d).diff

# Structured JSON comparison for pricing changes
LATEST_JSON=$(ls -t .competitive-intel/snapshots/competitor-pricing-*.json | head -1)
PREVIOUS_JSON=$(ls -t .competitive-intel/snapshots/competitor-pricing-*.json | head -2 | tail -1)

jq -s '
  .[0] as $old | .[1] as $new |
  {
    price_changes: [
      $new[] | . as $tier |
      ($old[] | select(.name == $tier.name)) as $old_tier |
      select($old_tier.price \!= $tier.price) |
      {name: .name, old_price: $old_tier.price, new_price: .price}
    ],
    new_tiers: [$new[] | select(.name as $n | $old | map(.name) | index($n) | not)],
    removed_tiers: [$old[] | select(.name as $n | $new | map(.name) | index($n) | not)]
  }
' "$PREVIOUS_JSON" "$LATEST_JSON"
```

**Site discovery with Tavily (when TAVILY_API_KEY is set):**
```bash
# Crawl competitor site -- discovers URLs and extracts content
# Use Tavily crawl API with include_paths filter
# Save results to .competitive-intel/snapshots/ directory
# See web-research-workflow SKILL.md for full Tavily crawl examples
```

**Automated monitoring via CI:**
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

**Key rules:**
- Run structured JSON diffs, not just text diffs, to detect price and feature changes precisely
- Use Tavily crawl for initial site discovery when API key is available, fall back to manual URL lists
- Store diffs with timestamps for change history and trend analysis
- Automate monitoring in CI with daily schedules for consistent coverage
