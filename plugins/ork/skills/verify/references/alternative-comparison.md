# Alternative Comparison

Evaluate current implementation against alternative approaches.

## When to Compare

- Multiple valid architectures exist
- User asks "is this the best way?"
- Major patterns were chosen (ORM vs raw SQL, REST vs GraphQL)
- Performance/scalability concerns raised

---

## Comparison Criteria

### For Each Alternative

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Effort | 30% | Implementation complexity (1-5 scale) |
| Risk | 25% | Technical and operational risk (1-5 scale) |
| Benefit | 45% | Value delivered, performance, maintainability (1-5 scale) |

### Migration Cost

| Factor | Estimate |
|--------|----------|
| Code changes | Files/lines affected |
| Data migration | Schema changes, backfill |
| Testing | New test coverage needed |
| Rollback risk | Reversibility |

---

## Decision Matrix Format

| Approach | Effort | Risk | Benefit | Score |
|----------|--------|------|---------|-------|
| Current | N | N | N | (E*0.3 + R*0.25 + B*0.45) |
| Alt A | N | N | N | calculated |
| Alt B | N | N | N | calculated |

**Note:** Higher effort and risk are bad (invert for scoring), higher benefit is good.

**Recommendation Formula:**
```
Score = (5 - Effort) * 0.3 + (5 - Risk) * 0.25 + Benefit * 0.45
```

---

## Output Template

```markdown
### Alternative Comparison: [Topic]

**Current Approach:** [description]
- Score: N/10
- Pros: [strengths]
- Cons: [weaknesses]

**Alternative A:** [description]
- Score: N/10
- Pros: [strengths]
- Cons: [weaknesses]
- Migration effort: [1-5]

**Recommendation:** [Keep current / Switch to Alt A]
**Justification:** [1-2 sentences]
```
