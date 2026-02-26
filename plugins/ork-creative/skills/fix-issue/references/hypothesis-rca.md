# Hypothesis-Based Root Cause Analysis

Scientific method for identifying root causes with quantified confidence.

## The Scientific Method for RCA

```
1. Observe symptoms
2. Form hypotheses
3. Gather evidence
4. Test hypotheses
5. Confirm or reject
6. Repeat until root cause found
```

## Hypothesis Template

```markdown
## Hypothesis: [Brief name]
**Confidence:** [0-100]%

**Description:**
[What might be causing the issue]

**Evidence For:**
- [Supporting evidence 1]
- [Supporting evidence 2]

**Evidence Against:**
- [Contradicting evidence 1]

**Test Plan:**
1. [Step to verify/refute]
2. [Expected outcome if true]
```

## Confidence Score Guidelines

| Score | Meaning | Evidence Required |
|-------|---------|-------------------|
| 90-100% | Near certain | Reproduction + multiple strong evidence |
| 70-89% | Highly likely | Clear evidence, logical chain |
| 50-69% | Probable | Some evidence, plausible mechanism |
| 30-49% | Possible | Limited evidence, needs investigation |
| 0-29% | Unlikely | Weak evidence, backup hypothesis |

## Evidence Classification

| Type | Weight | Examples |
|------|--------|----------|
| **Reproduction** | +30% | Consistent reproduction steps |
| **Code trace** | +20% | Stack trace to specific line |
| **Timing correlation** | +15% | Issue appeared after deployment X |
| **Log evidence** | +15% | Error messages match hypothesis |
| **Similar patterns** | +10% | Same error in related code |
| **User report** | +5% | Consistent user descriptions |

## Contradicting Evidence

| Evidence | Weight |
|----------|--------|
| Hypothesis disproven by test | -40% |
| Works in same conditions | -25% |
| Unrelated timing | -15% |
| No supporting logs | -10% |

## Multiple Hypothesis Comparison

```markdown
| Hypothesis | Initial | After Test | Status |
|------------|---------|------------|--------|
| Race condition | 65% | 85% | INVESTIGATING |
| Null reference | 40% | 15% | REJECTED |
| Cache stale | 30% | 30% | ON HOLD |
```

## Best Practices

1. **Start with 3+ hypotheses** - Avoid tunnel vision
2. **Test highest confidence first** - Efficient investigation
3. **Update scores after each test** - Track progress
4. **Document rejected hypotheses** - Prevent repeated investigation
5. **Look for evidence against** - Avoid confirmation bias
