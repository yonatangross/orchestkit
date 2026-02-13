---
title: Complexity Scoring Frameworks
impact: HIGH
impactDescription: "Starting complex tasks without assessment leads to scope creep and blocked work — effort estimates miss by 3-5x"
tags: complexity, scoring, metrics, assessment, estimation, criteria
---

## Complexity Scoring Frameworks

Score task complexity across 7 criteria (1-5 each) to determine if a task should proceed or be decomposed first.

### The 7 Criteria

| Criterion | 1 (Low) | 3 (Medium) | 5 (High) |
|-----------|---------|------------|----------|
| Lines of Code | < 50 | 200-500 | 1500+ |
| Time Estimate | < 30 min | 2-8 hours | 24+ hours |
| Files Affected | 1 file | 4-10 files | 26+ files |
| Dependencies | 0 deps | 2-3 deps | 7+ deps |
| Unknowns | None | Several, researchable | Unclear scope |
| Cross-Cutting | Single module | 4-5 modules | System-wide |
| Risk Level | Trivial | Testable complexity | Mission-critical |

### Complexity Levels

| Average Score | Level | Classification | Action |
|---------------|-------|----------------|--------|
| 1.0 - 1.4 | 1 | Trivial | Proceed immediately |
| 1.5 - 2.4 | 2 | Simple | Proceed |
| 2.5 - 3.4 | 3 | Moderate | Proceed with caution |
| 3.5 - 4.4 | 4 | Complex | Break down first |
| 4.5 - 5.0 | 5 | Very Complex | Decompose and reassess |

### Output Format

```markdown
## Complexity Assessment: [Target]

| Criterion | Score |
|-----------|-------|
| Lines of Code | X/5 |
| Time Estimate | X/5 |
| Files Affected | X/5 |
| Dependencies | X/5 |
| Unknowns | X/5 |
| Cross-Cutting | X/5 |
| Risk Level | X/5 |
| **Total** | **XX/35** |

**Average Score:** X.X
**Complexity Level:** X ([Classification])
**Can Proceed:** Yes/No
```

### Key Rules

- Score **all 7 criteria** even for seemingly simple tasks
- Total of **35 points** maximum, divide by 7 for average
- Level 4-5 tasks **must be decomposed** before starting implementation
- Unknowns (criterion 5) is the **highest variance** factor — resolve unknowns first
- Cross-cutting (criterion 6) indicates **coordination overhead** — account for it in estimates
