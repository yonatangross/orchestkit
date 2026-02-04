# RCA Report: Issue #[NUMBER]

## Summary
**Issue:** [Brief description]
**Status:** [Resolved/In Progress]
**Resolution Date:** [YYYY-MM-DD]

---

## Hypotheses

| # | Hypothesis | Initial | Final | Status |
|---|------------|---------|-------|--------|
| 1 | [Name] | [N]% | [M]% | [CONFIRMED/REJECTED] |
| 2 | [Name] | [N]% | [M]% | [CONFIRMED/REJECTED] |
| 3 | [Name] | [N]% | [M]% | [CONFIRMED/REJECTED] |

---

## Evidence

### Supporting Evidence
- [Evidence 1] (+[N]%)
- [Evidence 2] (+[N]%)

### Contradicting Evidence
- [Evidence 1] (-[N]%)

---

## Conclusion

**Root Cause:** [Description]
**Location:** `[file:line]`
**Trigger:** [What caused the issue to manifest]

---

## Prevention Recommendations

| Level | Recommendation | Effort | Impact |
|-------|---------------|--------|--------|
| Code | [Action] | Low | High |
| Process | [Action] | Medium | Medium |
| Tooling | [Action] | Low | Medium |

---

## JSON Output

```json
{
  "issue_number": "[NUMBER]",
  "root_cause": {
    "description": "[Description]",
    "location": "[file:line]",
    "confidence": [N]
  },
  "hypotheses": [
    {"name": "[Name]", "initial": [N], "final": [M], "status": "[STATUS]"}
  ],
  "prevention": [
    {"level": "code", "action": "[Action]", "effort": "low", "impact": "high"}
  ],
  "resolution_time": "[Duration]"
}
```
