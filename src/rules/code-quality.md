---
title: Code Quality Thresholds
impact: MEDIUM
---

# Code Quality Thresholds

## Function Length

Keep functions under **50 lines**. If a function exceeds this:
- Extract helper functions for distinct logical blocks
- Consider if the function has too many responsibilities

## Nesting Depth

Keep nesting to **4 levels maximum** (indentation levels). Deep nesting indicates:
- Complex conditional logic that should be simplified
- Opportunities for early returns or guard clauses
- Logic that could be extracted into separate functions

## Cyclomatic Complexity

Aim for **10 or fewer conditionals per function**. High conditional counts suggest:
- The function handles too many cases
- A strategy or dispatch pattern may be more appropriate
- Some branches could be extracted into separate functions
