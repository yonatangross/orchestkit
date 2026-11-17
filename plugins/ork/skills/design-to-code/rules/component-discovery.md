---
title: Component Discovery via Storybook MCP
impact: HIGH
impactDescription: Prevents redundant component generation by checking existing library first (12.8% improved reuse)
tags: [storybook-mcp, component-discovery, reuse, docs-toolset]
---

# Component Discovery via Storybook MCP

Before generating a new component, check the project's Storybook for existing components that match.

## Pattern: Storybook-First Matching

```python
# Step 1: Get full component inventory
inventory = list-all-documentation()
# Returns: component IDs, doc IDs, story counts

# Step 2: Search for matching component
for component in inventory.components:
    if component.name matches target_description:
        details = get-documentation(id=component.id)
        # Returns: props schema, first 3 stories, story index, additional docs

# Step 3: Decision
if match_found:
    # Reuse existing component — adapt props, skip generation
    return existing_component
else:
    # No local match — fall back to 21st.dev or generate from scratch
    search_21st_dev(description)
```

## Incorrect

```typescript
// BAD: Generating a new Button component without checking Storybook
// The project may already have a fully-tested Button with variants
const Button = ({ label, onClick }) => (
  <button onClick={onClick}>{label}</button>
);
```

## Correct

```python
# GOOD: Check Storybook first
inventory = list-all-documentation()
# Found: Button component with 12 stories, 8 variants
details = get-documentation(id="button")
# Props: variant (primary|secondary|ghost), size (sm|md|lg), disabled, loading
# → Reuse existing Button, no generation needed
```

## When to Skip

- Project has no Storybook MCP configured
- Building a component explicitly marked as "new" by the user
- The existing component is fundamentally incompatible with requirements
