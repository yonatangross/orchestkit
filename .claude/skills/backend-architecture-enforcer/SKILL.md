---
name: backend-architecture-enforcer
description: Enforce FastAPI Clean Architecture - layer separation, dependency injection, async patterns, no business logic in routers. Blocks violations. Use when building or reviewing backend code.
context: fork
agent: backend-system-architect
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [backend, fastapi, architecture, enforcement, blocking, clean-architecture, di]
hooks:
  PreToolUse:
    - matcher: Write
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/backend-file-naming.sh"
  PostToolUse:
    - matcher: Write|Edit
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/backend-layer-validator.sh"
    - matcher: Write|Edit
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/di-pattern-enforcer.sh"
---

# Backend Architecture Enforcer

Enforce FastAPI Clean Architecture with **BLOCKING** validation.

## When to Use

- Building FastAPI endpoints
- Creating services or repositories
- Reviewing backend architecture
- Refactoring legacy code

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ROUTERS LAYER                            │
│  HTTP concerns only: request parsing, response formatting       │
│  Files: router_*.py, routes_*.py, api_*.py                     │
├─────────────────────────────────────────────────────────────────┤
│                        SERVICES LAYER                           │
│  Business logic: orchestration, validation, transformations     │
│  Files: *_service.py                                           │
├─────────────────────────────────────────────────────────────────┤
│                      REPOSITORIES LAYER                         │
│  Data access: database queries, external API calls              │
│  Files: *_repository.py, *_repo.py                             │
├─────────────────────────────────────────────────────────────────┤
│                        MODELS LAYER                             │
│  Data structures: SQLAlchemy models, Pydantic schemas          │
│  Files: *_model.py (ORM), *_schema.py (Pydantic)              │
└─────────────────────────────────────────────────────────────────┘
```

## Validation Rules

### BLOCKING Rules (exit 1)

| Rule | Check | Layer |
|------|-------|-------|
| **No DB in Routers** | Database operations blocked in routers | routers/ |
| **No HTTP in Services** | HTTPException blocked in services | services/ |
| **No Business Logic in Routers** | Complex logic blocked in routers | routers/ |
| **Use Depends()** | Direct instantiation blocked | routers/ |
| **Async Consistency** | Sync calls in async functions blocked | all |
| **File Naming** | Must follow naming convention | all |

## File Naming Conventions

### Routers
```
ALLOWED:
  router_users.py
  routes_auth.py
  api_items.py
  deps.py
  dependencies.py

BLOCKED:
  users.py           # Missing prefix
  user_routes.py     # Wrong format
  UserRouter.py      # PascalCase
```

### Services
```
ALLOWED:
  user_service.py
  auth_service.py
  email_service.py

BLOCKED:
  users.py           # Missing _service suffix
  UserService.py     # PascalCase
  service_user.py    # Wrong order
```

### Repositories
```
ALLOWED:
  user_repository.py
  user_repo.py
  auth_repository.py

BLOCKED:
  users.py              # Missing suffix
  repository_user.py    # Wrong order
  UserRepository.py     # PascalCase
```

### Schemas
```
ALLOWED:
  user_schema.py
  user_dto.py
  auth_request.py
  auth_response.py

BLOCKED:
  users.py           # Missing suffix
  UserSchema.py      # PascalCase
```

### Models (SQLAlchemy)
```
ALLOWED:
  user_model.py
  user_entity.py
  user_orm.py
  base.py

BLOCKED:
  users.py           # Missing suffix
  UserModel.py       # PascalCase
```

## Layer Separation Rules

### Routers Layer (HTTP Only)

Routers should ONLY handle:
- Request parsing
- Response formatting
- HTTP status codes
- Authentication/authorization checks
- Calling services

```python
# GOOD - Router delegates to service
@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    service: UserService = Depends(get_user_service),
):
    user = await service.create_user(user_data)
    return user

# BLOCKED - Business logic in router
@router.post("/users")
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    # ❌ Database operation in router
    existing = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if existing.scalar():
        raise HTTPException(400, "Email exists")

    # ❌ Business logic in router
    user = User(**user_data.dict())
    user.created_at = datetime.utcnow()
    db.add(user)
    await db.commit()
    return user
```

### Services Layer (Business Logic)

Services should:
- Contain business logic
- Orchestrate repositories
- Handle validation
- Transform data
- Raise domain exceptions (NOT HTTPException)

```python
# GOOD - Service with business logic
class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def create_user(self, data: UserCreate) -> User:
        # Business validation
        if await self.repo.exists_by_email(data.email):
            raise UserAlreadyExistsError(data.email)

        # Business logic
        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            created_at=datetime.utcnow(),
        )

        return await self.repo.create(user)

# BLOCKED - HTTP concerns in service
class UserService:
    async def create_user(self, data: UserCreate) -> User:
        if await self.repo.exists_by_email(data.email):
            # ❌ HTTPException in service
            raise HTTPException(400, "Email already exists")

        # ❌ Accessing Request object
        if request.headers.get("X-Admin"):
            user.is_admin = True
```

### Repositories Layer (Data Access)

Repositories should:
- Execute database queries
- Call external APIs
- Handle data persistence
- Return domain objects or None

```python
# GOOD - Repository handles data access only
class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

# BLOCKED - HTTP concerns in repository
class UserRepository:
    async def get_by_id(self, user_id: int) -> User:
        user = await self.db.get(User, user_id)
        if not user:
            # ❌ HTTPException in repository
            raise HTTPException(404, "User not found")
        return user
```

## Dependency Injection Rules

### Use Depends() for All Dependencies

```python
# GOOD - Proper DI with Depends()
@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_user(user_id)

# Dependency provider
def get_user_service(
    repo: UserRepository = Depends(get_user_repository),
) -> UserService:
    return UserService(repo)

def get_user_repository(
    db: AsyncSession = Depends(get_db),
) -> UserRepository:
    return UserRepository(db)
```

### BLOCKED Patterns

```python
# BLOCKED - Direct instantiation
@router.get("/users/{user_id}")
async def get_user(user_id: int):
    service = UserService()  # ❌ Direct instantiation
    return await service.get_user(user_id)

# BLOCKED - Global instance
user_service = UserService()  # ❌ Global instance

@router.get("/users/{user_id}")
async def get_user(user_id: int):
    return await user_service.get_user(user_id)

# BLOCKED - Session without Depends
@router.get("/users")
async def get_users(db: AsyncSession):  # ❌ Missing Depends()
    return await db.execute(select(User)).scalars().all()
```

## Async Consistency Rules

### No Sync Calls in Async Functions

```python
# GOOD - Async all the way
async def get_user(user_id: int) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

# BLOCKED - Sync call in async function
async def get_user(user_id: int) -> User:
    # ❌ Blocking sync call
    result = db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

# If you must use sync code, use run_in_executor
async def process_file(file_path: str) -> bytes:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: open(file_path, 'rb').read()
    )
```

## Common Violations

### 1. Database Operations in Router
```
BLOCKED: Database operations not allowed in routers
  File: app/routers/router_users.py:42
  Code: db.add(user)
  Move to repository layer
```

### 2. HTTPException in Service
```
BLOCKED: HTTP responses not allowed in services
  File: app/services/user_service.py:28
  Code: raise HTTPException(400, "Invalid")
  Return data/raise domain exceptions, let routers handle HTTP
```

### 3. Direct Instantiation
```
BLOCKED: Direct service instantiation not allowed
  File: app/routers/router_users.py:15
  Code: service = UserService()
  Use: service: UserService = Depends(get_user_service)
```

### 4. Wrong File Naming
```
BLOCKED: Service files must end with _service.py
  Got: users.py
  Example: user_service.py, auth_service.py
```

### 5. Complex Router Function
```
BLOCKED: Router functions too complex (avg 45 lines)
  File: app/routers/router_orders.py
  Extract business logic to services/
```

## Exception Handling Pattern

### Domain Exceptions (Services/Repositories)

```python
# app/core/exceptions.py
class DomainException(Exception):
    """Base domain exception."""
    pass

class UserNotFoundError(DomainException):
    def __init__(self, user_id: int):
        self.user_id = user_id
        super().__init__(f"User {user_id} not found")

class UserAlreadyExistsError(DomainException):
    def __init__(self, email: str):
        self.email = email
        super().__init__(f"User with email {email} already exists")
```

### Exception Handler (Routers)

```python
# app/routers/deps.py
from fastapi import HTTPException

def handle_domain_exception(exc: DomainException) -> HTTPException:
    """Convert domain exceptions to HTTP responses."""
    if isinstance(exc, UserNotFoundError):
        return HTTPException(404, str(exc))
    if isinstance(exc, UserAlreadyExistsError):
        return HTTPException(409, str(exc))
    return HTTPException(500, "Internal error")

# Usage in router
@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
):
    try:
        return await service.get_user(user_id)
    except DomainException as e:
        raise handle_domain_exception(e)
```

## Complete Example

### Router

```python
# app/routers/router_users.py
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.user_schema import UserCreate, UserResponse
from app.services.user_service import UserService
from app.routers.deps import get_user_service

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    user_data: UserCreate,
    service: UserService = Depends(get_user_service),
):
    """Create a new user."""
    try:
        return await service.create_user(user_data)
    except UserAlreadyExistsError:
        raise HTTPException(409, "Email already registered")

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
):
    """Get user by ID."""
    user = await service.get_user(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user
```

### Service

```python
# app/services/user_service.py
from app.repositories.user_repository import UserRepository
from app.schemas.user_schema import UserCreate
from app.models.user_model import User
from app.core.security import hash_password

class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def create_user(self, data: UserCreate) -> User:
        if await self.repo.exists_by_email(data.email):
            raise UserAlreadyExistsError(data.email)

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
        )
        return await self.repo.create(user)

    async def get_user(self, user_id: int) -> User | None:
        return await self.repo.get_by_id(user_id)
```

### Repository

```python
# app/repositories/user_repository.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user_model import User

class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def exists_by_email(self, email: str) -> bool:
        result = await self.db.execute(
            select(User.id).where(User.email == email)
        )
        return result.scalar() is not None

    async def create(self, user: User) -> User:
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
```

## Related Skills

- `clean-architecture` - DDD patterns
- `fastapi-advanced` - Advanced FastAPI patterns
- `dependency-injection` - DI patterns
- `project-structure-enforcer` - Folder structure

## Capability Details

### layer-separation
**Keywords:** router, service, repository, layer, clean architecture, separation
**Solves:**
- Prevent database operations in routers
- Block business logic in route handlers
- Ensure proper layer boundaries

### dependency-injection
**Keywords:** depends, dependency injection, DI, fastapi depends, inject
**Solves:**
- Enforce use of FastAPI Depends() pattern
- Block direct instantiation in routers
- Ensure testable code structure

### file-naming
**Keywords:** naming convention, file name, router_, _service, _repository
**Solves:**
- Enforce consistent file naming patterns
- Validate router/service/repository naming
- Maintain codebase consistency

### async-patterns
**Keywords:** async, await, sync, blocking call, asyncio
**Solves:**
- Detect sync calls in async functions
- Prevent blocking operations in async code
- Ensure async consistency
