# Scale Questions

## Purpose

Scale questions prevent building features that work for 10 users but break at 10,000.

## Question Framework

### Volume Questions

```
┌─────────────────────────────────────────────────────────────┐
│  SCALE ASSESSMENT                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │   USERS     │   │    DATA     │   │  REQUESTS   │       │
│  └─────┬───────┘   └──────┬──────┘   └──────┬──────┘       │
│        │                  │                  │              │
│  How many?          How much?          How often?           │
│  Concurrent?        Per user?          Read vs write?       │
│  Growth rate?       Total?             Peak times?          │
│        │                  │                  │              │
│        └──────────────────┼──────────────────┘              │
│                           │                                 │
│                           ▼                                 │
│                   ┌───────────────┐                        │
│                   │   CAPACITY    │                        │
│                   │   PLANNING    │                        │
│                   └───────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Core Questions

| Question | Why Ask | Example Answer |
|----------|---------|----------------|
| How many users will use this? | DB index strategy | 1,000 active users |
| What's the data volume per user? | Storage planning | 50 docs/user |
| What's the total expected data? | Shard planning | 50K → 500K docs |
| Is it read-heavy or write-heavy? | Cache strategy | 10:1 read:write |
| What's the request rate? | Rate limiting | 100 req/sec peak |
| What's the growth projection? | Future-proofing | 3x/year |

### Growth Projections

```
QUESTION: At 10x scale, does this still work?

Current:    1,000 users, 50K documents
10x:        10,000 users, 500K documents
100x:       100,000 users, 5M documents

Check:
□ Can the DB handle this query pattern at 100x?
□ Does the algorithm scale linearly or exponentially?
□ What's the memory footprint at 100x?
□ Does the response time stay acceptable?
```

## SkillForge Scale Considerations

### Current Baseline

| Resource | Current | 10x Target |
|----------|---------|------------|
| Active Users | 1,000 | 10,000 |
| Documents | 50,000 | 500,000 |
| Analyses/month | 5,000 | 50,000 |
| Vector searches/day | 10,000 | 100,000 |
| LLM calls/day | 2,000 | 20,000 |

### Feature-Specific Questions

**For Search Features:**
- How many documents will be searched?
- Is real-time indexing required?
- What's acceptable search latency? (<100ms? <500ms?)
- Can results be cached? For how long?

**For LLM Features:**
- What's the token budget per request?
- What's the acceptable latency? (streaming vs batch)
- Can responses be cached?
- What's the cost at 10x scale?

**For Data Processing:**
- Batch or real-time?
- What's the processing time per item?
- Can it be parallelized?
- What's the failure/retry strategy?

## Red Flags

```
⚠️ "It works fine in development"
   → Development has 100 records. Production has 100,000.

⚠️ "We'll optimize later"
   → Fundamental design issues can't be optimized away.

⚠️ "Users won't create that much data"
   → Power users ALWAYS create more than expected.

⚠️ "The database can handle it"
   → Without indexes and proper queries, it can't.

⚠️ "We can add caching"
   → Caching doesn't fix O(n²) algorithms.
```

## Decision Framework

### When to Optimize Now

- [ ] Feature touches hot path (every request)
- [ ] Data grows with user activity (not just user count)
- [ ] Algorithm complexity is O(n²) or worse
- [ ] External API call per item (LLM, third-party)

### When to Defer

- [ ] Feature is rarely used (<1% of requests)
- [ ] Data is bounded (e.g., settings, not user content)
- [ ] Simple optimization is obvious and easy
- [ ] No external dependencies in loop

## Example Assessment

```markdown
## Feature: Full-text search on analyses

### Scale Assessment

**Current state:**
- 5,000 analyses total
- 50 searches/day
- Simple LIKE query on title

**At 10x:**
- 50,000 analyses
- 500 searches/day
- LIKE query becomes slow (no index used)

**Decision:**
- Add PostgreSQL full-text search with GIN index
- ts_vector column on analyses table
- Index on (tenant_id, search_vector)
- Cache frequent searches (5 min TTL)

**Why now:**
- Full-text search is core feature
- LIKE won't scale past 10K records
- Retrofitting search is expensive
```
