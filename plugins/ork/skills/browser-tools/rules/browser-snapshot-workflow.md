---
title: Wait and snapshot browser content to avoid empty results and bloated page dumps
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

## Enhanced Screenshot Commands

Capture full pages and annotated snapshots for visual debugging:

```bash
# Full page and annotated capture
agent-browser screenshot --full /tmp/full-page.png   # Entire scrollable page
agent-browser screenshot --annotate                  # Numbered element labels for debugging
agent-browser pdf /tmp/page.pdf                      # Save as PDF
```

## Interaction with Element Refs

After `snapshot -i`, use `@refs` for precise interaction patterns:

```bash
# Correct: targeted interaction
agent-browser snapshot -i
agent-browser fill @e3 "search query"
agent-browser click @e5
agent-browser select @e7 "Category"
agent-browser hover @e2                  # Trigger dropdown
agent-browser scroll down 500            # Load more content
agent-browser scrollintoview @e15        # Navigate to element
agent-browser upload @e10 ./file.pdf     # File upload
agent-browser drag @e1 @e8              # Drag and drop

# Keyboard interaction
agent-browser press Enter                # Submit
agent-browser press Tab                  # Navigate
agent-browser keyboard type "query"      # Type without selector
```

## Storage in Snapshot Workflow

Read and debug page state during snapshots:

```bash
# Read page state
agent-browser storage local              # Check localStorage
agent-browser storage session            # Check sessionStorage
```

## Extended Wait Commands

Add semantic waits beyond `--load` patterns:

```bash
# Wait for custom conditions
agent-browser wait --fn "window.loaded"  # Custom JS condition
```

## Diff-Based Verification (v0.13+)

Replace manual "snapshot → act → snapshot → eyeball" patterns with native diff commands for verifiable, regression-free automation.

**Incorrect: Manual before/after comparison**
```bash
agent-browser snapshot -i > /tmp/before.txt
agent-browser click @e3
agent-browser snapshot -i > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt  # Manual, fragile
```

**Correct: Native diff verification**
```bash
agent-browser snapshot -i            # Captures baseline automatically
agent-browser click @e3
agent-browser wait --load networkidle
agent-browser diff snapshot          # Shows +/- changes like git diff
```

**Visual regression testing:**
```bash
# Capture baseline for regression tests
agent-browser screenshot /tmp/baseline.png

# Make CSS/component changes...

# Verify visual changes
agent-browser diff screenshot --baseline /tmp/baseline.png
# Output: 2.3% pixels changed — highlights differences in red
```

**Key rules for diff commands:**
- Use `diff snapshot` after every action to verify intended effect
- Save baselines for regression testing: `agent-browser snapshot -i > baseline.txt`
- Use `diff screenshot` for visual regression — anything >5% mismatch needs investigation
- Use `diff url` to compare staging vs production pages side-by-side
- Diff output uses git-style +/- for a11y trees and pixel counts for visual diffs
- Use `find "text"` (v0.16) as an alternative to `snapshot -i` when you know the element's visible text or label
- Use `find --role button "Submit"` to locate elements by ARIA role + text — more resilient than `@ref` numbers
- Use `highlight @e1` (v0.16) to visually mark elements during debugging — clear with `highlight --clear`
- Use `screenshot --annotate` for numbered element labels that correspond to `@ref` identifiers

Reference: `references/page-interaction.md` (Snapshot + Refs), `references/content-extraction.md` (Extraction Methods)
