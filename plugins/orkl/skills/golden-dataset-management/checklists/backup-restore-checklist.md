# Golden Dataset Backup/Restore Checklist

**Use this checklist to ensure safe, reliable backup and restoration of golden datasets**

---

## Pre-Backup Checklist

### Environment Verification

- [ ] **Database connection verified**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c "SELECT version();"
  # Expected: PostgreSQL 16.x
  ```

- [ ] **Database contains expected data**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c \
    "SELECT COUNT(*) FROM analyses WHERE status = 'completed';"
  # Expected: 98 (or current golden dataset size)
  ```

- [ ] **Embeddings generated for all chunks**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c \
    "SELECT COUNT(*) FROM analysis_chunks WHERE vector IS NULL;"
  # Expected: 0 (no chunks without embeddings)
  ```

### Data Quality Validation

- [ ] **URL contract verified (no placeholder URLs)**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c \
    "SELECT COUNT(*) FROM analyses WHERE url LIKE '%orchestkit.dev%';"
  # Expected: 0 (no placeholder URLs)
  ```

- [ ] **All analyses have artifacts**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c \
    "SELECT COUNT(*) FROM analyses a
     LEFT JOIN artifacts ar ON a.id = ar.analysis_id
     WHERE ar.id IS NULL AND a.status = 'completed';"
  # Expected: 0 (all completed analyses have artifacts)
  ```

- [ ] **No orphaned chunks**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c \
    "SELECT COUNT(*) FROM analysis_chunks c
     LEFT JOIN analyses a ON c.analysis_id = a.id
     WHERE a.id IS NULL;"
  # Expected: 0 (all chunks belong to an analysis)
  ```

### Script Availability

- [ ] **Backup script exists**
  ```bash
  ls -lh /Users/yonatangross/coding/OrchestKit/backend/scripts/backup_golden_dataset.py
  # Expected: File exists
  ```

- [ ] **Dependencies installed**
  ```bash
  cd /Users/yonatangross/coding/OrchestKit/backend
  poetry install
  # Expected: All dependencies installed
  ```

- [ ] **Data directory exists**
  ```bash
  mkdir -p /Users/yonatangross/coding/OrchestKit/backend/data
  ls -ld /Users/yonatangross/coding/OrchestKit/backend/data
  # Expected: Directory exists and is writable
  ```

---

## Backup Execution Checklist

### Run Backup

- [ ] **Execute backup command**
  ```bash
  cd /Users/yonatangross/coding/OrchestKit/backend
  poetry run python scripts/backup_golden_dataset.py backup
  ```

- [ ] **Verify backup output shows success**
  - [ ] "BACKUP COMPLETE (v2.0)" message displayed
  - [ ] Analyses count matches expected (98)
  - [ ] Artifacts count matches expected (98)
  - [ ] Chunks count matches expected (415)
  - [ ] Fixtures count matches expected (98 documents)

- [ ] **Check backup file created**
  ```bash
  ls -lh /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_backup.json
  # Expected: ~2.5 MB file
  ```

- [ ] **Check metadata file created**
  ```bash
  ls -lh /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_metadata.json
  # Expected: ~1 KB file
  ```

### Verify Backup

- [ ] **Run verification command**
  ```bash
  poetry run python scripts/backup_golden_dataset.py verify
  ```

- [ ] **Verify output shows valid backup**
  - [ ] "BACKUP IS VALID" message displayed
  - [ ] Analyses count correct
  - [ ] Artifacts count correct
  - [ ] Chunks count correct
  - [ ] Fixtures included (documents, URL maps, queries)
  - [ ] Referential integrity: OK
  - [ ] All analyses have artifacts: OK
  - [ ] No placeholder URLs warning

- [ ] **Verify backup file is valid JSON**
  ```bash
  cat /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_backup.json | jq '.'
  # Expected: Valid JSON, no parse errors
  ```

- [ ] **Check backup version**
  ```bash
  cat /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_backup.json | \
    jq '.version'
  # Expected: "2.0"
  ```

### Commit Backup

- [ ] **Stage backup files**
  ```bash
  git add backend/data/golden_dataset_backup.json
  git add backend/data/golden_dataset_metadata.json
  ```

- [ ] **Write descriptive commit message**
  ```bash
  git commit -m "chore: golden dataset backup (98 analyses, 415 chunks)

  - Backup version: 2.0 (includes fixtures)
  - Pass rate: 91.6% (186/203 queries)
  - Changes: [describe any additions/removals]"
  ```

- [ ] **Push to remote**
  ```bash
  git push origin main
  ```

---

## Pre-Restore Checklist

### Backup Verification

- [ ] **Backup file exists**
  ```bash
  ls -lh /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_backup.json
  # Expected: File exists
  ```

- [ ] **Backup integrity verified**
  ```bash
  cd /Users/yonatangross/coding/OrchestKit/backend
  poetry run python scripts/backup_golden_dataset.py verify
  # Expected: "BACKUP IS VALID"
  ```

- [ ] **Backup version compatible**
  ```bash
  cat backend/data/golden_dataset_backup.json | jq '.version'
  # Expected: "1.0" or "2.0" (script handles both)
  ```

### Database State Assessment

- [ ] **Database accessible**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c "SELECT 1;"
  # Expected: "1"
  ```

- [ ] **Current data count known**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c "SELECT COUNT(*) FROM analyses;"
  # Note the count for comparison after restore
  ```

- [ ] **Decision made: Add or Replace?**
  - [ ] **ADD mode:** Keep existing data, add from backup (use `restore`)
  - [ ] **REPLACE mode:** Delete existing data, restore from backup (use `restore --replace`)

  **WARNING:** REPLACE mode is DESTRUCTIVE. Use only if:
  - [ ] Setting up fresh environment
  - [ ] Recovering from data corruption
  - [ ] You have confirmed backup is valid

### Environment Setup

- [ ] **PostgreSQL running**
  ```bash
  docker compose ps postgres
  # Expected: State = "running"
  ```

- [ ] **Database migrations applied**
  ```bash
  cd /Users/yonatangross/coding/OrchestKit/backend
  poetry run alembic current
  # Expected: Shows latest migration revision
  ```

- [ ] **OpenAI API key set** (for embedding regeneration)
  ```bash
  echo $OPENAI_API_KEY
  # Expected: sk-... (valid API key)

  # OR check .env file
  grep OPENAI_API_KEY backend/.env
  # Expected: OPENAI_API_KEY=sk-...
  ```

- [ ] **Sufficient disk space**
  ```bash
  df -h /Users/yonatangross/coding/OrchestKit/backend/data
  # Expected: At least 1 GB free
  ```

---

## Restore Execution Checklist

### Run Restore

**Option A: Add to existing data (non-destructive)**

- [ ] **Execute restore command**
  ```bash
  cd /Users/yonatangross/coding/OrchestKit/backend
  poetry run python scripts/backup_golden_dataset.py restore
  ```

**Option B: Replace existing data (DESTRUCTIVE)**

- [ ] **CONFIRM backup is valid** (run verify again)
  ```bash
  poetry run python scripts/backup_golden_dataset.py verify
  # Expected: "BACKUP IS VALID"
  ```

- [ ] **CONFIRM you want to delete existing data** (no turning back)
  - [ ] Yes, I understand this is destructive
  - [ ] Yes, I have verified the backup
  - [ ] Yes, I am ready to proceed

- [ ] **Execute restore with --replace flag**
  ```bash
  poetry run python scripts/backup_golden_dataset.py restore --replace
  ```

### Monitor Restore Progress

- [ ] **Watch for restore stages**
  - [ ] "Loaded backup from: ..." (backup file loaded)
  - [ ] "Backup version: 2.0" (schema version)
  - [ ] "Restoring 98 analyses..." (analyses being inserted)
  - [ ] "Restoring 98 artifacts..." (artifacts being inserted)
  - [ ] "Restoring 415 chunks (regenerating embeddings)..." (chunks + embeddings)
  - [ ] "Restored 50/415 chunks" (progress updates)
  - [ ] "Restored 100/415 chunks"
  - [ ] "Restored 150/415 chunks"
  - [ ] ... (continues until 415/415)

- [ ] **Check for errors during embedding generation**
  - [ ] No "Failed to generate embedding" warnings
  - [ ] No OpenAI API errors
  - [ ] All chunks processed successfully

- [ ] **Verify restore completion message**
  - [ ] "RESTORE COMPLETE" displayed
  - [ ] Analyses: 98
  - [ ] Artifacts: 98
  - [ ] Chunks: 415

### Post-Restore Verification

- [ ] **Check database counts**
  ```bash
  # Analyses
  psql -h localhost -p 5437 -U orchestkit -c \
    "SELECT COUNT(*) FROM analyses WHERE status = 'completed';"
  # Expected: 98

  # Artifacts
  psql -h localhost -p 5437 -U orchestkit -c "SELECT COUNT(*) FROM artifacts;"
  # Expected: 98

  # Chunks
  psql -h localhost -p 5437 -U orchestkit -c "SELECT COUNT(*) FROM analysis_chunks;"
  # Expected: 415
  ```

- [ ] **Verify embeddings generated**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c \
    "SELECT COUNT(*) FROM analysis_chunks WHERE vector IS NULL;"
  # Expected: 0 (all chunks have embeddings)
  ```

- [ ] **Verify URL contract maintained**
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c \
    "SELECT COUNT(*) FROM analyses WHERE url LIKE '%orchestkit.dev%';"
  # Expected: 0 (no placeholder URLs)
  ```

- [ ] **Check sample data integrity**
  ```bash
  # Verify a known document exists
  psql -h localhost -p 5437 -U orchestkit -c \
    "SELECT title FROM analyses WHERE url = 'https://docs.python.org/3/library/asyncio.html';"
  # Expected: Row returned with title
  ```

---

## Validation Testing Checklist

### Retrieval Quality Tests

- [ ] **Run smoke tests**
  ```bash
  cd /Users/yonatangross/coding/OrchestKit/backend
  poetry run pytest tests/smoke/retrieval/test_retrieval_quality.py -v
  ```

- [ ] **Check pass rate**
  - [ ] Total queries: 203
  - [ ] Expected pass rate: ~91.6% (186/203 queries)
  - [ ] Actual pass rate: ____ (fill in from test output)
  - [ ] Pass rate within acceptable range (±2%)

- [ ] **No critical regressions**
  - [ ] If pass rate dropped >5%, investigate:
    - [ ] Embedding model matches (check model version)
    - [ ] Hybrid search config unchanged
    - [ ] Backup file not corrupted

### Integration Tests

- [ ] **Run API integration tests** (if backend running)
  ```bash
  # Start backend
  docker compose up -d backend

  # Wait for startup
  sleep 5

  # Health check
  curl -f http://localhost:8500/health
  # Expected: 200 OK

  # Run integration tests
  poetry run pytest tests/integration/test_artifact_api.py -v
  # Expected: All tests pass
  ```

### Fixture Validation

- [ ] **Verify fixture files restored** (v2.0 backups only)
  ```bash
  ls -lh /Users/yonatangross/coding/OrchestKit/backend/tests/smoke/retrieval/fixtures/
  # Expected:
  # - documents_expanded.json
  # - source_url_map.json
  # - queries.json
  ```

- [ ] **Check fixture counts**
  ```bash
  cat backend/tests/smoke/retrieval/fixtures/documents_expanded.json | \
    jq '.documents | length'
  # Expected: 98

  cat backend/tests/smoke/retrieval/fixtures/queries.json | \
    jq '.queries | length'
  # Expected: 203
  ```

---

## Rollback Checklist (If Restore Fails)

### Immediate Actions

- [ ] **Stop all database writes**
  ```bash
  docker compose stop backend
  ```

- [ ] **Document failure details**
  - [ ] Error message: ______________________
  - [ ] Failed at stage: ______________________
  - [ ] Chunks restored before failure: ______________________

### Rollback Options

**Option 1: Re-run restore (if partial failure)**

- [ ] **Identify cause of failure** (API rate limit, network issue, etc.)

- [ ] **Fix issue** (increase timeout, add API key, etc.)

- [ ] **Re-run restore with --replace**
  ```bash
  poetry run python scripts/backup_golden_dataset.py restore --replace
  ```

**Option 2: Restore from SQL dump (if available)**

- [ ] **Check for SQL dump**
  ```bash
  ls -lh /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_dump.sql
  # If exists, use pg_restore
  ```

- [ ] **Drop and recreate database**
  ```bash
  docker compose down postgres
  docker compose up -d postgres
  poetry run alembic upgrade head
  ```

- [ ] **Import SQL dump**
  ```bash
  psql -h localhost -p 5437 -U orchestkit < \
    /Users/yonatangross/coding/OrchestKit/backend/data/golden_dataset_dump.sql
  ```

**Option 3: Restore from git history (if committed)**

- [ ] **Find last good backup commit**
  ```bash
  git log --oneline -- backend/data/golden_dataset_backup.json
  ```

- [ ] **Checkout previous backup**
  ```bash
  git checkout HEAD~1 -- backend/data/golden_dataset_backup.json
  ```

- [ ] **Re-run restore**
  ```bash
  poetry run python scripts/backup_golden_dataset.py restore --replace
  ```

---

## Post-Restore Cleanup

### Documentation

- [ ] **Update CURRENT_STATUS.md** (if significant changes)
  - [ ] Document restore date
  - [ ] Document restore reason (new env, disaster recovery, etc.)
  - [ ] Document pass rate after restore

- [ ] **Update golden dataset metadata** (if expanded)
  ```bash
  cat backend/data/golden_dataset_metadata.json
  # Verify counts are current
  ```

### Monitoring

- [ ] **Monitor retrieval quality** (first 24 hours)
  ```bash
  # Run tests daily for a week to ensure stability
  poetry run pytest tests/smoke/retrieval/test_retrieval_quality.py -v
  ```

- [ ] **Monitor API errors** (if production)
  - [ ] Check logs for embedding errors
  - [ ] Check logs for search errors
  - [ ] Check logs for database connection errors

### Optional: Create New Backup

- [ ] **If restore modified data, create new backup**
  ```bash
  poetry run python scripts/backup_golden_dataset.py backup
  poetry run python scripts/backup_golden_dataset.py verify
  git add backend/data/golden_dataset_backup.json
  git commit -m "chore: golden dataset backup after restore"
  ```

---

## Quick Reference

### Full Backup Workflow
```bash
cd /Users/yonatangross/coding/OrchestKit/backend
poetry run python scripts/backup_golden_dataset.py backup
poetry run python scripts/backup_golden_dataset.py verify
git add data/golden_dataset_backup.json data/golden_dataset_metadata.json
git commit -m "chore: golden dataset backup"
git push
```

### Full Restore Workflow (New Environment)
```bash
cd /Users/yonatangross/coding/OrchestKit/backend
docker compose up -d postgres
sleep 5
poetry run alembic upgrade head
poetry run python scripts/backup_golden_dataset.py verify
poetry run python scripts/backup_golden_dataset.py restore
poetry run pytest tests/smoke/retrieval/test_retrieval_quality.py -v
```

### Full Restore Workflow (Replace Existing)
```bash
cd /Users/yonatangross/coding/OrchestKit/backend
poetry run python scripts/backup_golden_dataset.py verify
# CONFIRM: I understand this is destructive
poetry run python scripts/backup_golden_dataset.py restore --replace
poetry run pytest tests/smoke/retrieval/test_retrieval_quality.py -v
```

---

**Remember:** Golden datasets are critical infrastructure. Always verify backups, test restores in staging, and document all changes.
