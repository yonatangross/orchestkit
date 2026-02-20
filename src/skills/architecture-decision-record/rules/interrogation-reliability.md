---
title: Interrogate architecture decisions for failure modes, data patterns, and reliability risks
impact: HIGH
impactDescription: "Ignoring failure modes and data patterns leads to brittle systems — production incidents from unhandled edge cases"
tags: reliability, data, ux, coherence, failure-modes, architecture, interrogation
---

## Reliability Interrogation

Questions covering data architecture, UX impact, and system coherence. Ensures decisions account for production failure modes.

### Data Questions

| Question | Red Flag Answer |
|----------|-----------------|
| Where does this data naturally belong? | "I'll figure it out" |
| What's the primary access pattern? | "Both reads and writes" (too vague) |
| Is it master data or transactional? | No distinction made |
| What's the retention policy? | "Keep everything" |
| Does it need to be searchable? How? | "We'll add search later" |

### UX Impact Questions

| Question | Red Flag Answer |
|----------|-----------------|
| What's the expected latency? | "It'll be fast" |
| What feedback does the user get during operation? | "A spinner" |
| What happens on failure? Can they retry? | "Show an error" |
| Is optimistic UI possible? | Not considered |

### Coherence Questions

| Question | Red Flag Answer |
|----------|-----------------|
| Which layers does this touch? | "Just the backend" |
| What contracts/interfaces change? | "No changes needed" |
| Are types consistent frontend to backend? | Not checked |
| Does this break existing clients? | "Shouldn't" |

### Assessment Template

```markdown
### Reliability Assessment for: [Feature/Decision]

**Data:**
- Storage location: [DB table / cache / file]
- Schema changes: [migration needed?]
- Access pattern: [by ID / by query / full scan]
- Retention: [days/months/forever]

**UX:**
- Target latency: [< Nms]
- Feedback: [optimistic / spinner / progress]
- Error handling: [retry / rollback / degrade]

**Coherence:**
- Affected layers: [DB, API, frontend, state]
- Type changes: [new types / modified types]
- API changes: [new endpoints / modified responses]
- Breaking changes: [yes / no — if yes, migration plan]
```

### Anti-Patterns

| Anti-Pattern | Better Approach |
|-------------|-----------------|
| "I'll add an index later" | Ask: what's the query pattern NOW? |
| "The frontend can handle any shape" | Ask: what's the TypeScript type? |
| "Users won't do that" | Ask: what if they DO? |
| "It's just a small feature" | Ask: how does this grow with 100x users? |

**Incorrect — vague answers, missing failure modes:**
```markdown
### Reliability Assessment for: User Tagging

**Data:**
- Storage location: Database
- Access pattern: Fast
- Retention: Keep everything

**UX:**
- Target latency: Should be quick
- Feedback: A spinner
- Error handling: Show an error

**Coherence:**
- Affected layers: Backend
- API changes: Maybe some
```

**Correct — specific answers with failure handling:**
```markdown
### Reliability Assessment for: User Tagging

**Data:**
- Storage location: tags table with user_id FK + GIN index on tag names
- Schema changes: New tags table, migration #47
- Access pattern: Read-heavy (10:1) by user_id + autocomplete by tag prefix
- Retention: 90 days for deleted tags (soft delete)

**UX:**
- Target latency: < 200ms for tag autocomplete
- Feedback: Optimistic update + rollback on error
- Error handling: Retry 2x with exponential backoff, then show "Failed to save tag. Retry?"

**Coherence:**
- Affected layers: DB (new table), API (2 new endpoints), frontend (Tag component)
- Type changes: New Tag type in shared/types.ts
- API changes: GET /tags?prefix=, POST /tags
- Breaking changes: No (new feature)
```

### Key Rules

- Data decisions are **hard to change** — get storage right from the start
- Define **target latency** before choosing implementation approach
- Every API change needs a **type check** across the full stack
- Failure handling must be **designed**, not discovered in production
- Breaking changes require a **migration plan** before implementation
