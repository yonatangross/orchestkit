# OrchestKit Golden Dataset Workflow

**Complete backup/restore/validation workflow for OrchestKit's 98-document golden dataset**

---

## Overview

OrchestKit maintains a **golden dataset** of 98 curated technical documents with embeddings for testing retrieval quality. This dataset is the source of truth for:

- Regression testing (ensure new code doesn't break retrieval)
- Retrieval evaluation (measure precision, recall, MRR)
- Model benchmarking (compare different embedding models)
- Environment seeding (new dev environments, CI/CD)

**Key Files:**
- **Backup Script:** `/Users/yonatangross/coding/OrchestKit/backend/scripts/backup_golden_dataset.py`
- **JSON Backup:** `/Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_backup.json` (version controlled)
- **Metadata:** `/Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_metadata.json` (quick stats)
- **Fixtures:** `/Users/yonatangross/coding/OrchestKit/backend/tests/smoke/retrieval/fixtures/` (source documents, queries)

---

## Dataset Stats

**Current (Production):**
- **98 Analyses** (completed content analyses)
- **415 Chunks** (embedded text segments)
- **203 Test Queries** (with expected results)
- **91.6% Pass Rate** (retrieval quality metric)

**Content Mix:**
- 76 articles (tutorials, guides, blog posts)
- 19 technical documentation pages
- 3 research papers

**Topics Covered:**
- RAG (Retrieval-Augmented Generation)
- LangGraph workflows
- Prompt engineering
- API design
- Testing strategies
- Performance optimization
- Security best practices

---

## URL Contract (CRITICAL)

**The Rule:** Golden dataset analyses MUST store **real canonical URLs**, not placeholders.

**Why this matters:**
- Enables re-fetching content if embeddings need regeneration
- Allows validation that source content hasn't changed
- Provides audit trail for data provenance
- Ensures backup/restore actually works

**Validation:**
```bash
cd /Users/yonatangross/coding/OrchestKit/backend

# Check for placeholder URLs (should return 0)
poetry run python scripts/backup_golden_dataset.py verify | grep "placeholder URLs"
# Expected: "0 analyses with placeholder URLs"
```

**Invalid URLs (will break restore):**
- `https://docs.orchestkit.dev/placeholder/123`
- `https://learn.orchestkit.dev/fake-content`
- `https://content.orchestkit.dev/test`

**Valid URLs:**
- `https://docs.python.org/3/library/asyncio.html`
- `https://blog.langchain.dev/langgraph-multi-agent-workflows/`
- `https://python.langchain.com/docs/modules/data_connection/retrievers/`

---

## Workflow 1: Backup Golden Dataset

**When to run:**
- After adding new documents to golden dataset
- Before major database migrations
- Weekly automated backup (via GitHub Actions)
- Before deploying to production

### Step 1: Pre-Backup Validation

```bash
cd /Users/yonatangross/coding/OrchestKit/backend

# Check database connection
psql -h localhost -p 5437 -U orchestkit -c "SELECT COUNT(*) FROM analyses WHERE status = 'completed';"
# Expected: 98

# Verify URL contract
psql -h localhost -p 5437 -U orchestkit -c \
  "SELECT COUNT(*) FROM analyses WHERE url LIKE '%orchestkit.dev%';"
# Expected: 0 (no placeholder URLs)
```

### Step 2: Run Backup

```bash
cd /Users/yonatangross/coding/OrchestKit/backend

# Create backup (includes fixtures in v2.0)
poetry run python scripts/backup_golden_dataset.py backup

# Output:
# ============================================================
# BACKUP COMPLETE (v2.0)
# ============================================================
#    Analyses:  98
#    Artifacts: 98
#    Chunks:    415
#    Fixtures:  98 documents
#    URL Maps:  98 mappings
#    Queries:   203 test queries
#    Location:  /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_backup.json
# ============================================================
```

### Step 3: Verify Backup

```bash
# Run verification
poetry run python scripts/backup_golden_dataset.py verify

# Output:
# ============================================================
# BACKUP VERIFICATION
# ============================================================
#    File: /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_backup.json
#    Created: 2025-12-21T10:30:00Z
#    Version: 2.0
#
#    Counts:
#      Analyses:  98 (expected: 98)
#      Artifacts: 98 (expected: 98)
#      Chunks:    415 (expected: 415)
#
#    Fixtures:
#      Documents: 98
#      URL Maps:  98
#      Queries:   203
#
#    Referential Integrity: OK
#    All analyses have artifacts: OK
# ============================================================
# BACKUP IS VALID
# ============================================================
```

### Step 4: Commit to Git

```bash
# Stage backup files
git add backend/data/golden_dataset_backup.json
git add backend/data/golden_dataset_metadata.json

# Commit with descriptive message
git commit -m "chore: golden dataset backup (98 analyses, 415 chunks)

- Backup version: 2.0 (includes fixtures)
- Added 5 new LangGraph tutorial analyses
- Updated 2 outdated React documentation analyses
- Pass rate: 91.6% (186/203 queries)"

# Push to remote
git push origin main
```

---

## Workflow 2: Restore Golden Dataset

**When to run:**
- Setting up new development environment
- Recovering from accidental data deletion
- Seeding CI/CD test database
- Testing migration scripts

### Step 1: Pre-Restore Checks

```bash
cd /Users/yonatangross/coding/OrchestKit/backend

# Ensure backup exists
ls -lh data/golden_dataset_backup.json
# Expected: ~2.5 MB file

# Verify backup integrity
poetry run python scripts/backup_golden_dataset.py verify
# Expected: "BACKUP IS VALID"

# Check database is empty (or ready to replace)
psql -h localhost -p 5437 -U orchestkit -c "SELECT COUNT(*) FROM analyses;"
# If > 0 and you want to replace, use --replace flag
```

### Step 2: Run Restore

**Option A: Add to existing data (no deletion)**
```bash
poetry run python scripts/backup_golden_dataset.py restore

# This will:
# 1. Load backup
# 2. Insert analyses (ON CONFLICT DO NOTHING)
# 3. Insert artifacts (ON CONFLICT DO NOTHING)
# 4. Regenerate embeddings for chunks
# 5. Insert chunks (ON CONFLICT DO NOTHING)
```

**Option B: Replace existing data (DESTRUCTIVE)**
```bash
# WARNING: This deletes ALL existing analyses, artifacts, and chunks
poetry run python scripts/backup_golden_dataset.py restore --replace

# This will:
# 1. DELETE FROM analysis_chunks
# 2. DELETE FROM artifacts
# 3. DELETE FROM analyses
# 4. Restore from backup (with regenerated embeddings)
```

### Step 3: Monitor Restore Progress

```bash
# Restore output:
# Loaded backup from: /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_backup.json
# Backup version: 2.0
# Backup created: 2025-12-19T10:30:00Z
# Restoring 98 analyses...
# Restoring 98 artifacts...
# Restoring 415 chunks (regenerating embeddings)...
#   Restored 50/415 chunks
#   Restored 100/415 chunks
#   Restored 150/415 chunks
#   Restored 200/415 chunks
#   Restored 250/415 chunks
#   Restored 300/415 chunks
#   Restored 350/415 chunks
#   Restored 400/415 chunks
#   Restored 415/415 chunks
#
# ============================================================
# RESTORE COMPLETE
# ============================================================
#    Analyses:  98
#    Artifacts: 98
#    Chunks:    415
# ============================================================
```

### Step 4: Verify Restore

```bash
# Check counts
psql -h localhost -p 5437 -U orchestkit -c \
  "SELECT COUNT(*) FROM analyses WHERE status = 'completed';"
# Expected: 98

psql -h localhost -p 5437 -U orchestkit -c "SELECT COUNT(*) FROM artifacts;"
# Expected: 98

psql -h localhost -p 5437 -U orchestkit -c "SELECT COUNT(*) FROM analysis_chunks;"
# Expected: 415

# Check embeddings generated
psql -h localhost -p 5437 -U orchestkit -c \
  "SELECT COUNT(*) FROM analysis_chunks WHERE vector IS NULL;"
# Expected: 0 (all chunks should have embeddings)

# Run retrieval quality tests
poetry run pytest tests/smoke/retrieval/test_retrieval_quality.py -v

# Expected output:
# test_query_langchain_agent_memory PASSED
# test_query_rag_chunking_strategies PASSED
# test_query_prompt_engineering_basics PASSED
# ...
# 186 passed, 17 failed (91.6% pass rate)
```

---

## Workflow 3: Expand Golden Dataset

**When to run:**
- Adding new technical content for better coverage
- Improving retrieval quality for specific topics
- Testing new embedding models

### Step 1: Prepare Source Documents

```bash
cd /Users/yonatangross/coding/OrchestKit/backend/tests/smoke/retrieval/fixtures

# Edit documents_expanded.json to add new documents
# Example:
{
  "version": "2.0",
  "generated": "2025-12-21",
  "source": "Manual expansion",
  "documents": [
    {
      "id": "langgraph-streaming-guide",
      "source_url": "https://blog.langchain.dev/streaming-in-langgraph/",
      "content_type": "tutorial",
      "title": "Streaming in LangGraph: A Complete Guide",
      "content": "...",
      "metadata": {
        "author": "LangChain Team",
        "published_date": "2025-11-15"
      }
    }
  ]
}
```

### Step 2: Add Test Queries

```bash
# Edit queries.json to add test queries for new content
{
  "version": "1.1",
  "generated": "2025-12-21",
  "queries": [
    {
      "id": "q-langgraph-streaming-1",
      "query": "How do I stream outputs in LangGraph?",
      "expected_chunks": ["langgraph-streaming-guide-chunk-0"],
      "difficulty": "medium",
      "category": "implementation"
    }
  ]
}
```

### Step 3: Run Fixture Loader

```bash
cd /Users/yonatangross/coding/OrchestKit/backend

# Load new fixtures into database
poetry run python tests/smoke/retrieval/load_fixtures.py

# This will:
# 1. Load documents_expanded.json
# 2. Create analyses for each document
# 3. Generate chunks with embeddings
# 4. Create artifacts
# 5. Store in PostgreSQL
```

### Step 4: Validate New Data

```bash
# Run retrieval quality tests
poetry run pytest tests/smoke/retrieval/test_retrieval_quality.py -v

# Check for new query test
# Expected: test_query_langgraph_streaming_1 PASSED

# Verify new document in database
psql -h localhost -p 5437 -U orchestkit -c \
  "SELECT title FROM analyses WHERE url = 'https://blog.langchain.dev/streaming-in-langgraph/';"
# Expected: "Streaming in LangGraph: A Complete Guide"
```

### Step 5: Create New Backup

```bash
# Backup expanded dataset
poetry run python scripts/backup_golden_dataset.py backup

# Verify backup includes new content
poetry run python scripts/backup_golden_dataset.py verify

# Expected output shows increased counts:
#    Analyses:  99 (was 98)
#    Chunks:    420 (was 415)
#    Queries:   204 (was 203)

# Commit to git
git add backend/data/golden_dataset_backup.json
git add backend/tests/smoke/retrieval/fixtures/documents_expanded.json
git add backend/tests/smoke/retrieval/fixtures/queries.json

git commit -m "feat: expand golden dataset with LangGraph streaming guide

- Added 1 new analysis (LangGraph streaming)
- Added 5 new chunks
- Added 1 new test query
- Total: 99 analyses, 420 chunks, 204 queries"
```

---

## Workflow 4: CI/CD Integration

**Automated weekly backup via GitHub Actions**

### GitHub Actions Workflow

**File:** `/Users/yonatangross/coding/OrchestKit/.github/workflows/backup-golden-dataset.yml`

```yaml
name: Backup Golden Dataset

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2am UTC
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install Poetry
        run: |
          curl -sSL https://install.python-poetry.org | python3 -
          echo "$HOME/.local/bin" >> $GITHUB_PATH

      - name: Install dependencies
        run: |
          cd backend
          poetry install --no-root

      - name: Setup PostgreSQL
        run: |
          docker run -d \
            --name postgres \
            -e POSTGRES_USER=orchestkit \
            -e POSTGRES_PASSWORD=orchestkit \
            -e POSTGRES_DB=orchestkit \
            -p 5437:5432 \
            pgvector/pgvector:pg16

          # Wait for PostgreSQL to be ready
          sleep 10

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://orchestkit:orchestkit@localhost:5437/orchestkit
        run: |
          cd backend
          poetry run alembic upgrade head

      - name: Restore current backup (to have data to backup)
        env:
          DATABASE_URL: postgresql://orchestkit:orchestkit@localhost:5437/orchestkit
        run: |
          cd backend
          poetry run python scripts/backup_golden_dataset.py restore

      - name: Create fresh backup
        env:
          DATABASE_URL: postgresql://orchestkit:orchestkit@localhost:5437/orchestkit
        run: |
          cd backend
          poetry run python scripts/backup_golden_dataset.py backup

      - name: Verify backup
        run: |
          cd backend
          poetry run python scripts/backup_golden_dataset.py verify

      - name: Commit backup
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add backend/data/golden_dataset_backup.json
          git add backend/data/golden_dataset_metadata.json
          git diff-index --quiet HEAD || git commit -m "chore: automated golden dataset backup [skip ci]"
          git push
```

### Manual CI Trigger

```bash
# Trigger workflow manually
gh workflow run backup-golden-dataset.yml

# Check workflow status
gh run list --workflow=backup-golden-dataset.yml

# View logs
gh run view --log
```

---

## Workflow 5: Disaster Recovery

**Scenario: Accidental DELETE FROM analyses WHERE 1=1**

### Recovery Steps

```bash
# Step 1: Stop all database writes immediately
docker compose stop backend

# Step 2: Verify backup exists
cd /Users/yonatangross/coding/OrchestKit/backend
ls -lh data/golden_dataset_backup.json
# Expected: ~2.5 MB file modified recently

# Step 3: Verify backup integrity
poetry run python scripts/backup_golden_dataset.py verify
# Expected: "BACKUP IS VALID"

# Step 4: Restore from backup
poetry run python scripts/backup_golden_dataset.py restore --replace

# Step 5: Verify restoration
psql -h localhost -p 5437 -U orchestkit -c \
  "SELECT COUNT(*) FROM analyses WHERE status = 'completed';"
# Expected: 98

# Step 6: Run integrity tests
poetry run pytest tests/smoke/retrieval/test_retrieval_quality.py -v
# Expected: 186/203 passed (91.6%)

# Step 7: Restart backend
docker compose up -d backend

# Step 8: Smoke test API
curl -f http://localhost:8500/health
# Expected: 200 OK
```

---

## Workflow 6: New Dev Environment Setup

**Scenario: Fresh MacBook, setting up OrchestKit for first time**

### Setup Steps

```bash
# Step 1: Clone repository (includes backup in version control)
git clone https://github.com/your-org/orchestkit.git
cd orchestkit

# Step 2: Setup backend
cd backend
poetry install

# Step 3: Start PostgreSQL
cd ..
docker compose up -d postgres

# Wait for PostgreSQL to be ready
sleep 5

# Step 4: Run migrations
cd backend
poetry run alembic upgrade head

# Step 5: Restore golden dataset
poetry run python scripts/backup_golden_dataset.py restore

# Expected output:
# ============================================================
# RESTORE COMPLETE
# ============================================================
#    Analyses:  98
#    Artifacts: 98
#    Chunks:    415
# ============================================================

# Step 6: Verify with tests
poetry run pytest tests/smoke/retrieval/test_retrieval_quality.py -v

# Expected: 186/203 passed (91.6%)

# Step 7: Start backend
cd ..
docker compose up -d backend

# Step 8: Verify API
curl -f http://localhost:8500/health
# Expected: 200 OK

# Step 9: Setup frontend
cd frontend
npm install
npm run dev

# Open http://localhost:5173
```

---

## Common Issues & Solutions

### Issue 1: Backup verification fails with "placeholder URLs"

**Error:**
```
WARNING: 5 analyses still use placeholder URLs
(example: https://docs.orchestkit.dev/placeholder/123)
```

**Solution:**
```bash
# Identify analyses with placeholder URLs
psql -h localhost -p 5437 -U orchestkit -c \
  "SELECT id, url FROM analyses WHERE url LIKE '%orchestkit.dev%';"

# Update with real canonical URLs
psql -h localhost -p 5437 -U orchestkit -c \
  "UPDATE analyses
   SET url = 'https://docs.python.org/3/library/asyncio.html'
   WHERE id = '550e8400-e29b-41d4-a716-446655440000';"

# Re-run backup
poetry run python scripts/backup_golden_dataset.py backup

# Verify
poetry run python scripts/backup_golden_dataset.py verify
# Expected: "BACKUP IS VALID" (no placeholder URLs)
```

---

### Issue 2: Restore fails with "Failed to generate embedding"

**Error:**
```
WARNING: Failed to generate embedding for chunk 123: OpenAI API error
```

**Solution:**
```bash
# Check OpenAI API key
echo $OPENAI_API_KEY
# Should be set

# Check .env file
grep OPENAI_API_KEY backend/.env
# Should have: OPENAI_API_KEY=sk-...

# Retry restore
poetry run python scripts/backup_golden_dataset.py restore --replace

# If still failing, check OpenAI quota
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

### Issue 3: Retrieval quality tests fail after restore

**Error:**
```
186 passed, 17 failed (91.6% pass rate)
BUT EXPECTED: 203 passed (100% pass rate)
```

**Solution:**
```bash
# This is EXPECTED! Retrieval quality is not 100%.
# 91.6% is the BASELINE pass rate for OrchestKit golden dataset.

# Check if pass rate DECREASED (regression):
# Before restore: 186/203 (91.6%)
# After restore:  186/203 (91.6%)
# NO REGRESSION - restore successful

# If pass rate dropped significantly (e.g., to 80%):
# 1. Check embedding model matches (should use same model)
# 2. Check hybrid search weights (RRF multiplier, boosts)
# 3. Run backup verification again
poetry run python scripts/backup_golden_dataset.py verify
```

---

## Quick Reference

### Backup
```bash
cd /Users/yonatangross/coding/OrchestKit/backend
poetry run python scripts/backup_golden_dataset.py backup
poetry run python scripts/backup_golden_dataset.py verify
git add data/golden_dataset_backup.json
git commit -m "chore: golden dataset backup"
```

### Restore (New Environment)
```bash
cd /Users/yonatangross/coding/OrchestKit/backend
docker compose up -d postgres
poetry run alembic upgrade head
poetry run python scripts/backup_golden_dataset.py restore
poetry run pytest tests/smoke/retrieval/test_retrieval_quality.py -v
```

### Restore (Replace Existing)
```bash
cd /Users/yonatangross/coding/OrchestKit/backend
poetry run python scripts/backup_golden_dataset.py restore --replace
```

### Verify Backup Integrity
```bash
cd /Users/yonatangross/coding/OrchestKit/backend
poetry run python scripts/backup_golden_dataset.py verify
```

---

**Remember:** The golden dataset is the foundation of retrieval quality testing. Always verify backups, never skip URL validation, and test restore in staging before production.
