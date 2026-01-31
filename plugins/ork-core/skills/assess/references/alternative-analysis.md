# Alternative Analysis Reference

How to identify, evaluate, and compare alternatives to the current approach.

## Identifying Alternatives

1. **Direct Substitutes**: Different implementations of the same solution
2. **Architectural Alternatives**: Different design patterns or approaches
3. **Technology Alternatives**: Different libraries, frameworks, or tools
4. **Hybrid Approaches**: Combinations of multiple alternatives

## Comparison Dimensions

| Dimension | Question | Weight |
|-----------|----------|--------|
| Score | How does it rate on 6 dimensions? | 0.30 |
| Effort | How hard to implement/migrate? | 0.25 |
| Risk | What could go wrong? | 0.25 |
| Benefit | What's the expected improvement? | 0.20 |

## Migration Effort Scale

| Level | Description | Time Estimate |
|-------|-------------|---------------|
| 1 | Drop-in replacement | < 1 hour |
| 2 | Minor refactoring | 1-4 hours |
| 3 | Moderate changes | 1-2 days |
| 4 | Significant rework | 3-5 days |
| 5 | Major rewrite | 1+ weeks |

## Risk Categories

- **Technical**: Will it work? Compatibility issues?
- **Team**: Does team know this? Learning curve?
- **Timeline**: Can we afford the migration time?
- **Dependencies**: What else needs to change?

## Decision Criteria

**Switch if:**
- Score improvement >= 1.5 points AND effort <= 3
- Current has critical security/correctness issues
- Alternative has significantly lower maintenance burden

**Stay if:**
- Score difference < 1.0 point
- Migration effort >= 4 AND no critical issues
- Team familiarity strongly favors current

## Trade-off Documentation

```markdown
## Alternative: [Name]

**Score Delta:** +/-[N.N] points
**Migration Effort:** [1-5]
**Risk Level:** Low/Medium/High

### Why Consider
- [Benefit 1]
- [Benefit 2]

### Why Not
- [Drawback 1]
- [Drawback 2]

### Verdict: [Adopt/Defer/Reject]
```
