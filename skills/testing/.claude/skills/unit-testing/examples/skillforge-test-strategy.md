# SkillForge Testing Strategy

## Overview

SkillForge uses a comprehensive testing strategy with a focus on **unit tests** for fast feedback, **integration tests** for API contracts, and **golden dataset testing** for retrieval quality.

**Testing Pyramid:**
```
        /\
       /E2E\         5% - Critical user flows
      /______\
     /        \
    /Integration\ 25% - API contracts, database queries
   /____________\
  /              \
 /  Unit Tests    \ 70% - Business logic, utilities
/__________________\
```

---

## Tech Stack

| Layer | Framework | Purpose |
|-------|-----------|---------|
| **Backend** | pytest 9.0.1 | Unit & integration tests |
| **Frontend** | Vitest + React Testing Library | Component & hook tests |
| **E2E** | Playwright (future) | Critical user flows |
| **Coverage** | pytest-cov, Vitest coverage | Track test coverage |
| **Fixtures** | pytest-asyncio | Async test support |
| **Mocking** | unittest.mock, pytest-mock | Isolated unit tests |

---

## Coverage Targets

### Backend (Python)

| Module | Target | Current | Priority |
|--------|--------|---------|----------|
| **Workflows** | 90% | 92% | High |
| **API Routes** | 85% | 88% | High |
| **Services** | 80% | 83% | Medium |
| **Repositories** | 85% | 90% | High |
| **Utilities** | 75% | 78% | Low |
| **Database Models** | 60% | 65% | Low |

**Run coverage:**
```bash
cd backend
poetry run pytest tests/unit/ --cov=app --cov-report=term-missing --cov-report=html
open htmlcov/index.html
```

### Frontend (TypeScript)

| Module | Target | Current | Priority |
|--------|--------|---------|----------|
| **Hooks** | 85% | 72% | High |
| **Utils** | 80% | 68% | Medium |
| **Components** | 70% | 55% | Medium |
| **API Clients** | 90% | 80% | High |

**Run coverage:**
```bash
cd frontend
npm run test:coverage
open coverage/index.html
```

---

## Test Structure

### Backend Test Organization

```
backend/tests/
├── conftest.py                 # Global fixtures (db_session, requires_llm, etc.)
├── unit/                       # Unit tests (70% of tests)
│   ├── api/
│   │   └── v1/
│   │       ├── test_analysis.py
│   │       ├── test_artifacts.py
│   │       └── test_library.py
│   ├── services/
│   │   ├── search/
│   │   │   └── test_search_service.py  # Hybrid search logic
│   │   ├── embeddings/
│   │   │   └── test_embeddings_service.py
│   │   └── cache/
│   │       └── test_redis_connection.py
│   ├── workflows/
│   │   ├── test_supervisor_node.py
│   │   ├── test_quality_gate_node.py
│   │   └── agents/
│   │       └── test_security_agent.py
│   ├── evaluation/
│   │   ├── test_quality_evaluator.py  # G-Eval tests
│   │   └── test_retrieval_evaluator.py  # Golden dataset tests
│   └── shared/
│       └── services/
│           └── cache/
│               └── test_redis_connection.py
├── integration/               # Integration tests (25% of tests)
│   ├── conftest.py            # Integration-specific fixtures
│   ├── test_analysis_workflow.py  # Full LangGraph pipeline
│   ├── test_hybrid_search.py      # Database + embeddings
│   └── test_artifact_generation.py
└── e2e/                      # E2E tests (5% of tests, future)
    └── test_user_journeys.py
```

### Frontend Test Organization

```
frontend/src/
├── __tests__/
│   ├── setup.ts               # Test environment setup
│   └── utils/
│       └── test-utils.tsx     # Custom render helpers
├── features/
│   ├── analysis/
│   │   └── __tests__/
│   │       ├── AnalysisProgressCard.test.tsx
│   │       └── useAnalysisStatus.test.ts  # Custom hook
│   ├── library/
│   │   └── __tests__/
│   │       ├── LibraryGrid.test.tsx
│   │       └── useLibrarySearch.test.ts
│   └── tutor/
│       └── __tests__/
│           └── TutorInterface.test.tsx
└── lib/
    └── __tests__/
        ├── api-client.test.ts
        └── markdown-utils.test.ts
```

---

## Mock Strategies

### LLM Call Mocking

**Problem:** LLM calls are expensive, slow, and non-deterministic.

**Solution:** Mock LLM responses for unit tests, use real LLMs for integration tests.

```python
# backend/tests/unit/workflows/test_supervisor_node.py
from unittest.mock import patch, MagicMock
import pytest

@pytest.fixture
def mock_llm_response():
    """Mock Claude/Gemini response for unit tests."""
    return {
        "content": [{"text": "Security finding: XSS vulnerability in input validation"}],
        "usage": {"input_tokens": 500, "output_tokens": 100}
    }

def test_security_agent_node(mock_llm_response):
    """Test security agent without real LLM calls."""
    with patch("anthropic.Anthropic") as mock_anthropic:
        # Configure mock
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_llm_response
        mock_anthropic.return_value = mock_client

        # Test agent
        state = {"raw_content": "test content", "agents_completed": []}
        result = security_agent_node(state)

        assert len(result["findings"]) > 0
        assert "security_agent" in result["agents_completed"]
        mock_client.messages.create.assert_called_once()
```

**Integration tests use real LLMs:**
```python
# backend/tests/integration/test_analysis_workflow.py
import pytest

@pytest.mark.integration  # Marker for integration tests
@pytest.mark.requires_llm  # Skip if LLM not configured
async def test_full_analysis_pipeline(db_session):
    """Test full analysis with real LLM calls."""
    # Uses real Claude/Gemini API
    workflow = create_analysis_workflow()
    result = await workflow.ainvoke(initial_state)

    assert result["quality_passed"] is True
    assert len(result["findings"]) >= 8  # All agents ran
```

### Database Mocking

**Unit tests:** Mock database queries for speed.

```python
# backend/tests/unit/api/v1/test_artifacts.py
from unittest.mock import AsyncMock, patch
import pytest

@pytest.mark.asyncio
async def test_get_artifact_by_id():
    """Test artifact retrieval without database."""
    with patch("app.db.repositories.artifact_repository.ArtifactRepository") as mock_repo:
        # Mock repository method
        mock_repo.return_value.get_by_id = AsyncMock(return_value={
            "id": "123",
            "content": "# Test Artifact",
            "format": "markdown"
        })

        response = await client.get("/api/v1/artifacts/123")
        assert response.status_code == 200
        assert response.json()["format"] == "markdown"
```

**Integration tests:** Use real database with automatic rollback.

```python
# backend/tests/integration/test_artifact_generation.py
@pytest.mark.asyncio
async def test_create_artifact(db_session):
    """Test artifact creation with real database."""
    # db_session auto-rolls back after test (see conftest.py)
    artifact = Artifact(
        id="test-123",
        content="# Test",
        format="markdown"
    )
    db_session.add(artifact)
    await db_session.commit()

    # Query to verify
    result = await db_session.execute(
        select(Artifact).where(Artifact.id == "test-123")
    )
    assert result.scalar_one().content == "# Test"
    # Auto-rolled back after test ends
```

### Redis Cache Mocking

```python
# backend/tests/unit/services/cache/test_redis_connection.py
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

@pytest.fixture
def mock_redis():
    """Mock Redis client for unit tests."""
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=None)
    mock_client.set = AsyncMock(return_value=True)
    mock_client.ping = AsyncMock(return_value=True)
    return mock_client

@pytest.mark.asyncio
async def test_cache_get_miss(mock_redis):
    """Test cache miss without real Redis."""
    with patch("redis.asyncio.from_url", return_value=mock_redis):
        cache = RedisConnection()
        result = await cache.get("missing-key")

        assert result is None
        mock_redis.get.assert_called_once_with("missing-key")
```

---

## Golden Dataset Testing

SkillForge uses a **golden dataset** of 98 curated documents for retrieval quality testing.

### Dataset Composition

```python
# backend/data/golden_dataset_backup.json
{
  "metadata": {
    "version": "2.0",
    "total_analyses": 98,
    "total_artifacts": 98,
    "total_chunks": 415,
    "content_types": {
      "article": 76,
      "tutorial": 19,
      "research_paper": 3
    }
  },
  "analyses": [
    {
      "id": "uuid-1",
      "url": "https://blog.langchain.dev/langgraph-multi-agent/",
      "content_type": "article",
      "title": "LangGraph Multi-Agent Systems",
      "status": "completed"
    },
    // ... 97 more
  ]
}
```

### Retrieval Evaluation

**Goal:** Ensure hybrid search (BM25 + vector) retrieves relevant chunks.

```python
# backend/tests/unit/evaluation/test_retrieval_evaluator.py
import pytest
from app.evaluation.retrieval_evaluator import RetrievalEvaluator

@pytest.mark.asyncio
async def test_retrieval_quality(db_session):
    """Test retrieval against golden dataset."""
    evaluator = RetrievalEvaluator(db_session)

    # Test queries with known relevant chunks
    test_cases = [
        {
            "query": "How to use LangGraph agents?",
            "expected_chunks": ["uuid-chunk-1", "uuid-chunk-2"],
            "top_k": 5
        },
        {
            "query": "FastAPI async endpoints",
            "expected_chunks": ["uuid-chunk-10"],
            "top_k": 3
        }
    ]

    results = await evaluator.evaluate_queries(test_cases)

    # Metrics
    assert results["precision@5"] >= 0.80  # 80%+ precision
    assert results["mrr"] >= 0.70          # 70%+ MRR (Mean Reciprocal Rank)
    assert results["recall@5"] >= 0.85     # 85%+ recall
```

**Current Performance (Dec 2025):**
- **Precision@5:** 91.6% (186/203 expected chunks in top-5)
- **MRR (Hard):** 0.686 (average rank 1.46 for first relevant result)
- **Coverage:** 100% (all queries return results)

### Dataset Backup & Restore

```bash
# Backup golden dataset (includes embeddings metadata, not actual vectors)
cd backend
poetry run python scripts/backup_golden_dataset.py backup

# Verify backup integrity
poetry run python scripts/backup_golden_dataset.py verify

# Restore from backup (regenerates embeddings)
poetry run python scripts/backup_golden_dataset.py restore --replace
```

**Why backup?**
- Protects against accidental data loss
- Enables new dev environment setup
- Version-controlled in git (`backend/data/golden_dataset_backup.json`)
- Faster than re-analyzing 98 URLs

---

## Test Fixtures

### Global Fixtures (conftest.py)

```python
# backend/tests/conftest.py

@pytest_asyncio.fixture
async def db_session(requires_database, reset_engine_connections) -> AsyncSession:
    """Create test database session with auto-rollback.

    All database changes are rolled back after test.
    """
    session = await get_test_session(timeout=2.0)
    transaction = await session.begin()

    try:
        yield session
    finally:
        if transaction.is_active:
            await transaction.rollback()
        await session.close()

@pytest.fixture
def requires_llm():
    """Skip test if LLM API key not configured.

    Checks for appropriate API key based on LLM_MODEL:
    - Gemini models → GOOGLE_API_KEY
    - OpenAI models → OPENAI_API_KEY
    """
    settings = get_settings()
    if not settings.LLM_MODEL:
        pytest.skip("LLM_MODEL not configured")

    provider = settings.resolved_llm_provider()
    api_field = LLM_PROVIDER_API_FIELDS.get(provider)
    api_key = getattr(settings, api_field, None)

    if not api_key:
        pytest.skip(f"{api_field} not available")

@pytest.fixture
def mock_async_session_local():
    """Mock AsyncSessionLocal for unit tests without database."""
    mock_session = MagicMock()
    mock_session.configure_mock(**{
        "__aenter__": AsyncMock(return_value=mock_session),
        "__aexit__": AsyncMock(return_value=False),
    })
    return MagicMock(return_value=mock_session)
```

### Feature-Specific Fixtures

```python
# backend/tests/unit/workflows/conftest.py

@pytest.fixture
def sample_analysis_state():
    """Sample AnalysisState for workflow tests."""
    return {
        "analysis_id": "test-123",
        "url": "https://example.com",
        "raw_content": "Test content...",
        "content_type": "article",
        "findings": [],
        "agents_completed": [],
        "next_node": "supervisor",
        "quality_score": 0.0,
        "quality_passed": False,
        "retry_count": 0,
    }

@pytest.fixture
def mock_langfuse_context():
    """Mock Langfuse observability context."""
    with patch("langfuse.decorators.langfuse_context") as mock:
        mock.update_current_observation = MagicMock()
        yield mock
```

---

## Running Tests

### Backend

```bash
cd backend

# Run all unit tests (fast, ~30 seconds)
poetry run pytest tests/unit/ -v

# Run specific test file
poetry run pytest tests/unit/api/v1/test_artifacts.py -v

# Run tests matching pattern
poetry run pytest -k "test_search" -v

# Run with coverage report
poetry run pytest tests/unit/ --cov=app --cov-report=term-missing

# Run integration tests (requires database, LLM keys)
poetry run pytest tests/integration/ -v --tb=short

# Run tests with live output (see progress)
poetry run pytest tests/unit/ -v 2>&1 | tee /tmp/test_results.log | grep -E "(PASSED|FAILED)" | tail -50
```

### Frontend

```bash
cd frontend

# Run all tests
npm run test

# Run in watch mode (auto-rerun on changes)
npm run test:watch

# Run specific test file
npm run test src/features/analysis/__tests__/AnalysisProgressCard.test.tsx

# Run with coverage
npm run test:coverage
```

### Pre-Commit Checks

**ALWAYS run before committing:**

```bash
# Backend
cd backend
poetry run ruff format --check app/   # Format check
poetry run ruff check app/            # Lint check
poetry run ty check app/ --exclude "app/evaluation/*"  # Type check

# Frontend
cd frontend
npm run lint          # ESLint + Biome
npm run typecheck     # TypeScript check
```

---

## Test Markers

### Backend Markers

```python
# backend/pytest.ini (or pyproject.toml)
[tool.pytest.ini_options]
markers = [
    "unit: Unit tests (fast, no external dependencies)",
    "integration: Integration tests (database, real APIs)",
    "smoke: Smoke tests (critical user flows with real services)",
    "requires_llm: Tests that need LLM API keys",
    "slow: Slow tests (>5 seconds)",
]

# Usage
@pytest.mark.unit
def test_parse_findings():
    """Fast unit test."""
    pass

@pytest.mark.integration
@pytest.mark.requires_llm
async def test_full_workflow(db_session):
    """Integration test with real LLM and database."""
    pass
```

**Run by marker:**
```bash
# Only unit tests
pytest -m unit

# Skip slow tests
pytest -m "not slow"

# Integration tests only
pytest -m integration
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg18
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5437:5432

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install poetry
          poetry install

      - name: Run unit tests
        run: |
          cd backend
          poetry run pytest tests/unit/ --cov=app --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage.xml

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Run tests
        run: |
          cd frontend
          npm run test:coverage
```

---

## Quality Gates

### Coverage Thresholds

```toml
# backend/pyproject.toml
[tool.coverage.run]
source = ["app"]
omit = [
    "*/tests/*",
    "*/migrations/*",
    "*/__init__.py",
]

[tool.coverage.report]
fail_under = 75  # Fail if coverage drops below 75%
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
]
```

### Lint Enforcement

```bash
# backend/.pre-commit-config.yaml (future)
repos:
  - repo: local
    hooks:
      - id: ruff-format
        name: Ruff Format
        entry: poetry run ruff format --check
        language: system
        types: [python]
        pass_filenames: false

      - id: ruff-lint
        name: Ruff Lint
        entry: poetry run ruff check
        language: system
        types: [python]
        pass_filenames: false
```

---

## Performance Testing

### Load Testing (Future)

```python
# backend/tests/performance/test_search_load.py
import pytest
from locust import HttpUser, task, between

class SearchLoadTest(HttpUser):
    wait_time = between(1, 3)

    @task
    def search_query(self):
        self.client.get("/api/v1/library/search?q=LangGraph")

# Run with Locust
# locust -f tests/performance/test_search_load.py --users 100 --spawn-rate 10
```

### Database Query Optimization

```python
# backend/tests/unit/db/test_query_performance.py
import pytest
import time

@pytest.mark.asyncio
async def test_hybrid_search_performance(db_session):
    """Ensure hybrid search completes in <200ms."""
    start = time.perf_counter()

    results = await search_service.hybrid_search(
        query="FastAPI async patterns",
        top_k=10
    )

    elapsed = time.perf_counter() - start

    assert elapsed < 0.2  # 200ms threshold
    assert len(results) > 0
```

---

## References

- **Backend Tests:** `backend/tests/`
- **Frontend Tests:** `frontend/src/__tests__/`
- **Golden Dataset:** `backend/data/golden_dataset_backup.json`
- **Pytest Docs:** https://docs.pytest.org/
- **Vitest Docs:** https://vitest.dev/
- **Testing Library:** https://testing-library.com/
