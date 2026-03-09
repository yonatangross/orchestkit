---
title: "Iterative Prompt Patterns for Complex UI States"
impact: "MEDIUM"
impactDescription: "Single-pass prompts for multi-state components produce incomplete state coverage — missing loading, error, and edge case handling"
tags: [prompt-iteration, states, loading, error, empty-state, multi-pass, ai-prompt]
---

## Iterative Prompt Patterns for Complex UI States

Complex interactive components require 2-3 prompt passes. A single prompt cannot reliably produce all states (default, loading, error, empty, success, disabled) with correct transitions between them.

**Incorrect:**
```
# Single prompt for everything — AI drops states, mixes concerns
"Generate a data table with sorting, filtering, pagination,
 loading states, error handling, empty states, bulk selection,
 row actions, column resizing, and keyboard navigation"
```

Result: AI generates the happy path (data visible, sorted) but produces broken loading spinners, missing error boundaries, and no empty state.

**Correct — 3-Pass Approach:**

### Pass 1: Structure and Happy Path
```
Generate a DataTable component:
- Framework: React 19 + TypeScript
- Library: @tanstack/react-table v8
- Features: sorting (multi-column), filtering (column + global), pagination
- Styling: Tailwind + shadcn/ui Table primitives
- Props: data: T[], columns: ColumnDef<T>[]
- DO NOT handle loading/error yet — happy path only
```

### Pass 2: Interactive States
```
Extend the DataTable from Pass 1. Add these states:
- Loading: skeleton rows (5 rows), disabled sort/filter controls
- Error: error banner with retry button, table hidden
- Empty: illustration + "No results" message + clear filters CTA
- Partial loading: pagination shows spinner, existing data stays visible
Keep the happy path code unchanged.
```

### Pass 3: Advanced Interactions
```
Add to the DataTable:
- Bulk selection: checkbox column, "Select all" header, selected count banner
- Row actions: dropdown menu (Edit, Delete, Duplicate) per row
- Keyboard: Arrow keys between rows, Enter to expand, Escape to deselect
- Focus management: focus returns to trigger after action menu closes
```

### State Transition Map

Define state transitions before prompting to ensure completeness:

```
idle → loading → success (show data)
                → error (show error + retry)
                → empty (show empty state)

success → loading (pagination/sort change) → success | error
error → loading (retry clicked) → success | error
```

### When to Use Multi-Pass

| Component Complexity | Passes | Example |
|---------------------|--------|---------|
| Static display | 1 | Card, badge, avatar |
| Single interaction | 1-2 | Button with loading, toggle |
| Form with validation | 2 | Signup form, settings panel |
| Data-driven with states | 3 | Data table, dashboard, kanban |
| Full page with routing | 3+ | Dashboard page, wizard flow |

**Key rules:**
- Use single-pass only for static or single-interaction components
- Always separate structure (Pass 1) from states (Pass 2) from advanced interactions (Pass 3)
- Define the state transition map before writing any prompt
- Tell the AI to "keep existing code unchanged" in follow-up passes — prevents regression
- Review each pass output before proceeding to the next — errors compound across passes

Reference: https://tanstack.com/table/latest
