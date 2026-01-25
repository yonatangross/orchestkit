# Dependency Injection Patterns

FastAPI dependency injection patterns using `Depends()` for Clean Architecture.

---

## Core Principles

1. **Never instantiate services/repositories directly** in route handlers
2. **Always use `Depends()`** for injecting dependencies
3. **Chain dependencies** for proper layering (router -> service -> repository -> db)
4. **Keep dependency providers** in a dedicated `deps.py` file

---

## Dependency Provider Pattern

### Basic Setup

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
    """Repository depends on database session."""
    return UserRepository(db)

def get_user_service(
    repo: UserRepository = Depends(get_user_repository),
) -> UserService:
    """Service depends on repository."""
    return UserService(repo)
```

### Usage in Router

```python
# app/routers/router_users.py
from fastapi import APIRouter, Depends
from app.services.user_service import UserService
from app.routers.deps import get_user_service

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}")
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
):
    return await service.get_user(user_id)

@router.post("/")
async def create_user(
    user_data: UserCreate,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user),  # Auth dependency
):
    return await service.create_user(user_data)
```

---

## Dependency Chaining

```
Request
    │
    ▼
┌─────────────────────────────────────────────────┐
│ get_current_user (auth)                          │
│   └── Depends(get_db) for token validation       │
└─────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│ get_user_service                                 │
│   └── Depends(get_user_repository)               │
│         └── Depends(get_db)                      │
└─────────────────────────────────────────────────┘
    │
    ▼
Route Handler
```

---

## Common DI Patterns

### 1. Database Session Dependency

```python
# app/core/database.py
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

### 2. Authentication Dependency

```python
# app/routers/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    user_service: UserService = Depends(get_user_service),
) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await user_service.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
```

### 3. Permission Dependency

```python
# app/routers/deps.py
from typing import Callable

def require_permissions(*permissions: str) -> Callable:
    """Factory for permission-checking dependencies."""
    async def permission_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        user_permissions = set(current_user.permissions)
        required = set(permissions)
        if not required.issubset(user_permissions):
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions"
            )
        return current_user
    return permission_checker

# Usage
@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_permissions("admin", "user:delete")),
    service: UserService = Depends(get_user_service),
):
    return await service.delete_user(user_id)
```

### 4. Pagination Dependency

```python
# app/routers/deps.py
from pydantic import BaseModel

class PaginationParams(BaseModel):
    skip: int = 0
    limit: int = 100

def get_pagination(
    skip: int = 0,
    limit: int = 100,
) -> PaginationParams:
    return PaginationParams(skip=skip, limit=min(limit, 100))

# Usage
@router.get("/")
async def list_users(
    pagination: PaginationParams = Depends(get_pagination),
    service: UserService = Depends(get_user_service),
):
    return await service.list_users(
        skip=pagination.skip,
        limit=pagination.limit
    )
```

---

## Blocked Patterns

### 1. Direct Instantiation

```python
# BLOCKED
@router.get("/{user_id}")
async def get_user(user_id: int):
    service = UserService()  # Direct instantiation
    return await service.get_user(user_id)
```

### 2. Global Instance

```python
# BLOCKED
user_service = UserService()  # Global instance

@router.get("/{user_id}")
async def get_user(user_id: int):
    return await user_service.get_user(user_id)
```

### 3. Missing Depends()

```python
# BLOCKED
@router.get("/users")
async def get_users(db: AsyncSession):  # Missing Depends()
    return await db.execute(select(User)).scalars().all()
```

### 4. Instantiation Inside Handler

```python
# BLOCKED
@router.get("/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)      # Instantiation in handler
    service = UserService(repo)    # Should use Depends()
    return await service.get_user(user_id)
```

---

## Testing with DI

### Override Dependencies in Tests

```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.routers.deps import get_db, get_user_service

# Mock database session
@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)

# Mock service
@pytest.fixture
def mock_user_service():
    service = Mock(spec=UserService)
    service.get_user = AsyncMock(return_value=User(id=1, email="test@test.com"))
    return service

@pytest.fixture
def client(mock_db, mock_user_service):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    yield TestClient(app)
    app.dependency_overrides.clear()
```

### Test with Dependency Overrides

```python
# tests/test_routers/test_users.py
def test_get_user(client, mock_user_service):
    response = client.get("/users/1")
    assert response.status_code == 200
    mock_user_service.get_user.assert_called_once_with(1)
```

---

## Best Practices

| Practice | Description |
|----------|-------------|
| **Centralize providers** | Keep all `get_*` functions in `deps.py` |
| **Type hints** | Always specify return types for providers |
| **Chain properly** | Services depend on repos, repos depend on db |
| **Avoid global state** | Never use module-level service instances |
| **Use factories** | For parameterized dependencies (permissions) |
| **Test with overrides** | Use `app.dependency_overrides` for mocking |