---
title: Product Perspective
impact: MEDIUM
impactDescription: "Adds business context and findability analysis to technical exploration"
tags: product, perspective, assessment
---

# Product Perspective

Add business context and findability suggestions. See [findability-patterns.md](../references/findability-patterns.md) for discoverability best practices.

```python
Task(
  subagent_type="product-strategist",
  prompt="""PRODUCT PERSPECTIVE for: $ARGUMENTS

  Analyze from a product/business viewpoint:

  1. BUSINESS CONTEXT
     - What user problem does this code solve?
     - What feature/capability does it enable?
     - Who are the users of this code?

  2. FINDABILITY SUGGESTIONS
     - Better naming for discoverability?
     - Missing documentation entry points?
     - Where should someone look first?

  3. KNOWLEDGE GAPS
     - What context is missing for new developers?
     - What tribal knowledge exists?
     - What should be documented?

  4. SEARCH OPTIMIZATION
     - Keywords someone might use to find this
     - Alternative terms for the same concept
     - Related concepts to cross-reference

  Output:
  {
    "business_purpose": "description",
    "primary_users": ["user type"],
    "findability_issues": ["issue - suggestion"],
    "recommended_entry_points": ["file - why start here"],
    "search_keywords": ["keyword"],
    "documentation_gaps": ["gap"]
  }

  SUMMARY: End with: "FINDABILITY: [N] issues - start at [recommended entry point]"
  """,
  run_in_background=True,
  max_turns=25
)
```
