---
title: Scalability Interrogation
impact: HIGH
impactDescription: "Skipping scale questions leads to architectures that break under load — discovering limits in production is expensive"
tags: scalability, scale, load, growth, capacity, architecture, interrogation
---

## Scalability Interrogation

Ask these questions before committing to any architectural decision. Prevents costly rework from underestimating scale.

### Core Scale Questions

| Question | Red Flag Answer |
|----------|-----------------|
| How many users/tenants will use this? | "All users" |
| What's the expected data volume (now and in 1 year)? | "I'll figure it out" |
| What's the request rate? Read-heavy or write-heavy? | "It'll be fast" |
| Does complexity grow linearly or exponentially? | "It won't be a problem" |
| What happens at 10x current load? 100x? | No answer |

### Assessment Template

```markdown
### Scale Assessment for: [Feature/Decision]

- **Users:** [number] active users
- **Data volume now:** [size/count]
- **Data volume in 1 year:** [projected size/count]
- **Access pattern:** Read-heavy / Write-heavy / Mixed (ratio: N:1)
- **Growth rate:** Linear / Exponential / Bounded
- **10x scenario:** [What breaks at 10x?]
- **100x scenario:** [What breaks at 100x?]
```

### Example Assessment

```markdown
### Scale Assessment for: Document Tagging

- **Users:** 1,000 active users
- **Data volume now:** 50,000 documents, ~200K tags
- **Data volume in 1 year:** 500,000 documents, ~2M tags
- **Access pattern:** Read-heavy (10:1 read:write)
- **Growth rate:** Linear with user growth
- **10x scenario:** Tag autocomplete needs index, current LIKE query won't scale
- **100x scenario:** Need dedicated search (Elasticsearch) for tag filtering
```

**Incorrect — vague answers, no scale projection:**
```markdown
### Scale Assessment for: Document Tagging

- **Users:** All users
- **Data volume now:** A lot
- **Data volume in 1 year:** More
- **Access pattern:** Fast
- **Growth rate:** It'll grow
- **10x scenario:** Should be fine
- **100x scenario:** We'll deal with it later
```

**Correct — specific numbers with breakpoint analysis:**
```markdown
### Scale Assessment for: Document Tagging

- **Users:** 1,000 active users
- **Data volume now:** 50,000 documents, ~200K tags
- **Data volume in 1 year:** 500,000 documents, ~2M tags
- **Access pattern:** Read-heavy (10:1 read:write)
- **Growth rate:** Linear with user growth
- **10x scenario:** Tag autocomplete LIKE query breaks (>500ms). Need GIN index on tag names.
- **100x scenario:** 20M tags requires dedicated search (Elasticsearch/Typesense) for sub-100ms autocomplete.
```

### Key Rules

- Answer **every** question with specifics — vague answers indicate insufficient analysis
- Project growth to **1 year minimum** before deciding on storage and indexing
- Identify the **10x breakpoint** — what component fails first under 10x load
- Read/write ratio determines **caching strategy** and **consistency model**
- Exponential growth requires **fundamentally different architecture** than linear
