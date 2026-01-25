# Backend Architecture Violations

Reference guide for common Clean Architecture violations in FastAPI applications.

---

## 1. Database Operations in Routers

### Proper Pattern

```python
# app/routers/router_users.py
from fastapi import APIRouter, Depends
from app.services.user_service import UserService
from app.routers.deps import get_user_service

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    user_data: UserCreate,
    service: UserService = Depends(get_user_service),
):
    """Router delegates ALL data operations to service layer."""
    return await service.create_user(user_data)
```

### Anti-Pattern (VIOLATION)

```python
# app/routers/router_users.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user_model import User
from app.core.database import get_db

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),  # VIOLATION: DB session in router
):
    # VIOLATION: Database query in router
    existing = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if existing.scalar():
        raise HTTPException(400, "Email already exists")

    # VIOLATION: Direct ORM operations in router
    user = User(**user_data.model_dump())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
```

### Why It Matters

- **Testability**: Routers with database access require full database setup for testing
- **Separation of Concerns**: Routers should only handle HTTP request/response mapping
- **Reusability**: Business logic locked in routers cannot be reused by other services
- **Maintainability**: Changes to data access require modifying HTTP layer

### Auto-Fix Suggestion

1. Extract database operations to `user_repository.py`
2. Create `user_service.py` to orchestrate repository calls
3. Inject service via `Depends(get_user_service)`
4. Router should only call `service.create_user(user_data)`

---

## 2. HTTPException in Service Layer

### Proper Pattern

```python
# app/services/user_service.py
from app.core.exceptions import UserNotFoundError, UserAlreadyExistsError

class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def create_user(self, data: UserCreate) -> User:
        # Raise DOMAIN exceptions, not HTTP exceptions
        if await self.repo.exists_by_email(data.email):
            raise UserAlreadyExistsError(data.email)

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
        )
        return await self.repo.create(user)

    async def get_user(self, user_id: int) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise UserNotFoundError(user_id)
        return user
```

### Anti-Pattern (VIOLATION)

```python
# app/services/user_service.py
from fastapi import HTTPException  # VIOLATION: HTTP import in service

class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def create_user(self, data: UserCreate) -> User:
        if await self.repo.exists_by_email(data.email):
            # VIOLATION: HTTPException in service layer
            raise HTTPException(
                status_code=400,
                detail="Email already exists"
            )

        return await self.repo.create(User(**data.model_dump()))

    async def get_user(self, user_id: int) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user:
            # VIOLATION: HTTP status codes in business logic
            raise HTTPException(status_code=404, detail="User not found")
        return user
```

### Why It Matters

- **Framework Coupling**: Services become tied to FastAPI, cannot be reused in CLI/workers
- **Layer Bleeding**: HTTP concerns (status codes) leak into business layer
- **Testing Complexity**: Tests must handle HTTP exceptions instead of domain exceptions
- **Protocol Independence**: Business logic should work with any transport (HTTP, gRPC, CLI)

### Auto-Fix Suggestion

1. Create domain exceptions in `app/core/exceptions.py`:
   ```python
   class UserNotFoundError(DomainException): ...
   class UserAlreadyExistsError(DomainException): ...
   ```
2. Replace `HTTPException` with domain exceptions in services
3. Add exception handler in router that converts domain exceptions to HTTP responses

---

## 3. Direct Instantiation (Missing Depends)

### Proper Pattern

```python
# app/routers/deps.py
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

def get_user_repository(
    db: AsyncSession = Depends(get_db),
) -> UserRepository:
    return UserRepository(db)

def get_user_service(
    repo: UserRepository = Depends(get_user_repository),
) -> UserService:
    return UserService(repo)

# app/routers/router_users.py
@router.get("/{user_id}")
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),  # Proper DI
):
    return await service.get_user(user_id)
```

### Anti-Pattern (VIOLATION)

```python
# app/routers/router_users.py

# VIOLATION: Global instance (no DI)
user_service = UserService(UserRepository())

@router.get("/{user_id}")
async def get_user(user_id: int):
    # VIOLATION: Using global instance
    return await user_service.get_user(user_id)

# --- OR ---

@router.get("/{user_id}")
async def get_user(user_id: int):
    # VIOLATION: Direct instantiation in route handler
    repo = UserRepository(get_db())
    service = UserService(repo)
    return await service.get_user(user_id)

# --- OR ---

@router.get("/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession,  # VIOLATION: Missing Depends()
):
    repo = UserRepository(db)
    service = UserService(repo)
    return await service.get_user(user_id)
```

### Why It Matters

- **Testing**: Cannot easily mock dependencies without DI
- **Lifecycle Management**: FastAPI cannot manage object lifecycles (sessions, connections)
- **Request Scope**: Global instances share state across requests (thread-safety issues)
- **Configuration**: Cannot configure different instances per environment

### Auto-Fix Suggestion

1. Create dependency providers in `app/routers/deps.py`
2. Use `Depends()` for ALL service/repository injections
3. Chain dependencies: `get_user_service` depends on `get_user_repository`
4. Never instantiate services directly in route handlers

---

## 4. Wrong File Naming Convention

### Proper Pattern

```
app/
├── routers/
│   ├── router_users.py      # router_ prefix
│   ├── router_auth.py
│   ├── routes_orders.py     # routes_ prefix also valid
│   ├── api_v1.py            # api_ prefix for versioned
│   └── deps.py              # deps/dependencies allowed
├── services/
│   ├── user_service.py      # _service suffix
│   ├── auth_service.py
│   └── email_service.py
├── repositories/
│   ├── user_repository.py   # _repository suffix
│   ├── user_repo.py         # _repo suffix also valid
│   └── base_repository.py
├── schemas/
│   ├── user_schema.py       # _schema suffix
│   ├── user_dto.py          # _dto suffix also valid
│   ├── user_request.py      # _request suffix
│   └── user_response.py     # _response suffix
└── models/
    ├── user_model.py        # _model suffix
    ├── user_entity.py       # _entity suffix also valid
    └── base.py              # base.py allowed
```

### Anti-Pattern (VIOLATION)

```
app/
├── routers/
│   ├── users.py             # VIOLATION: Missing router_ prefix
│   ├── UserRouter.py        # VIOLATION: PascalCase
│   └── user_routes.py       # VIOLATION: Wrong format (should be routes_user.py)
├── services/
│   ├── users.py             # VIOLATION: Missing _service suffix
│   ├── UserService.py       # VIOLATION: PascalCase
│   └── service_user.py      # VIOLATION: Wrong order
├── repositories/
│   ├── users.py             # VIOLATION: Missing _repository suffix
│   └── repository_user.py   # VIOLATION: Wrong order
├── schemas/
│   ├── users.py             # VIOLATION: Missing _schema suffix
│   └── UserSchema.py        # VIOLATION: PascalCase
└── models/
    ├── users.py             # VIOLATION: Missing _model suffix
    └── UserModel.py         # VIOLATION: PascalCase
```

### Why It Matters

- **Discoverability**: Consistent naming helps developers find files quickly
- **Automation**: Scripts and tools can identify file types from naming patterns
- **Onboarding**: New team members understand file purposes immediately
- **Import Clarity**: Import statements clearly indicate what is being imported

### Auto-Fix Suggestion

| Current Name | Correct Name |
|--------------|--------------|
| `users.py` (in routers/) | `router_users.py` |
| `users.py` (in services/) | `user_service.py` |
| `users.py` (in repositories/) | `user_repository.py` |
| `users.py` (in schemas/) | `user_schema.py` |
| `users.py` (in models/) | `user_model.py` |
| `UserService.py` | `user_service.py` |

---

## 5. Sync Calls in Async Functions

### Proper Pattern

```python
# app/repositories/user_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        # CORRECT: Using await with async session
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> list[User]:
        # CORRECT: Async all the way
        result = await self.db.execute(select(User))
        return list(result.scalars().all())

# For unavoidable sync operations
import asyncio

async def process_file(file_path: str) -> bytes:
    # CORRECT: Run sync code in executor
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: open(file_path, 'rb').read()
    )
```

### Anti-Pattern (VIOLATION)

```python
# app/repositories/user_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        # VIOLATION: Missing await - sync call in async function
        result = self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> list[User]:
        # VIOLATION: Using sync session methods
        return self.db.query(User).all()

# VIOLATION: Blocking I/O in async function
async def process_file(file_path: str) -> bytes:
    # This blocks the event loop!
    with open(file_path, 'rb') as f:
        return f.read()

# VIOLATION: Sync HTTP call in async function
import requests

async def fetch_external_data(url: str) -> dict:
    # Blocks event loop - use httpx or aiohttp instead
    response = requests.get(url)
    return response.json()
```

### Why It Matters

- **Event Loop Blocking**: Sync calls block the entire event loop, killing concurrency
- **Performance**: Defeats the purpose of using async FastAPI
- **Scalability**: Blocked event loop cannot handle other requests
- **Timeout Issues**: Long sync operations can cause request timeouts

### Auto-Fix Suggestion

1. Replace `db.execute()` with `await db.execute()`
2. Use `await db.scalars()` instead of `db.query()`
3. Replace `requests` with `httpx.AsyncClient` or `aiohttp`
4. Wrap unavoidable sync operations in `run_in_executor()`
5. Use `aiofiles` for async file operations

---

## Quick Reference: Common Violations

| Violation | Location | Detection Pattern | Fix |
|-----------|----------|-------------------|-----|
| DB in router | `routers/*.py` | `db.add`, `db.execute`, `db.commit` | Move to repository |
| HTTPException in service | `services/*.py` | `raise HTTPException` | Use domain exceptions |
| Direct instantiation | `routers/*.py` | `Service()` without Depends | Use `Depends(get_service)` |
| Wrong naming | All layers | Missing suffix/prefix | Rename per convention |
| Sync in async | All layers | Missing `await` | Add `await` or use executor |
| Business logic in router | `routers/*.py` | Complex conditions, loops | Extract to service |