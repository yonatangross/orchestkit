---
title: Classify audit status with correct severity mapping to avoid misleading results
impact: MEDIUM
impactDescription: "Wrong severity mapping produces misleading audit results — FATALs hidden as WARNs or vice versa"
tags: audit, status, pass, warn, fail
---

## Audit Status Classification

Maps check results from `audit-checks.md` to a PASS / WARN / FAIL status per skill.

### Severity Table

| Condition | Severity |
|-----------|----------|
| `lines > 500` | FAIL |
| Not in any manifest | FAIL |
| Missing required frontmatter field | WARN |
| `rules_count == 0 AND refs_count == 0` | WARN |
| Broken reference (file mentioned in SKILL.md but missing on disk) | WARN |
| `lines > 400` (approaching limit) | WARN |

### Classification Logic

**Incorrect:**
```python
# Treating all issues as WARN — masks real failures
status = "WARN" if any_issue else "PASS"
```

**Correct:**
```python
fails = []
warns = []

if line_count > 500:
    fails.append(f"lines={line_count}>500")
elif line_count > 400:
    warns.append(f"lines={line_count}>400 (approaching limit)")

if missing_fm:
    warns.append(f"missing_fm:{','.join(sorted(missing_fm))}")

if rules_count == 0 and refs_count == 0:
    warns.append("no_rules_or_refs")

if not in_manifest:
    fails.append("not_in_manifest")

if broken_refs:
    for ref in broken_refs:
        warns.append(f"broken_ref:{ref}")

# Final status: FAIL > WARN > PASS
if fails:
    status = "FAIL"
elif warns:
    status = "WARN"
else:
    status = "PASS"
```

### Output Detail Lines

Print WARN/FAIL details indented under the skill row:

```
my-skill                                   510   OK     3    0   YES FAIL
  FAIL: lines=510>500
my-skill-2                                 210  WARN     0    0   YES WARN
  WARN: missing_fm:version,author
  WARN: no_rules_or_refs
```

**Key rules:**
- FAIL takes precedence over WARN — a skill with both is FAIL
- Always print detail lines for non-PASS skills for actionability
- Treat each missing frontmatter field as a separate WARN item
