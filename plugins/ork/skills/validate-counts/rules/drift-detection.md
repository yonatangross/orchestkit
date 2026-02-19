---
title: Drift Detection and Reporting
impact: HIGH
tags: [validation, drift, mismatch]
---

# Drift Detection

## What Counts as Drift

A mismatch between any declared count (CLAUDE.md, manifests) and the corresponding actual filesystem count.

## Severity

| Condition | Severity |
|-----------|----------|
| Manifest count differs from actual | FAIL — will break plugin validation |
| CLAUDE.md count differs from actual | WARN — documentation stale |
| `orkl` count differs from `ork` by unexpected amount | WARN — investigate |

## Reporting Format

For each mismatch, output:

```
DRIFT: <file>:<field>
  Expected (actual): <N>
  Declared:          <M>
  Fix: Update <field> in <file> to <N>
```

## Fix Actions

| Drift Location | Fix |
|----------------|-----|
| CLAUDE.md Project Overview | Edit the count inline |
| CLAUDE.md Version section | Edit the hooks breakdown line |
| `manifests/ork.json` | Update metadata count field, run `npm run build` |
| `manifests/orkl.json` | Update metadata count field, run `npm run build` |

If counts all match, output: `All counts consistent.` and exit.
