---
title: "Backend: Dependency Injection"
category: backend
impact: HIGH
impactDescription: Proper DI ensures testable code and prevents tight coupling between layers
tags: [dependency-injection, depends, fastapi, service-chain, testable]
---

# Dependency Injection

## Dependency Chain

```python
# deps.py - Dependency providers
def get_user_repository(
    db: AsyncSession = Depends(get_db),
) -> UserRepository:
    return UserRepository(db)

def get_user_service(
    repo: UserRepository = Depends(get_user_repository),
) -> UserService:
    return UserService(repo)

# router_users.py - Usage
@router.get("/{user_id}")
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
):
    return await service.get_user(user_id)
```

## Blocked DI Patterns

```python
# BLOCKED - Direct instantiation
service = UserService()

# BLOCKED - Global instance
user_service = UserService()

# BLOCKED - Missing Depends()
async def get_users(db: AsyncSession):  # Missing Depends()
```

## Common Violations

| Violation | Detection | Fix |
|-----------|-----------|-----|
| DB in router | db.add, db.execute in routers/ | Move to repository |
| HTTPException in service | raise HTTPException in services/ | Use domain exceptions |
| Direct instantiation | Service() without Depends | Use Depends(get_service) |
| Missing await | Sync calls in async | Add await or use executor |
