---
title: Ensure database layer correctness through isolated integration tests with fresh state
category: integration
impact: HIGH
impactDescription: "Ensures database layer correctness through isolated integration tests with fresh state per test"
tags: database, integration, sqlalchemy, isolation, test-containers
---

# Database Integration Testing

## Test Database Setup (Python)

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture(scope="function")
def db_session():
    """Fresh database per test."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    Base.metadata.drop_all(engine)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Database | In-memory SQLite or test container |
| Execution | < 1s per test |
| External APIs | MSW (frontend), VCR.py (backend) |
| Cleanup | Fresh state per test |

## Common Mistakes

- Shared test database state
- No transaction rollback
- Testing against production APIs
- Slow setup/teardown

**Incorrect — Shared database state across tests:**
```python
engine = create_engine("sqlite:///test.db")  # File-based, persistent

def test_create_user():
    session.add(User(email="test@example.com"))
    # Leaves data behind for next test
```

**Correct — Fresh in-memory database per test:**
```python
@pytest.fixture(scope="function")
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
```
