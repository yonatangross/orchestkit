---
title: Scope test runs to changed code only
impact: HIGH
impactDescription: "Testing unscoped pages wastes time and produces noise — only test pages affected by the diff"
tags: diff, scope, routing, targeting
---

## Diff Scope Boundaries

Only test pages that are connected to the changed files via the 3-level classification.

**Incorrect — testing all pages regardless of diff:**
```python
# Wrong: testing entire site when only Button.tsx changed
pages_to_test = ["/", "/about", "/pricing", "/dashboard", "/settings", "/login"]
```

**Correct — scoped to affected routes:**
```python
# Right: only test pages that render the changed component
changed = ["src/components/Button.tsx"]
direct = changed                                    # Level 1
imported = find_importers("Button", "src/")         # Level 2
routed = route_map.resolve(direct + imported)       # Level 3
pages_to_test = routed  # ["/", "/dashboard"] — only pages using Button
```

**Key rules:**
- Always run diff scan before route mapping — never assume scope
- If route map is empty (no `.expect/config.yaml`, no framework detected), test only `base_url` root
- Log which level triggered each page test for debugging
- Respect `ignore_patterns` from config — skip test files, docs, lockfiles
