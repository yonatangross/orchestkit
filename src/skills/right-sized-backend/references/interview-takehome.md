# Scenario 1: Interview Take-Home

**Prompt:** "Build a blog with Jira integration"
**Time budget:** 4-8 hours
**Goal:** Demonstrate competence, not infrastructure mastery

---

## Right-Sized Architecture: Flat Layered

A take-home is not a production system. The evaluator reads your code for 15-30 minutes. They care about:

1. **Does it work?** Can they run it and see results?
2. **Is the code readable?** Clear naming, reasonable structure.
3. **Do you understand the domain?** Blog + Jira integration shows API consumption.
4. **Are there tests?** A few meaningful tests beat 80% coverage of boilerplate.

They do NOT care about:
- Repository pattern
- Domain-driven design
- Event sourcing
- Custom exception hierarchies
- API versioning
- Rate limiting middleware
- Docker Compose with 5 services

## File Tree (Right-Sized: ~400 LOC)

```
blog-jira/
  app/
    main.py              # FastAPI app, lifespan, CORS
    models.py            # SQLAlchemy models (Post, JiraLink)
    schemas.py           # Pydantic request/response schemas
    routes.py            # All routes in one file
    jira_client.py       # Jira API integration
    database.py          # Engine, session, Base
  tests/
    test_api.py          # 5-8 integration tests
  .env.example           # Required environment variables
  requirements.txt       # Dependencies
  README.md              # Setup + run instructions
```

**Total files: 9** (including README and requirements)

### Why This Structure Works

- **One models.py**: You have 2-3 tables. Splitting into `post_model.py` and `jira_link_model.py` adds zero value.
- **One routes.py**: You have 6-8 endpoints. A single file is scannable in 30 seconds.
- **One schemas.py**: Request and response schemas side by side. The evaluator sees the full API contract at a glance.
- **No services layer**: With 2 entities and no complex business rules, the "service" IS the route handler.
- **No repository**: Direct SQLAlchemy queries in route handlers. The evaluator can trace request-to-database in one function.

## Code Examples

### main.py (~30 LOC)

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()

app = FastAPI(title="Blog + Jira", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix="/api")
```

### models.py (~40 LOC)

```python
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    jira_issue_key = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class JiraSync(Base):
    __tablename__ = "jira_syncs"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"))
    jira_key = Column(String(50), nullable=False)
    synced_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String(20), default="synced")
```

### routes.py (~100 LOC)

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Post, JiraSync
from app.schemas import PostCreate, PostResponse, PostList
from app.jira_client import JiraClient

router = APIRouter()

@router.post("/posts", response_model=PostResponse, status_code=201)
async def create_post(data: PostCreate, db: AsyncSession = Depends(get_db)):
    post = Post(title=data.title, content=data.content)

    if data.jira_issue_key:
        # Verify the Jira issue exists
        jira = JiraClient()
        issue = await jira.get_issue(data.jira_issue_key)
        if not issue:
            raise HTTPException(404, f"Jira issue {data.jira_issue_key} not found")
        post.jira_issue_key = data.jira_issue_key

    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post

@router.get("/posts", response_model=list[PostResponse])
async def list_posts(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_post(post_id: int, db: AsyncSession = Depends(get_db)):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "Post not found")
    return post

@router.post("/posts/{post_id}/sync-jira")
async def sync_to_jira(post_id: int, db: AsyncSession = Depends(get_db)):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "Post not found")

    jira = JiraClient()
    issue = await jira.create_issue(
        summary=post.title,
        description=post.content[:500],
    )

    sync = JiraSync(post_id=post.id, jira_key=issue["key"])
    db.add(sync)
    post.jira_issue_key = issue["key"]
    await db.commit()

    return {"jira_key": issue["key"], "url": issue["url"]}
```

### test_api.py (~60 LOC)

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

@pytest.mark.asyncio
async def test_create_post(client):
    response = await client.post("/api/posts", json={
        "title": "Test Post",
        "content": "Hello world",
    })
    assert response.status_code == 201
    assert response.json()["title"] == "Test Post"

@pytest.mark.asyncio
async def test_list_posts(client):
    # Create a post first
    await client.post("/api/posts", json={"title": "A", "content": "B"})
    response = await client.get("/api/posts")
    assert response.status_code == 200
    assert len(response.json()) >= 1

@pytest.mark.asyncio
async def test_get_post_not_found(client):
    response = await client.get("/api/posts/99999")
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_create_post_validation(client):
    response = await client.post("/api/posts", json={})
    assert response.status_code == 422
```

## Over-Engineering Traps

### Trap 1: Repository Pattern (+300 LOC)

```
What you add:
  repositories/
    base_repository.py      # Generic CRUD
    post_repository.py      # Post-specific queries
    jira_sync_repository.py # JiraSync queries

What the evaluator thinks:
  "They wrote 300 lines of abstraction for 2 tables with 3 queries each."
```

**LOC impact:** 300 lines of infrastructure for 6 database queries.
**Value added:** Zero. There is one consumer (the route handler).

### Trap 2: Service Layer (+200 LOC)

```
What you add:
  services/
    post_service.py         # Orchestrates post operations
    jira_service.py         # Wraps Jira client

What the evaluator thinks:
  "These services are pass-through wrappers that add indirection."
```

**LOC impact:** 200 lines of delegation.
**Value added:** Negative. Now the evaluator has to jump between 3 files to understand one operation.

### Trap 3: Domain Exceptions (+100 LOC)

```
What you add:
  exceptions/
    base.py                 # DomainException base class
    post_exceptions.py      # PostNotFoundError, PostValidationError
    jira_exceptions.py      # JiraConnectionError, JiraNotFoundError

What the evaluator thinks:
  "4 custom exception classes for a project with 2 error cases."
```

**LOC impact:** 100 lines of exception hierarchy.
**Value added:** Negative. `raise HTTPException(404)` is perfectly clear for a demo.

### Trap 4: Docker Compose + Infrastructure (+150 LOC config)

```
What you add:
  docker-compose.yml     # Postgres + Redis + app
  Dockerfile             # Multi-stage build
  nginx.conf             # Reverse proxy
  .env                   # 20 environment variables

What the evaluator thinks:
  "I just want to run the app, not manage infrastructure."
```

**LOC impact:** 150 lines of YAML and config.
**Better alternative:** SQLite for the take-home. One `pip install` and `python main.py`.

### Trap 5: Full Auth System (+400 LOC)

```
What you add:
  core/
    security.py           # JWT creation, verification
    auth.py               # Password hashing, token refresh
  middleware/
    auth_middleware.py     # Auth dependency

What the evaluator thinks:
  "They spent 2 hours on auth. The Jira integration is half-done."
```

**Better alternative:** Skip auth entirely, or use a simple API key check:

```python
API_KEY = os.getenv("API_KEY", "demo-key")

async def verify_key(x_api_key: str = Header()):
    if x_api_key != API_KEY:
        raise HTTPException(401)
```

## Right-Sized vs Over-Engineered Comparison

| Aspect | Right-Sized | Over-Engineered |
|--------|-------------|-----------------|
| **Files** | 9 | 25-35 |
| **LOC** | 300-600 | 2,000-4,000 |
| **Setup time** | `pip install -r requirements.txt` | Docker Compose + env setup + migrations |
| **Time to read** | 15 minutes | 45+ minutes |
| **Jira integration** | 80% of effort | 30% of effort |
| **Tests** | 5-8 integration tests | 30+ unit tests mocking everything |
| **Evaluator reaction** | "Clean, focused, works" | "Over-engineered for the scope" |

## What Actually Impresses Evaluators

1. **Working Jira integration** with error handling for API failures
2. **Clear README** with setup instructions that actually work
3. **A few meaningful tests** that prove the integration works
4. **Clean, readable code** without unnecessary abstraction
5. **Thoughtful error messages** for the user (not RFC 9457, just helpful strings)
6. **A brief DECISIONS.md** explaining what you would do differently in production:

```markdown
# Design Decisions

## Architecture
Flat structure chosen for scope. In production I would:
- Add service layer when business rules grow
- Use repository pattern if multiple consumers need the same queries
- Add proper auth (JWT or OAuth)

## Database
SQLite for simplicity. Production would use PostgreSQL with:
- Alembic migrations
- Connection pooling
- Proper indexes

## Jira Integration
Synchronous for demo. Production would:
- Use background tasks (Celery) for sync
- Add retry logic with exponential backoff
- Implement webhook handlers for bidirectional sync
```

This DECISIONS.md shows more architectural maturity than any amount of enterprise scaffolding.
