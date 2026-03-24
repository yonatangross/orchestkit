---
title: "Prop Constraints for AI Safety"
impact: "HIGH"
impactDescription: "Unconstrained props let AI hallucinate arbitrary values — unbounded strings, massive arrays, invalid enum values — causing broken layouts and security issues"
tags: [json-render, zod, props, constraints, ai-safety, validation]
---

## Prop Constraints for AI Safety

Catalog props are the primary defense against AI hallucination. Every prop should be as tightly constrained as possible — bounded strings, explicit enums, capped arrays. The tighter the constraints, the more predictable and safe the AI output.

**Incorrect:**
```typescript
// z.any() defeats the entire purpose of the catalog
BadComponent: {
  props: z.object({
    data: z.any(),                    // AI can put anything here
    items: z.array(z.unknown()),      // Unbounded, untyped list
    color: z.string(),                // AI hallucinates hex codes, CSS names, anything
    content: z.string(),              // No length limit — AI can generate 10K chars
    config: z.record(z.any()),        // Open-ended object
  }),
  children: true,
},
```

**Correct:**
```typescript
GoodComponent: {
  props: z.object({
    // z.enum bounds choices to known-safe values
    variant: z.enum(['primary', 'secondary', 'destructive']),
    size: z.enum(['sm', 'md', 'lg']),
    status: z.enum(['active', 'inactive', 'pending']),

    // z.string().max() prevents unbounded text
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),

    // z.array().max() caps list length to prevent layout overflow
    items: z.array(z.object({
      label: z.string().max(50),
      value: z.string().max(100),
    })).min(1).max(20),

    // z.number() with range for numeric props
    columns: z.number().int().min(1).max(6),
    progress: z.number().min(0).max(100),

    // z.boolean() with default for optional flags
    disabled: z.boolean().default(false),
    loading: z.boolean().default(false),
  }),
  children: false,
},
```

### Constraint Patterns by Prop Type

| Prop Type | Weak (avoid) | Strong (use) |
|-----------|-------------|--------------|
| Text content | `z.string()` | `z.string().min(1).max(200)` |
| Color/variant | `z.string()` | `z.enum(['primary', 'secondary'])` |
| List items | `z.array(z.any())` | `z.array(schema).min(1).max(20)` |
| Numeric | `z.number()` | `z.number().int().min(0).max(100)` |
| Boolean flags | (no constraint) | `z.boolean().default(false)` |
| Freeform object | `z.record(z.any())` | `z.object({ specific: z.string() })` |
| URL/image | `z.string()` | `z.string().url().max(2048)` |

### Refinements for Complex Validation

```typescript
DateRange: {
  props: z.object({
    start: z.string().date(),
    end: z.string().date(),
  }).refine(
    (data) => new Date(data.end) > new Date(data.start),
    { message: 'end must be after start' }
  ),
  children: false,
},
```

**Key rules:**
- Never use `z.any()`, `z.unknown()`, or bare `z.record()` in catalog props — these bypass AI safety
- Always set `.max()` on strings and arrays to prevent unbounded generation
- Use `z.enum()` instead of `z.string()` whenever possible — enums constrain AI to valid values
- Add `.default()` to optional boolean and enum props — prevents undefined gaps in rendered output
- Use `.refine()` for cross-field validation (date ranges, conditional requirements)
- Test constraints by checking: "Can AI generate a value that would break my UI?" If yes, tighten the schema

Reference: https://zod.dev
