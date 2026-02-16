---
title: "Data: Seeding & Cleanup"
category: data
impact: MEDIUM
impactDescription: "Ensures test isolation through automated database seeding and cleanup between test runs"
tags: database, seeding, cleanup, isolation, fixtures
---

# Database Seeding and Cleanup

## Seeding

```python
async def seed_test_database(db: AsyncSession):
    users = [
        UserFactory.build(email=f"user{i}@test.com")
        for i in range(10)
    ]
    db.add_all(users)

    for user in users:
        analyses = [
            AnalysisFactory.build(user_id=user.id)
            for _ in range(5)
        ]
        db.add_all(analyses)

    await db.commit()

@pytest.fixture
async def seeded_db(db_session):
    await seed_test_database(db_session)
    yield db_session
```

## Automatic Cleanup

```python
@pytest.fixture(autouse=True)
async def clean_database(db_session):
    """Reset database between tests."""
    yield
    await db_session.execute("TRUNCATE users, analyses CASCADE")
    await db_session.commit()
```

## Common Mistakes

- Shared state between tests
- Hard-coded IDs (conflicts)
- No cleanup after tests
- Over-complex fixtures
