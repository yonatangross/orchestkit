# Before Implementation Checklist

## Quick Assessment (5 min)

Before writing any code, answer these questions:

### 1. Scale (1 min)
- [ ] How many users? ___
- [ ] How much data? ___
- [ ] Read or write heavy? ___
- [ ] Will it scale 10x? ___

### 2. Data (1 min)
- [ ] Where does data live? ___
- [ ] What's the access pattern? ___
- [ ] Need search capability? ___
- [ ] Schema changes needed? ___

### 3. Security (1 min)
- [ ] Who can access? ___
- [ ] Tenant isolation how? ___
- [ ] Attack vectors? ___
- [ ] PII involved? ___

### 4. UX (1 min)
- [ ] Expected latency? ___
- [ ] Loading state? ___
- [ ] Error handling? ___
- [ ] Optimistic updates? ___

### 5. Coherence (1 min)
- [ ] Types defined all layers? ___
- [ ] API contract clear? ___
- [ ] Breaking changes? ___
- [ ] Migration needed? ___

---

## Detailed Assessment (15 min)

### Scale Deep Dive

```
Current baseline:
- Users: ___
- Data per user: ___
- Total data: ___
- Requests/day: ___

At 10x:
- Can the query handle it? [ ]
- Is there an index for this? [ ]
- What's the memory footprint? [ ]
- What breaks first? ___
```

### Data Design

```
Data model:
- Entity name: ___
- Belongs to: ___
- Related to: ___
- Access pattern: ___

Storage decision:
[ ] Same table (denormalize)
[ ] New table (normalize)
[ ] JSON field (flexible)
[ ] Vector column (embeddings)

Search requirements:
[ ] None
[ ] Full-text
[ ] Vector similarity
[ ] Filter/sort
```

### Security Design

```
Authorization:
- Who: ___
- What action: ___
- On what resource: ___
- Enforced where: ___

Tenant isolation:
[ ] Query has tenant_id filter
[ ] tenant_id from JWT, not request
[ ] Test exists for cross-tenant

Attack surface:
[ ] Input validated
[ ] Output sanitized
[ ] Error messages safe
[ ] Rate limited
```

### UX Design

```
User flow:
1. User clicks ___
2. UI shows ___
3. Request takes ___ms
4. Response shows ___

States:
[ ] Loading
[ ] Success
[ ] Error
[ ] Empty
[ ] Partial (paginated)

Optimistic updates:
[ ] Not applicable
[ ] Update immediately, rollback on error
[ ] Show pending state
```

### Coherence Check

```
Layers affected:
[ ] Database (migration)
[ ] Backend model (SQLAlchemy)
[ ] API schema (Pydantic)
[ ] Frontend types (TypeScript)
[ ] UI components (React)
[ ] Tests (all layers)

Contract:
- Endpoint: ___
- Method: ___
- Request body: ___
- Response: ___
- Error codes: ___
```

---

## Decision Documentation

```markdown
## Feature: [Name]

### Summary
[One sentence description]

### Decisions

**Scale:** [How it handles growth]

**Data:** [Where and how stored]

**Security:** [Who can access, how enforced]

**UX:** [User experience approach]

**Coherence:** [Cross-layer consistency plan]

### Trade-offs
[What we're optimizing for, what we're accepting]

### Implementation Order
1. ___
2. ___
3. ___

### Sign-off
- [ ] Developer reviewed
- [ ] Answers satisfy requirements
- [ ] Ready to implement
```

---

## Stop Signs

**STOP and get help if:**

- [ ] "I don't know how many users"
- [ ] "I'm not sure where data goes"
- [ ] "Authorization is complicated"
- [ ] "The types don't match"
- [ ] "This might break existing clients"

**Proceed with caution if:**

- [ ] No tests exist for this area
- [ ] Schema migration required
- [ ] Affects hot path
- [ ] Involves PII

---

## Quick Templates

### Simple Feature
```
Scale: Single user, small data
Data: Existing table, add column
Security: User owns resource
UX: < 100ms, inline update
Coherence: Add field to existing types
```

### Complex Feature
```
Scale: All users, growing data
Data: New table with relationships
Security: Role-based access
UX: Loading state, pagination
Coherence: New types, new endpoints
```

### LLM Feature
```
Scale: Token costs at 10x
Data: Context separation (no IDs in prompt)
Security: Tenant isolation in retrieval
UX: Streaming response
Coherence: Langfuse tracing
```
