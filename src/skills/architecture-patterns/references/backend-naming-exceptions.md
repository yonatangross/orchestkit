---
title: "Backend Layers: File Naming & Domain Exceptions"
category: backend-layers
impact: HIGH
---

# File Naming Conventions & Domain Exceptions

Naming patterns for FastAPI layers, domain exception hierarchy, and violation detection.

## File Naming Conventions

### Quick Reference

| Layer | Allowed Patterns | Blocked Patterns |
|-------|-----------------|------------------|
| **Routers** | `router_*.py`, `routes_*.py`, `api_*.py`, `deps.py` | `users.py`, `UserRouter.py` |
| **Services** | `*_service.py` | `users.py`, `UserService.py`, `service_*.py` |
| **Repositories** | `*_repository.py`, `*_repo.py` | `users.py`, `repository_*.py` |
| **Schemas** | `*_schema.py`, `*_dto.py`, `*_request.py`, `*_response.py` | `users.py`, `UserSchema.py` |
| **Models** | `*_model.py`, `*_entity.py`, `*_orm.py`, `base.py` | `users.py`, `UserModel.py` |

### Proper File Layout

```
app/
+-- routers/
|   +-- router_users.py      # router_ prefix
|   +-- router_auth.py
|   +-- routes_orders.py     # routes_ prefix also valid
|   +-- api_v1.py            # api_ prefix for versioned
|   +-- deps.py              # deps/dependencies allowed
+-- services/
|   +-- user_service.py      # _service suffix
|   +-- auth_service.py
|   +-- email_service.py
+-- repositories/
|   +-- user_repository.py   # _repository suffix
|   +-- user_repo.py         # _repo suffix also valid
|   +-- base_repository.py
+-- schemas/
|   +-- user_schema.py       # _schema suffix
|   +-- user_dto.py          # _dto suffix also valid
|   +-- user_request.py      # _request suffix
|   +-- user_response.py     # _response suffix
+-- models/
    +-- user_model.py        # _model suffix
    +-- user_entity.py       # _entity suffix also valid
    +-- base.py              # base.py allowed
```

### Common Naming Violations

| Current Name | Correct Name | Issue |
|--------------|--------------|-------|
| `users.py` (in routers/) | `router_users.py` | Missing prefix |
| `users.py` (in services/) | `user_service.py` | Missing suffix |
| `users.py` (in repositories/) | `user_repository.py` | Missing suffix |
| `UserService.py` | `user_service.py` | PascalCase filename |
| `service_user.py` | `user_service.py` | Wrong order |
| `repository_user.py` | `user_repository.py` | Wrong order |

### Why Naming Matters

- **Discoverability**: Consistent naming helps developers find files quickly
- **Automation**: Scripts and tools can identify file types from naming patterns
- **Onboarding**: New team members understand file purposes immediately
- **Import clarity**: Import statements clearly indicate what is being imported

## Domain Exception Pattern

### Exception Hierarchy

```python
# app/core/exceptions.py

class DomainException(Exception):
    """Base domain exception - never catch framework exceptions in domain."""
    pass

class EntityNotFoundError(DomainException):
    """Raised when an entity cannot be found."""
    def __init__(self, entity_type: str, identifier: str | int):
        self.entity_type = entity_type
        self.identifier = identifier
        super().__init__(f"{entity_type} with id {identifier} not found")

class UserNotFoundError(EntityNotFoundError):
    def __init__(self, user_id: int):
        super().__init__("User", str(user_id))

class UserAlreadyExistsError(DomainException):
    def __init__(self, email: str):
        self.email = email
        super().__init__(f"User with email {email} already exists")

class InvalidStateError(DomainException):
    """Raised when an operation violates state machine rules."""
    pass

class BusinessRuleViolation(DomainException):
    """Raised when a business invariant is violated."""
    pass

class AuthorizationError(DomainException):
    """Raised when user lacks permission for an operation."""
    pass
```

### Exception-to-HTTP Mapping

```python
# app/core/exception_handlers.py
from fastapi import Request
from fastapi.responses import JSONResponse

EXCEPTION_STATUS_MAP = {
    EntityNotFoundError: 404,
    UserAlreadyExistsError: 409,
    InvalidStateError: 422,
    BusinessRuleViolation: 400,
    AuthorizationError: 403,
}

async def domain_exception_handler(request: Request, exc: DomainException) -> JSONResponse:
    status_code = EXCEPTION_STATUS_MAP.get(type(exc), 500)
    return JSONResponse(
        status_code=status_code,
        content={"detail": str(exc), "type": type(exc).__name__},
    )

# app/main.py
app.add_exception_handler(DomainException, domain_exception_handler)
```

## Violation Detection Patterns

### Database Operations in Routers

```python
# Detection patterns in routers/*.py:
db.add(...)        # VIOLATION
db.execute(...)    # VIOLATION
db.commit()        # VIOLATION
db.query(...)      # VIOLATION
session.add(...)   # VIOLATION
```

### HTTPException in Services

```python
# Detection patterns in services/*.py:
raise HTTPException(...)        # VIOLATION
from fastapi import HTTPException  # VIOLATION (import)
```

### Direct Instantiation

```python
# Detection patterns in routers/*.py:
service = UserService()         # VIOLATION (global)
service = UserService(repo)     # VIOLATION (in handler)
repo = UserRepository(db)       # VIOLATION (in handler)
```

### Sync in Async

```python
# Detection in async functions:
db.execute(...)     # Missing await - VIOLATION
requests.get(...)   # Sync HTTP in async - VIOLATION
open(path, 'rb')    # Sync I/O in async - VIOLATION
```

## Auto-Fix Quick Reference

| Violation | Detection | Fix |
|-----------|-----------|-----|
| DB in router | `db.add`, `db.execute` in routers/ | Move to repository |
| HTTPException in service | `raise HTTPException` in services/ | Use domain exceptions |
| Direct instantiation | `Service()` without Depends | Use `Depends(get_service)` |
| Wrong naming | Missing suffix/prefix | Rename per convention |
| Sync in async | Missing `await` | Add `await` or use executor |
| Business logic in router | Complex conditions, loops | Extract to service |
