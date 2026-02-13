---
title: "Clean Architecture: SOLID Principles & Dependency Rule"
category: clean-architecture
impact: HIGH
---

# SOLID Principles & Dependency Rule

Python implementations of SOLID principles using Protocol-based structural typing.

## S - Single Responsibility

```python
# BAD: One class doing everything
class UserManager:
    def create_user(self, data): ...
    def send_welcome_email(self, user): ...
    def generate_report(self, users): ...

# GOOD: Separate responsibilities
class UserService:
    def create_user(self, data: UserCreate) -> User: ...

class EmailService:
    def send_welcome(self, user: User) -> None: ...

class ReportService:
    def generate_user_report(self, users: list[User]) -> Report: ...
```

## O - Open/Closed (Protocol-based)

```python
from typing import Protocol

class PaymentProcessor(Protocol):
    async def process(self, amount: Decimal) -> PaymentResult: ...

class StripeProcessor:
    async def process(self, amount: Decimal) -> PaymentResult:
        # Stripe implementation
        ...

class PayPalProcessor:
    async def process(self, amount: Decimal) -> PaymentResult:
        # PayPal implementation - extends without modifying
        ...
```

## L - Liskov Substitution

```python
# Any implementation of Repository can substitute another
class IUserRepository(Protocol):
    async def get_by_id(self, id: str) -> User | None: ...
    async def save(self, user: User) -> User: ...

class PostgresUserRepository:
    async def get_by_id(self, id: str) -> User | None: ...
    async def save(self, user: User) -> User: ...

class InMemoryUserRepository:  # For testing - fully substitutable
    async def get_by_id(self, id: str) -> User | None: ...
    async def save(self, user: User) -> User: ...
```

## I - Interface Segregation

```python
# BAD: Fat interface
class IRepository(Protocol):
    async def get(self, id: str): ...
    async def save(self, entity): ...
    async def delete(self, id: str): ...
    async def search(self, query: str): ...
    async def bulk_insert(self, entities): ...

# GOOD: Segregated interfaces
class IReader(Protocol):
    async def get(self, id: str) -> T | None: ...

class IWriter(Protocol):
    async def save(self, entity: T) -> T: ...

class ISearchable(Protocol):
    async def search(self, query: str) -> list[T]: ...
```

## D - Dependency Inversion

```python
from typing import Protocol
from fastapi import Depends

class IAnalysisRepository(Protocol):
    async def get_by_id(self, id: str) -> Analysis | None: ...

class AnalysisService:
    def __init__(self, repo: IAnalysisRepository):
        self._repo = repo  # Depends on abstraction, not concrete

# FastAPI DI
def get_analysis_service(
    db: AsyncSession = Depends(get_db)
) -> AnalysisService:
    repo = PostgresAnalysisRepository(db)
    return AnalysisService(repo)
```

## Dependency Rule

Dependencies always point inward. The domain layer has zero external dependencies.

```
Infrastructure -> Application -> Domain
      |               |           |
  (knows about)  (knows about)  (knows nothing external)
```

### What Each Layer Knows

| Layer | Can Import | Cannot Import |
|-------|-----------|---------------|
| Domain | Python stdlib only | Application, Infrastructure, Frameworks |
| Application | Domain | Infrastructure, Frameworks |
| Infrastructure | Application, Domain | (can import everything above) |

### FastAPI Dependency Injection Chain

```python
# deps.py - Wire everything together at the composition root
def get_user_repository(
    db: AsyncSession = Depends(get_db),
) -> UserRepository:
    return UserRepository(db)

def get_user_service(
    repo: UserRepository = Depends(get_user_repository),
) -> UserService:
    return UserService(repo)

# router_users.py - Only knows about service interface
@router.get("/{user_id}")
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
):
    return await service.get_user(user_id)
```

## Key Decisions

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Protocol vs ABC | Protocol | Structural typing, no inheritance needed |
| Dataclass vs Pydantic | Dataclass for domain, Pydantic for API | Domain stays framework-free |
| Where to wire DI | `deps.py` (composition root) | Single location for all wiring |
| How to test | Override `Depends()` | FastAPI's `app.dependency_overrides` |
