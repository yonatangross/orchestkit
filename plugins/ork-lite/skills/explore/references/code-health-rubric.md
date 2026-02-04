# Code Health Rubric

Standardized 0-10 scoring criteria for assessing code quality across five dimensions.

## Scoring Scale

| Score | Rating | Description |
|-------|--------|-------------|
| 9-10 | Excellent | Production-ready, exemplary code |
| 7-8 | Good | Minor improvements possible |
| 5-6 | Adequate | Functional but needs attention |
| 3-4 | Poor | Significant issues, refactor recommended |
| 0-2 | Critical | Major problems, immediate action required |

---

## 1. Readability (0-10)

| Score | Criteria |
|-------|----------|
| 10 | Self-documenting, intuitive naming, perfect structure |
| 7-8 | Clear names, logical flow, minimal cognitive load |
| 5-6 | Understandable with effort, some unclear sections |
| 3-4 | Confusing logic, poor naming, requires context |
| 0-2 | Incomprehensible, magic numbers, no conventions |

## 2. Maintainability (0-10)

| Score | Criteria |
|-------|----------|
| 10 | SRP adherence, loose coupling, DRY, easy to modify |
| 7-8 | Good separation, minor duplication, clear boundaries |
| 5-6 | Some coupling, moderate duplication, changes ripple |
| 3-4 | High coupling, significant duplication, fragile |
| 0-2 | Spaghetti code, any change breaks multiple areas |

## 3. Testability (0-10)

| Score | Criteria |
|-------|----------|
| 10 | Pure functions, DI, 90%+ coverage, mocks easy |
| 7-8 | Most logic testable, some DI, 70%+ coverage |
| 5-6 | Testable with effort, some hidden dependencies |
| 3-4 | Hard to isolate, global state, 30% coverage |
| 0-2 | Untestable, tightly coupled, no test infrastructure |

## 4. Complexity (0-10, inverted: 10=simple)

| Score | Criteria |
|-------|----------|
| 10 | Cyclomatic <5, max 2 nesting, <20 line functions |
| 7-8 | Cyclomatic 5-10, 3 nesting, <40 line functions |
| 5-6 | Cyclomatic 10-15, 4 nesting, some long functions |
| 3-4 | Cyclomatic 15-25, deep nesting, 100+ line functions |
| 0-2 | Cyclomatic >25, 6+ nesting, god functions |

## 5. Documentation (0-10)

| Score | Criteria |
|-------|----------|
| 10 | Complete API docs, examples, architecture notes |
| 7-8 | Public API documented, inline comments where needed |
| 5-6 | Some docstrings, missing edge cases |
| 3-4 | Sparse comments, outdated documentation |
| 0-2 | No documentation, misleading comments |

---

## Overall Score Calculation

```
overall = (readability + maintainability + testability + complexity + documentation) / 5
```

**Score Interpretation:**
- **8.0+**: Ship it
- **6.0-7.9**: Acceptable, plan improvements
- **4.0-5.9**: Technical debt, prioritize refactoring
- **<4.0**: Stop and fix before proceeding
