# Exploration Report Template

Use this template for Phase 8 report generation.

```markdown
# Exploration Report: $ARGUMENTS

## Quick Answer
[1-2 sentence summary]

## File Locations
| File | Purpose | Health Score |
|------|---------|--------------|
| `path/to/file.py` | [description] | [N.N/10] |

## Code Health Summary
| Dimension | Score | Notes |
|-----------|-------|-------|
| Readability | [N/10] | [note] |
| Maintainability | [N/10] | [note] |
| Testability | [N/10] | [note] |
| Complexity | [N/10] | [note] |
| Documentation | [N/10] | [note] |
| **Overall** | **[N.N/10]** | |

## Architecture Overview
[ASCII diagram]

## Dependency Hotspot Map
```
[Incoming deps] → [TARGET] → [Outgoing deps]
```
- **Coupling Score:** [N/10]
- **Fan-in:** [N] files depend on this
- **Fan-out:** [M] dependencies
- **Circular Dependencies:** [list or "None"]

## Data Flow
1. [Entry] → 2. [Processing] → 3. [Storage]

## Findability & Entry Points
| Entry Point | Why Start Here |
|-------------|----------------|
| `path/to/file.py` | [reason] |

**Search Keywords:** [keyword1], [keyword2], [keyword3]

## Product Context
- **Business Purpose:** [what problem this solves]
- **Primary Users:** [who uses this]
- **Documentation Gaps:** [what's missing]

## How to Modify
1. [Step 1]
2. [Step 2]

## Recommendations
1. [Health improvement]
2. [Findability improvement]
3. [Documentation improvement]
```
