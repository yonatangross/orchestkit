---
title: Report drift accurately so CLAUDE.md counts reflect the actual codebase state
impact: HIGH
impactDescription: "Unreported drift causes incorrect CLAUDE.md counts that mislead Claude about the codebase"
tags: drift, reporting, consistency, validation
---

## Drift Detection and Reporting

After counting all sources, compare them and report using a structured table. Flag every mismatch with a specific file and field reference.

### Comparison Table Format

Output one table row per source. Use MATCH or DRIFT in the Status column.

```
| Source                        | Skills | Agents | Hooks | Status |
|-------------------------------|--------|--------|-------|--------|
| src/skills/ (actual)          | 63     | —      | —     | —      |
| src/agents/ (actual)          | —      | 37     | —     | —      |
| src/hooks/hooks.json (actual) | —      | —      | 87    | —      |
| CLAUDE.md Project Overview    | 63     | 37     | 87    | MATCH  |
| CLAUDE.md Version section     | —      | —      | 85    | DRIFT  |
| manifests/ork.json            | 63     | 36     | 87    | MATCH  |
```

### Flagging Drift

For each DRIFT row, output a specific fix instruction:

```
DRIFT: CLAUDE.md Version section says "85 entries" but hooks.json has 87.
  Fix: Update src/hooks/README.md line ~5 and CLAUDE.md Version section to "87 entries"
```

Include:
1. Which file has the wrong value
2. What the correct value is
3. Approximate line number or field name where the stale count appears

### Known Legitimate Differences

These are NOT drift — do not flag them:

| Difference | Reason |
|------------|--------|
| Agent count in manifests = actual - 1 | Some agents may be internal-only and excluded from manifest |

**Incorrect:**

```
DRIFT: CLAUDE.md has wrong hook count.
```

**Correct:**

```
DRIFT: CLAUDE.md Version section says "85 entries" but hooks.json has 87.
  Fix: Update CLAUDE.md Version section (line ~42) to "87 entries"
```

### Key Rules

- If all counts match, output "All counts consistent." and stop
- Always show the full table even when there is no drift — it confirms what was checked
- Reference file + field, not just file, when flagging drift (e.g., "CLAUDE.md line 7, Project Overview")
