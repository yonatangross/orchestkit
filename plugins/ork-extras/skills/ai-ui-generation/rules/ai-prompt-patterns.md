---
title: "AI Prompt Patterns for UI Generation"
impact: "HIGH"
impactDescription: "Vague prompts produce inconsistent, non-accessible components with hardcoded values that require extensive rework"
tags: [prompt-engineering, v0, bolt, cursor, component-generation, constraints]
---

## AI Prompt Patterns for UI Generation

Structure every AI UI prompt with explicit constraints: framework, design tokens, accessibility requirements, and expected states. Constraint-first prompts reduce rework by 60-80% compared to freeform requests.

**Incorrect:**
```
Make me a nice signup form with email and password fields.
```

This produces:
- Arbitrary colors and spacing (not from your design system)
- Missing ARIA labels and error announcements
- No loading, error, or success states
- Inconsistent with existing codebase patterns

**Correct:**
```
Generate a signup form component:

Framework: React 19 + TypeScript strict mode
Styling: Tailwind CSS v4 + shadcn/ui primitives (Button, Input, Label, Card)
shadcn style: Luma (rounded-4xl buttons/cards, shadow-md elevation, gap-6 spacing)
  — or read from components.json → "style" field for project-specific style
Design tokens:
  - Colors: use oklch(var(--color-primary)), oklch(var(--color-destructive))
  - Spacing: gap-4 for form fields, p-6 for card padding
  - Typography: text-sm for labels, text-base for inputs
Accessibility:
  - <label> elements linked to inputs via htmlFor
  - aria-describedby on inputs pointing to error messages
  - aria-live="polite" region for form-level errors
  - Focus visible ring on all interactive elements
States: default, loading (submit disabled + Loader2 spinner),
        field-error (inline per-field), form-error (top banner), success
Validation: zod schema, react-hook-form integration
Responsive: single column always, max-w-md centered
```

### Prompt Structure Template

```
Generate a [component type] component:

Framework: [React/Next.js version] + TypeScript
Styling: [Tailwind version] + [UI library] + [shadcn style: Luma/Vega/Nova/etc.]
Design tokens: [list token names and where to use them]
Accessibility: [specific ARIA patterns needed]
States: [enumerate all states]
Responsive: [breakpoint behavior]
Integration: [form library, state management, API calls]
```

**Key rules:**
- Always specify the UI library AND shadcn style (e.g., "shadcn/ui Luma style") — AI tools default to raw HTML and generic classes otherwise
- List design token variable names explicitly — AI cannot infer your token system
- Enumerate every state the component must handle — AI skips states you do not mention
- Include responsive breakpoints — AI defaults to desktop-only layouts
- Specify TypeScript strictness — AI generates `any` types without explicit instruction

Reference: https://v0.dev/docs
