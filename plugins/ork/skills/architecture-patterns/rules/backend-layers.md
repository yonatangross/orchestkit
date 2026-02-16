---
title: "Backend: Layer Separation"
category: backend
impact: HIGH
impactDescription: Layer separation prevents coupling between HTTP, business logic, and data access
tags: [layer-separation, router, service, repository, clean-architecture]
---

# Backend Layer Separation

## Architecture Overview

```
+-------------------------------------------------------------------+
|                        ROUTERS LAYER                               |
|  HTTP concerns only: request parsing, response formatting          |
+-------------------------------------------------------------------+
|                        SERVICES LAYER                              |
|  Business logic: orchestration, validation, transformations        |
+-------------------------------------------------------------------+
|                      REPOSITORIES LAYER                            |
|  Data access: database queries, external API calls                 |
+-------------------------------------------------------------------+
|                        MODELS LAYER                                |
|  Data structures: SQLAlchemy models, Pydantic schemas             |
+-------------------------------------------------------------------+
```

## Validation Rules (BLOCKING)

| Rule | Check | Layer |
|------|-------|-------|
| No DB in Routers | Database operations blocked | routers/ |
| No HTTP in Services | HTTPException blocked | services/ |
| No Business Logic in Routers | Complex logic blocked | routers/ |
| Use Depends() | Direct instantiation blocked | routers/ |
| Async Consistency | Sync calls in async blocked | all |

## Exception Pattern

```python
# Domain exceptions (services/repositories)
class UserNotFoundError(DomainException):
    def __init__(self, user_id: int):
        super().__init__(f"User {user_id} not found")

# Router converts to HTTP
@router.get("/{user_id}")
async def get_user(user_id: int, service: UserService = Depends(get_user_service)):
    try:
        return await service.get_user(user_id)
    except UserNotFoundError:
        raise HTTPException(404, "User not found")
```

**Incorrect — database logic in router layer:**
```typescript
@router.post("/users")
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db)) {
    user = User(**data.dict());  // Business logic in router
    db.add(user);  // Database access in router
    await db.commit();
    return user;
}
```

**Correct — router delegates to service layer:**
```typescript
@router.post("/users")
async def create_user(
    data: UserCreate,
    service: UserService = Depends(get_user_service)
) {
    return await service.create_user(data);  // Service handles logic
}
```
