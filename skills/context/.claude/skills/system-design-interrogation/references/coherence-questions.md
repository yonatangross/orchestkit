# Coherence Questions

## Purpose

Coherence questions ensure consistency across the entire stack - from database to UI.

## The Coherence Matrix

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         COHERENCE MATRIX                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│              Frontend    API         Backend     Database                  │
│            ┌──────────┬──────────┬──────────┬──────────┐                  │
│   Types    │ TS Types │ OpenAPI  │ Pydantic │ SQLAlchemy│  ← Must match   │
│            ├──────────┼──────────┼──────────┼──────────┤                  │
│   State    │ Zustand  │ Request  │ Workflow │ Tables   │  ← Consistent    │
│            ├──────────┼──────────┼──────────┼──────────┤                  │
│   Errors   │ UI Toast │ HTTP 4xx │ Exception│ Constraint│ ← Mapped        │
│            ├──────────┼──────────┼──────────┼──────────┤                  │
│   IDs      │ Display  │ Path/Body│ Context  │ PK/FK    │  ← Same format  │
│            └──────────┴──────────┴──────────┴──────────┘                  │
│                                                                            │
│                    ▲           ▲           ▲           ▲                   │
│                    │           │           │           │                   │
│                    └───────────┴───────────┴───────────┘                   │
│                              CONTRACT                                      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Core Questions

### Type Consistency

| Question | Why Ask | Check |
|----------|---------|-------|
| What's the TypeScript type? | Frontend consistency | Interface defined |
| What's the Pydantic model? | API validation | Request/Response models |
| What's the SQLAlchemy model? | ORM mapping | Table model exists |
| Do all three match? | Contract alignment | Fields sync'd |
| Are there any optional/required mismatches? | Runtime errors | Same nullability |

### Contract Questions

| Question | Why Ask | SkillForge Example |
|----------|---------|-------------------|
| What API endpoints change? | Frontend updates | GET /analyses returns new field |
| Is this a breaking change? | Client compatibility | Adding field = non-breaking |
| What's the migration path? | Deployment order | DB first, then API, then UI |
| Do existing clients handle this? | Backwards compat | Mobile app? Browser cache? |
| Is versioning needed? | API stability | v1 → v2 for breaking changes |

### State Consistency

| Question | Why Ask | Check |
|----------|---------|-------|
| Where is state managed? | Single source of truth | DB vs cache vs local |
| What triggers state updates? | Reactivity | Events, polling, SSE |
| How is stale state handled? | Data freshness | Cache invalidation |
| What's the optimistic update strategy? | UX responsiveness | Rollback on failure |
| Are there race conditions? | Concurrent updates | Locking strategy |

## SkillForge Layer Alignment

### Adding a New Field

```
Feature: Add "status" field to Analysis

STEP 1: Database
- Add column: ALTER TABLE analyses ADD status VARCHAR(20)
- Default value: 'pending'
- Migration: Alembic script

STEP 2: Backend Model
class Analysis(Base):
    status: Mapped[str] = mapped_column(default="pending")

STEP 3: Pydantic Schema
class AnalysisResponse(BaseModel):
    status: str = "pending"

STEP 4: Frontend Type
interface Analysis {
    status: 'pending' | 'processing' | 'complete' | 'failed';
}

STEP 5: UI Component
<StatusBadge status={analysis.status} />

CHECK:
□ All types use same values
□ Default value consistent
□ Enum values documented
□ Old records handled (migration fills default)
```

### Adding a New Endpoint

```
Feature: POST /analyses/{id}/retry

STEP 1: API Route
@router.post("/analyses/{id}/retry")
async def retry_analysis(id: UUID, ctx: RequestContext):
    ...

STEP 2: OpenAPI Docs
- Document request/response
- Add to API reference

STEP 3: Frontend API Client
api.analyses.retry(id: string): Promise<Analysis>

STEP 4: UI Action
<Button onClick={() => retryAnalysis(id)}>Retry</Button>

STEP 5: State Update
- Invalidate analysis query
- Show optimistic state

CHECK:
□ Error responses documented
□ Loading state in UI
□ Error handling in UI
□ Audit logging on backend
```

## Cross-Stack Type Generation

```
┌─────────────────────────────────────────────────────────────┐
│  IDEAL: Single Source of Truth for Types                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│      Pydantic Model ──► OpenAPI Schema ──► TypeScript       │
│            │                                    │           │
│            │                                    │           │
│            ▼                                    ▼           │
│     Backend uses                         Frontend uses      │
│     same model                           generated types    │
│                                                             │
│  Tools:                                                     │
│  - openapi-typescript-codegen                               │
│  - FastAPI's automatic OpenAPI generation                   │
│  - Zod from OpenAPI (for runtime validation)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Red Flags

```
⚠️ "The frontend will just use 'any'"
   → Type safety exists for a reason. Define the type.

⚠️ "We'll update the other layer later"
   → Layers must change together. Same PR or linked PRs.

⚠️ "It's close enough"
   → 'createdAt' vs 'created_at' causes runtime errors.

⚠️ "The backend handles nulls"
   → If frontend sends null and backend expects string, it breaks.

⚠️ "We don't have time for migration"
   → Migration now is cheaper than data cleanup later.
```

## Checklist by Change Type

### Adding a Field

- [ ] Database migration written
- [ ] SQLAlchemy model updated
- [ ] Pydantic schema updated
- [ ] TypeScript interface updated
- [ ] UI component handles new field
- [ ] Tests updated all layers
- [ ] Old data handled (default or migration)

### Removing a Field

- [ ] No consumers depend on field
- [ ] Deprecation warning added (if public API)
- [ ] Frontend stops sending field
- [ ] Backend stops requiring field
- [ ] Database column nullable/dropped
- [ ] Documentation updated

### Changing a Field Type

- [ ] Migration plan for existing data
- [ ] Backwards compatibility period
- [ ] All layers updated simultaneously
- [ ] Tests cover both old and new format
- [ ] Rollback plan documented

## Example Assessment

```markdown
## Feature: Change analysis.difficulty from string to enum

### Current State
- DB: VARCHAR(255) with free-form text
- Backend: str field
- Frontend: string type

### Target State
- DB: VARCHAR(20) with check constraint
- Backend: Enum field
- Frontend: union type

### Migration Plan

1. Add new enum values to backend (week 1)
   - Accept both string and enum
   - Normalize on save

2. Migrate existing data (week 1)
   - Map "easy" → "beginner"
   - Map "hard" → "advanced"
   - Map unknown → "intermediate"

3. Update frontend (week 2)
   - Use new enum values
   - Update difficulty selector

4. Remove string support (week 3)
   - Backend rejects non-enum
   - Add DB constraint

### Coherence Check
□ All layers use same enum values
□ Migration handles edge cases
□ Tests cover all values
□ Old cached responses handled (TTL or clear)
```
