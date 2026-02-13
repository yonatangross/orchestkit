---
title: "Clean: SOLID & Dependency Inversion"
category: clean
impact: HIGH
impactDescription: SOLID principles create maintainable, testable code through proper abstraction
tags: [solid, single-responsibility, open-closed, liskov, interface-segregation, dependency-inversion]
---

# SOLID Principles in Python

## S - Single Responsibility

```python
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
    async def process(self, amount: Decimal) -> PaymentResult: ...

class PayPalProcessor:
    async def process(self, amount: Decimal) -> PaymentResult: ...
```

## I - Interface Segregation

```python
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
class IAnalysisRepository(Protocol):
    async def get_by_id(self, id: str) -> Analysis | None: ...

class AnalysisService:
    def __init__(self, repo: IAnalysisRepository):
        self._repo = repo  # Depends on abstraction

def get_analysis_service(db: AsyncSession = Depends(get_db)) -> AnalysisService:
    repo = PostgresAnalysisRepository(db)
    return AnalysisService(repo)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Protocol vs ABC | Protocol (structural typing) |
| Dataclass vs Pydantic | Dataclass for domain, Pydantic for API |
