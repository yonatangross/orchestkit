---
title: "Integration: Database Testing"
category: integration
impact: HIGH
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
