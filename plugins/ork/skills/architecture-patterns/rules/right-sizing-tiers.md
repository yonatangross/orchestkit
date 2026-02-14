---
title: Architecture Sizing Tiers
impact: HIGH
impactDescription: "Choosing the wrong architecture tier wastes days building unnecessary abstractions or leaves no foundation for growth"
tags: right-sizing, architecture, interview, mvp, enterprise, over-engineering
---

## Architecture Sizing Tiers

Match architecture complexity to project scope using concrete signals. Read the project tier from `scope-appropriate-architecture` context (set during brainstorming/implement Step 0). If no tier is set, auto-detect using the signals below.

**Enforcement rule:** When reviewing or generating code, check the detected tier FIRST. If a pattern is marked OFF for the current tier, do not suggest or enforce it. If marked WARN, mention the concern but don't block. If marked BLOCK, enforce strictly.

**Incorrect — enterprise patterns for a take-home:**
```python
# 4-hour interview take-home with full hexagonal architecture
# app/domain/repositories/user_repository.py
class IUserRepository(Protocol):
    async def get_by_id(self, id: UUID) -> User | None: ...
    async def save(self, user: User) -> User: ...

# app/infrastructure/repositories/postgres_user_repository.py
class PostgresUserRepository:
    def __init__(self, session: AsyncSession): ...
    # +300 LOC for a single CRUD entity
```

**Correct — right-sized for context:**
```python
# Interview: flat, 3-5 files, 300-600 LOC total
# main.py — everything in one file
from fastapi import FastAPI
from sqlmodel import SQLModel, Field, Session, create_engine

app = FastAPI()
engine = create_engine("sqlite:///db.sqlite3")

class Todo(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    done: bool = False

@app.get("/todos")
def list_todos():
    with Session(engine) as session:
        return session.query(Todo).all()
```

**Sizing matrix:**

| Signal | Flat/Simple | Layered | Clean/Hexagonal |
|--------|-------------|---------|-----------------|
| Timeline | Hours to days | Weeks to months | Months to years |
| Team size | 1 developer | 2-5 developers | 5+ developers |
| Lifespan | Disposable / demo | 1-3 years | 3+ years |
| Domain complexity | CRUD, single entity | 3-10 entities | Complex invariants |
| Users | < 100 | 100-10,000 | 10,000+ |
| LOC estimate | 200-800 | 1,000-10,000 | 10,000+ |

**Tier detection signals:**

| Signal | Interview | MVP | Production | Enterprise |
|--------|-----------|-----|------------|------------|
| README mentions take-home | Yes | — | — | — |
| File count < 10 | Yes | — | — | — |
| No CI config | — | Yes | — | — |
| File count < 50 | — | Yes | — | — |
| Has k8s/terraform | — | — | — | Yes |
| Has monorepo (packages/) | — | — | — | Yes |

**Tier-based rule enforcement:**

| Rule | Interview | MVP | Production | Enterprise |
|------|-----------|-----|------------|------------|
| Layer separation | OFF | WARN | BLOCK | BLOCK |
| Repository pattern | OFF | OFF | WARN | BLOCK |
| Domain exceptions | OFF | OFF | BLOCK | BLOCK |
| Dependency injection | OFF | WARN | BLOCK | BLOCK |
| OpenAPI documentation | OFF | OFF | WARN | BLOCK |

**Key rules:**
- Default to layered architecture — 80% of projects need layered, not hexagonal
- Interview threshold is < 10 files — demonstrate thinking, not scaffolding
- Add repository pattern only when 3+ query consumers exist
- Add CQRS only when read/write models differ by 50%+
- Security patterns (SQL parameterization, input validation, auth) are ALWAYS enforced regardless of tier
- User can override detected tier explicitly — respect manual overrides
