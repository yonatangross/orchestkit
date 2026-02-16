---
title: "Backend: File Naming & Exceptions"
category: backend
impact: HIGH
impactDescription: Consistent naming conventions make code discoverable and maintainable
tags: [file-naming, naming-convention, domain-exception, router, service, repository]
---

# File Naming & Exceptions

## File Naming Conventions

| Layer | Allowed Patterns | Blocked Patterns |
|-------|-----------------|------------------|
| Routers | router_*.py, routes_*.py, api_*.py, deps.py | users.py, UserRouter.py |
| Services | *_service.py | users.py, UserService.py, service_*.py |
| Repositories | *_repository.py, *_repo.py | users.py, repository_*.py |
| Schemas | *_schema.py, *_dto.py, *_request.py, *_response.py | users.py, UserSchema.py |
| Models | *_model.py, *_entity.py, *_orm.py, base.py | users.py, UserModel.py |

## Async Rules

```python
# GOOD - Async all the way
result = await db.execute(select(User))

# BLOCKED - Sync in async function
result = db.execute(select(User))  # Missing await

# For sync code, use executor
await loop.run_in_executor(None, sync_function)
```

## Key Principles

- Use snake_case with suffixes for Python files
- Routers prefix with `router_`, services suffix with `_service`
- Domain exceptions in domain layer, HTTP conversion in routers only
- All database operations must use `await`

**Incorrect — missing await on async database operation:**
```typescript
async function getUser(db: AsyncSession, userId: number) {
    result = db.execute(select(User).where(User.id === userId));  // Missing await
    return result.scalar_one_or_none();
}
```

**Correct — properly awaiting async database calls:**
```typescript
async function getUser(db: AsyncSession, userId: number) {
    result = await db.execute(select(User).where(User.id === userId));
    return result.scalar_one_or_none();
}
```
