# Layer Separation Rules

Detailed rules for Router-Service-Repository layer separation in FastAPI Clean Architecture.

---

## Routers Layer (HTTP Only)

Routers should ONLY handle:
- Request parsing and validation
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
    # Database operation in router
    existing = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if existing.scalar():
        raise HTTPException(400, "Email exists")

    # Business logic in router
    user = User(**user_data.dict())
    user.created_at = datetime.now(timezone.utc)
    db.add(user)
    await db.commit()
    return user
```

---

## Services Layer (Business Logic)

Services should:
- Contain business logic and validation
- Orchestrate repositories
- Transform data between layers
- Raise domain exceptions (NOT HTTPException)

```python
# GOOD - Service with business logic
class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def create_user(self, data: UserCreate) -> User:
        if await self.repo.exists_by_email(data.email):
            raise UserAlreadyExistsError(data.email)

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            created_at=datetime.now(timezone.utc),
        )
        return await self.repo.create(user)

# BLOCKED - HTTP concerns in service
class UserService:
    async def create_user(self, data: UserCreate) -> User:
        if await self.repo.exists_by_email(data.email):
            # HTTPException in service - BLOCKED
            raise HTTPException(400, "Email already exists")
```

---

## Repositories Layer (Data Access)

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
            # HTTPException in repository - BLOCKED
            raise HTTPException(404, "User not found")
        return user
```

---

## Exception Handling Pattern

### Domain Exceptions

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

### Router Exception Handler

```python
# app/routers/deps.py
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

---

## Async Consistency Rules

### No Sync Calls in Async Functions

```python
# GOOD - Async all the way
async def get_user(user_id: int) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

# BLOCKED - Sync call in async function
async def get_user(user_id: int) -> User:
    # Missing await - blocks event loop
    result = db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

# For unavoidable sync code, use run_in_executor
async def process_file(file_path: str) -> bytes:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: open(file_path, 'rb').read()
    )
```

---

## Layer Boundaries Summary

| Layer | Allowed | Blocked |
|-------|---------|---------|
| **Router** | HTTP handling, auth checks, calling services | DB operations, business logic |
| **Service** | Business logic, validation, orchestration | HTTPException, Request object |
| **Repository** | DB queries, data persistence | HTTP concerns, business logic |