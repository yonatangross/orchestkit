# Architecture Review Guide

Pattern consistency, coupling analysis, and structural health assessment.

## Dependency Direction Analysis

### Clean Architecture Layers

```
┌─────────────────────────────┐
│  Presentation (routes, UI)  │  ← Outermost
├─────────────────────────────┤
│  Application (use cases)    │
├─────────────────────────────┤
│  Domain (entities, rules)   │
├─────────────────────────────┤
│  Infrastructure (DB, APIs)  │  ← Outermost
└─────────────────────────────┘

Rule: Dependencies point INWARD only.
Violation: Domain importing from Infrastructure.
```

### Detection Method

1. Map each file to a layer based on directory structure
2. Parse imports/requires in each file
3. Flag imports that point outward (wrong direction)

```
# VIOLATION EXAMPLE:
# src/domain/user.ts imports from src/infrastructure/db.ts
import { dbPool } from '../infrastructure/db'  // Wrong direction!

# CORRECT:
# src/domain/user.ts defines interface
# src/infrastructure/db.ts implements it
```

## Circular Dependency Detection

### What to Look For

```
# File A imports File B, File B imports File A
// src/auth/service.ts
import { UserRepo } from '../users/repo'

// src/users/repo.ts
import { AuthService } from '../auth/service'  // Circular!
```

### Resolution Patterns

| Pattern | When to Use |
|---------|-------------|
| Extract interface | Both modules depend on abstraction |
| Merge modules | Modules are conceptually one unit |
| Event-based | Decouple with pub/sub or event emitter |
| Dependency injection | Inject at runtime, not import time |

## Pattern Consistency Check

Look for the same problem solved differently across the codebase:

| Area | Inconsistency Example |
|------|----------------------|
| Error handling | Some files throw, others return Result, others use callbacks |
| Validation | Zod in some files, Joi in others, manual checks elsewhere |
| Data access | Raw SQL in some, ORM in others, mixed in same file |
| Logging | console.log, winston, pino, custom logger all present |
| Config | env vars, config files, hardcoded, mixed approaches |
| HTTP clients | fetch, axios, got, node-fetch all imported |

### Scoring

| Consistency | Score |
|-------------|-------|
| Single pattern everywhere | 10/10 |
| Primary + 1 legacy pattern | 7/10 |
| 2-3 competing patterns | 4/10 |
| No discernible pattern | 1/10 |

## Coupling Analysis

### Metrics to Calculate

| Metric | Formula | Healthy Range |
|--------|---------|---------------|
| Afferent coupling (Ca) | Modules that depend ON this module | < 10 |
| Efferent coupling (Ce) | Modules this module depends ON | < 8 |
| Instability (I) | Ce / (Ca + Ce) | Varies by layer |
| Abstractness (A) | Interfaces / Total types | > 0.3 for core |

### Module Boundary Health

```
# Count imports between directories:
src/auth/ → src/users/    : 5 imports (acceptable)
src/auth/ → src/payments/  : 12 imports (high coupling!)
src/utils/ → src/auth/     : 0 imports (good, utils is generic)
```

### Red Flags

- Module with > 15 external dependents (God module)
- Utility file with > 500 lines (needs splitting)
- Circular import chains > 2 files deep
- Config/env imported in > 20 files (use DI instead)

## Layering Violations

| Violation | Example | Fix |
|-----------|---------|-----|
| DB in route handler | `router.get('/', async (req, res) => { db.query(...) })` | Extract to service layer |
| Business logic in middleware | Auth middleware doing role-based access with complex rules | Move to use-case layer |
| HTTP in domain | Domain entity calling external API | Inject via port/adapter |
| UI logic in API | API returning HTML-formatted strings | Return data, format in frontend |

## Architecture Diagram Output

Generate ASCII diagram showing module dependencies:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  routes   │────▶│ services │────▶│  repos   │
└──────────┘     └──────────┘     └──────────┘
      │                │                │
      ▼                ▼                ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│middleware│     │  domain  │     │    db     │
└──────────┘     └──────────┘     └──────────┘

Legend: ──▶ = imports from
Violations marked with ✗
```
