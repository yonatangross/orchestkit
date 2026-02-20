---
title: Decompose complex tasks into isolated subtasks to reduce failure risk and enable parallelism
impact: HIGH
impactDescription: "Complex tasks attempted without decomposition fail 60% more often — subtask isolation reduces risk and enables parallel work"
tags: complexity, decomposition, breakdown, subtasks, planning, risk
---

## Task Decomposition Strategies

When a task scores Level 4-5 (Complex/Very Complex), decompose it into subtasks that each score Level 1-3.

### Decomposition Approach

1. **Identify independent axes** — separate concerns that can be worked on independently
2. **Isolate unknowns** — create a spike/research task for each unknown
3. **Reduce cross-cutting scope** — break into single-module changes
4. **Sequence by dependency** — order subtasks so blocked items come last

### Strategies by Complexity Driver

| High Criterion | Decomposition Strategy |
|---------------|----------------------|
| Lines of Code (4-5) | Split by component or layer |
| Files Affected (4-5) | Split by directory or module |
| Dependencies (4-5) | Isolate external integrations into adapter tasks |
| Unknowns (4-5) | Create spike tasks to resolve unknowns first |
| Cross-Cutting (4-5) | Split by layer (DB, API, UI) or by concern |
| Risk Level (4-5) | Add validation/testing tasks before implementation |

### Codebase Analysis for Decomposition

```bash
# Gather metrics to inform breakdown
./scripts/analyze-codebase.sh "$TARGET"

# Key signals:
# - File count > 10: split by directory
# - Import count > 5: isolate dependency interfaces
# - Test coverage < 50%: add test-first subtask
```

### Subtask Validation

Each subtask should score:
- **Average: 1.0-3.4** (Level 1-3) — manageable
- **Unknowns: <= 2** — no major research needed
- **Cross-cutting: <= 2** — limited to 2-3 modules

If any subtask still scores Level 4+, decompose it again.

### Risk Assessment Integration

| Risk Factor | Mitigation Task |
|-------------|-----------------|
| No test coverage | Add regression tests first |
| Complex business logic | Write specification/invariant tests |
| External API dependency | Create mock/adapter layer first |
| Database migration | Test migration on staging first |
| Multiple team coordination | Define interface contracts first |

### Key Rules

- Level 4-5 tasks are **never directly implemented** — decompose first
- Every subtask must score **Level 3 or below** individually
- Resolve **unknowns** before starting dependent implementation tasks
- Use **`TaskCreate` with `addBlockedBy`** to enforce subtask ordering
- Each subtask should be **independently verifiable** with its own tests
- Prefer **vertical slices** (end-to-end for one feature) over horizontal layers

**Incorrect — Starting Level 5 task without decomposition:**
```
Task: "Migrate authentication to OAuth2"
Complexity: 4.8 (Level 5)
Action: Start implementing directly
// High failure risk, scope creep likely
```

**Correct — Breaking into Level 1-3 subtasks:**
```
1. Research OAuth2 providers (Level 2, 1-2h)
2. Add OAuth library dependency (Level 1, 30m)
3. Implement OAuth callback handler (Level 2, 2-4h)
4. Migrate existing sessions (Level 3, 4-8h)
5. Add regression tests (Level 2, 2h)
```
