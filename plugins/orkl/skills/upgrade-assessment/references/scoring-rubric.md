# Scoring Rubric

Detailed per-dimension scoring thresholds for Phase 4 of upgrade assessment.

## Dimensions and Weights

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| **Model Compatibility** | 0.25 | Hardcoded model refs, capability assumptions, output limit assumptions |
| **Hook Compatibility** | 0.20 | Hook type changes, async pattern changes, lifecycle changes |
| **Skill Coverage** | 0.15 | Skill format changes, deprecated skills, new required skills |
| **Agent Readiness** | 0.15 | Agent format changes, model field validity, tool availability |
| **Memory Architecture** | 0.10 | Memory tier changes, storage format changes, migration needs |
| **CI/CD Pipeline** | 0.15 | Test compatibility, build system changes, deployment config |

## Score Interpretation

| Range | Label | Meaning |
|-------|-------|---------|
| 9-10 | Ready | Upgrade with confidence, minimal changes needed |
| 7-8 | Low Risk | Minor adjustments required, safe to proceed |
| 5-6 | Moderate Risk | Several changes needed, plan a migration sprint |
| 3-4 | High Risk | Significant rework required, thorough testing needed |
| 1-2 | Critical Risk | Major incompatibilities, consider phased migration |
| 0 | Blocked | Cannot upgrade without fundamental changes |

## Weighted Score Calculation

```
overall_score = sum(dimension_score * weight for each dimension)
```

## Per-Dimension Scoring Thresholds

Score each dimension 0-10 based on Phase 3 findings:

**Model Compatibility (weight: 0.25)**
- 10: No hardcoded model IDs, no capability assumptions
- 8: Documentation-only model references (non-functional)
- 6: 1-3 hardcoded model IDs in functional code
- 4: Output token limits or context window hardcoded
- 2: Model-specific API patterns (e.g., prefilling for Claude, function calling format)
- 0: Core logic depends on model-specific behavior

**Hook Compatibility (weight: 0.20)**
- 10: All hooks use current event types and async patterns
- 8: Minor deprecation warnings, no functional impact
- 6: 1-3 hooks use deprecated event types
- 4: Hook input/output schema changed
- 2: Hook lifecycle order changed
- 0: Hook system replaced or fundamentally restructured

**Skill Coverage (weight: 0.15)**
- 10: All skills use current frontmatter format, no stale references
- 8: Minor version references outdated in skill content
- 6: 1-5 skills reference deprecated features or removed capabilities
- 4: Skill frontmatter schema changed (new required fields)
- 2: Skill loading mechanism changed
- 0: Skill format incompatible

**Agent Readiness (weight: 0.15)**
- 10: All agents use valid model aliases, tools, and frontmatter
- 8: 1-2 agents reference removed tools or deprecated fields
- 6: Agent model field values changed meaning
- 4: Agent frontmatter schema requires migration
- 2: Agent tool availability significantly changed
- 0: Agent system incompatible

**Memory Architecture (weight: 0.10)**
- 10: Memory tiers unchanged, storage format stable
- 8: New optional memory tier available
- 6: Memory storage format changed (migration available)
- 4: Memory tier behavior changed (e.g., scope semantics)
- 2: Memory migration required with data transformation
- 0: Memory system replaced

**CI/CD Pipeline (weight: 0.15)**
- 10: All tests pass, build system unchanged
- 8: Minor test assertion updates needed
- 6: Test framework or runner version update needed
- 4: Build configuration changes required
- 2: CI pipeline restructure needed
- 0: Build system incompatible
