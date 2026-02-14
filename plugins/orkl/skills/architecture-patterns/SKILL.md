---
name: architecture-patterns
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Architecture validation and patterns for clean architecture, backend structure enforcement, project structure validation, test standards, and context-aware sizing. Use when designing system boundaries, enforcing layered architecture, validating project structure, defining test standards, or choosing the right architecture tier for project scope.
tags: [architecture, clean-architecture, validation, structure, enforcement, testing-standards, right-sizing, over-engineering, context-aware]
skills: [scope-appropriate-architecture]
context: fork
agent: backend-system-architect
version: 2.1.0
author: OrchestKit
user-invocable: false
complexity: high
metadata:
  category: document-asset-creation
---

# Architecture Patterns

Consolidated architecture validation and enforcement patterns covering clean architecture, backend layer separation, project structure conventions, and test standards. Each category has individual rule files in `references/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Clean Architecture](#clean-architecture) | 3 | HIGH | SOLID principles, hexagonal architecture, ports & adapters, DDD |
| [Project Structure](#project-structure) | 2 | HIGH | Folder conventions, nesting depth, import direction, barrel files |
| [Backend Layers](#backend-layers) | 3 | HIGH | Router/service/repository separation, DI, file naming |
| [Test Standards](#test-standards) | 3 | MEDIUM | AAA pattern, naming conventions, coverage thresholds |
| [Right-Sizing](#right-sizing) | 2 | HIGH | Architecture tier selection, over-engineering prevention, context-aware enforcement |

**Total: 13 rules across 5 categories**

## Quick Start

```python
# Clean Architecture: Dependency Inversion via Protocol
class IUserRepository(Protocol):
    async def get_by_id(self, id: str) -> User | None: ...

class UserService:
    def __init__(self, repo: IUserRepository):
        self._repo = repo  # Depends on abstraction, not concretion

# FastAPI DI chain: DB -> Repository -> Service
def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(PostgresUserRepository(db))
```

```
# Project Structure: Unidirectional Import Architecture
shared/lib  ->  components  ->  features  ->  app
(lowest)                                    (highest)

# Backend Layers: Strict Separation
Routers (HTTP) -> Services (Business Logic) -> Repositories (Data Access)
```

## Clean Architecture

SOLID principles, hexagonal architecture, ports and adapters, and DDD tactical patterns for maintainable backends.

| Rule | File | Key Pattern |
|------|------|-------------|
| Hexagonal Architecture | `references/clean-hexagonal-ports-adapters.md` | Driving/driven ports, adapter implementations, layer structure |
| SOLID & Dependency Rule | `references/clean-solid-dependency-rule.md` | Protocol-based interfaces, dependency inversion, FastAPI DI |
| DDD Tactical Patterns | `references/clean-ddd-tactical-patterns.md` | Entities, value objects, aggregate roots, domain events |

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Protocol vs ABC | Protocol (structural typing) |
| Dataclass vs Pydantic | Dataclass for domain, Pydantic for API |
| Repository granularity | One per aggregate root |
| Transaction boundary | Service layer, not repository |
| Event publishing | Collect in aggregate, publish after commit |

## Project Structure

Feature-based organization, max nesting depth, unidirectional imports, and barrel file prevention.

| Rule | File | Key Pattern |
|------|------|-------------|
| Folder Structure & Nesting | `references/structure-folder-conventions.md` | React/Next.js and FastAPI layouts, 4-level max nesting, barrel file rules |
| Import Direction & Location | `references/structure-import-direction.md` | Unidirectional imports, cross-feature prevention, component/hook placement |

### Blocking Rules

| Rule | Check |
|------|-------|
| Max Nesting | Max 4 levels from src/ or app/ |
| No Barrel Files | No index.ts re-exports (tree-shaking issues) |
| Component Location | React components in components/ or features/ only |
| Hook Location | Custom hooks in hooks/ or features/*/hooks/ only |
| Import Direction | Unidirectional: shared -> components -> features -> app |

## Backend Layers

FastAPI Clean Architecture with router/service/repository layer separation and blocking validation.

| Rule | File | Key Pattern |
|------|------|-------------|
| Layer Separation | `references/backend-layer-separation.md` | Router/service/repository boundaries, forbidden patterns, async rules |
| Dependency Injection | `references/backend-dependency-injection.md` | Depends() chains, auth patterns, testing with DI overrides |
| File Naming & Exceptions | `references/backend-naming-exceptions.md` | Naming conventions, domain exceptions, violation detection |

### Layer Boundaries

| Layer | Responsibility | Forbidden |
|-------|---------------|-----------|
| Routers | HTTP concerns, request parsing, auth checks | Database operations, business logic |
| Services | Business logic, validation, orchestration | HTTPException, Request objects |
| Repositories | Data access, queries, persistence | HTTP concerns, business logic |

## Test Standards

Testing best practices with AAA pattern, naming conventions, isolation, and coverage thresholds.

| Rule | File | Key Pattern |
|------|------|-------------|
| AAA Pattern & Isolation | `references/testing-aaa-isolation.md` | Arrange-Act-Assert, test isolation, parameterized tests |
| Naming Conventions | `references/testing-naming-conventions.md` | Descriptive behavior-focused names for Python and TypeScript |
| Coverage & Location | `references/testing-coverage-location.md` | Coverage thresholds, fixture scopes, test file placement rules |

### Coverage Requirements

| Area | Minimum | Target |
|------|---------|--------|
| Overall | 80% | 90% |
| Business Logic | 90% | 100% |
| Critical Paths | 95% | 100% |
| New Code | 100% | 100% |

## Right-Sizing

Context-aware backend architecture enforcement. Rules adjust strictness based on project tier detected by `scope-appropriate-architecture`.

**Enforcement procedure:**
1. Read project tier from `scope-appropriate-architecture` context (set during brainstorming/implement Step 0)
2. If no tier set, auto-detect using signals in `rules/right-sizing-tiers.md`
3. Apply tier-based enforcement matrix — skip rules marked OFF for detected tier
4. **Security rules are tier-independent** — always enforce SQL parameterization, input validation, auth checks

| Rule | File | Key Pattern |
|------|------|-------------|
| Architecture Sizing Tiers | `rules/right-sizing-tiers.md` | Interview/MVP/production/enterprise sizing matrix, LOC estimates, detection signals |
| Right-Sizing Decision Guide | `rules/right-sizing-decision.md` | ORM, auth, error handling, testing recommendations per tier, over-engineering tax |

### Tier-Based Rule Enforcement

| Rule | Interview | MVP | Production | Enterprise |
|------|-----------|-----|------------|------------|
| Layer separation | OFF | WARN | BLOCK | BLOCK |
| Repository pattern | OFF | OFF | WARN | BLOCK |
| Domain exceptions | OFF | OFF | BLOCK | BLOCK |
| Dependency injection | OFF | WARN | BLOCK | BLOCK |
| OpenAPI documentation | OFF | OFF | WARN | BLOCK |

**Manual override:** User can set tier explicitly to bypass auto-detection (e.g., "I want enterprise patterns for this take-home to demonstrate skill").

### Decision Flowchart

```
Is this a take-home or hackathon?
  YES --> Flat architecture. Single file or 3-5 files. Done.
  NO  -->

Is this a prototype or MVP with < 3 months runway?
  YES --> Simple layered. Routes + services + models. No abstractions.
  NO  -->

Do you have > 5 engineers or complex domain rules?
  YES --> Clean architecture with ports/adapters.
  NO  --> Layered architecture. Add abstractions only when pain appears.
```

## When NOT to Use

Not every project needs architecture patterns. Match complexity to project tier:

| Pattern | Interview | Hackathon | MVP | Growth | Enterprise | Simpler Alternative |
|---------|-----------|-----------|-----|--------|------------|---------------------|
| Repository pattern | OVERKILL (~200 LOC) | OVERKILL | BORDERLINE | APPROPRIATE | REQUIRED | Direct ORM calls in service (~20 LOC) |
| DI containers | OVERKILL (~150 LOC) | OVERKILL | LIGHT ONLY | APPROPRIATE | REQUIRED | Constructor params or module-level singletons (~10 LOC) |
| Event-driven arch | OVERKILL (~300 LOC) | OVERKILL | OVERKILL | SELECTIVE | APPROPRIATE | Direct function calls between services (~30 LOC) |
| Hexagonal architecture | OVERKILL (~400 LOC) | OVERKILL | OVERKILL | BORDERLINE | APPROPRIATE | Flat modules with imports (~50 LOC) |
| Strict layer separation | OVERKILL (~250 LOC) | OVERKILL | WARN | BLOCK | BLOCK | Routes + models in same file (~40 LOC) |
| Domain exceptions | OVERKILL (~100 LOC) | OVERKILL | OVERKILL | BLOCK | BLOCK | Built-in ValueError/HTTPException (~5 LOC) |

**Rule of thumb:** If a pattern shows OVERKILL for the detected tier, do NOT use it. Use the simpler alternative. A take-home with hexagonal architecture signals over-engineering, not skill.

## Anti-Patterns (FORBIDDEN)

```python
# CLEAN ARCHITECTURE
# NEVER import infrastructure in domain layer
from app.infrastructure.database import engine  # In domain layer!

# NEVER leak ORM models to API layer
@router.get("/users/{id}")
async def get_user(id: str, db: Session) -> UserModel:  # Returns ORM model!

# NEVER have domain depend on framework
from fastapi import HTTPException
class UserService:
    def get(self, id: str):
        raise HTTPException(404)  # Framework in domain!

# PROJECT STRUCTURE
# NEVER create files deeper than 4 levels from src/
# NEVER create barrel files (index.ts re-exports)
# NEVER import from higher layers (features importing from app)
# NEVER import across features (use shared/ for common code)

# BACKEND LAYERS
# NEVER use database operations in routers
# NEVER raise HTTPException in services
# NEVER instantiate services without Depends()

# TEST STANDARDS
# NEVER mix test files with source code
# NEVER use non-descriptive test names (test1, test, works)
# NEVER share mutable state between tests without reset
```

## Related Skills

- `scope-appropriate-architecture` - Project tier detection that drives right-sizing enforcement
- `quality-gates` - YAGNI gate uses tier context to validate complexity
- `distributed-systems` - Distributed locking, resilience, idempotency patterns
- `api-design` - REST API design, versioning, error handling
- `testing-patterns` - Comprehensive testing patterns and strategies
- `python-backend` - FastAPI, SQLAlchemy, asyncio patterns
- `database-patterns` - Schema design, query optimization, migrations
