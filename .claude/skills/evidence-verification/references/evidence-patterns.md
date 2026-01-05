# Evidence Patterns Reference

**Comprehensive guide to collecting and documenting verifiable proof in software development**

---

## Overview

Evidence-based verification ensures that no task is marked complete without executable proof. This reference covers all types of evidence, collection strategies, and verification levels used in production systems.

**Core Principle:** Exit codes, test results, and build logs are proof. Claims without evidence are hallucinations.

---

## Evidence Types

### 1. Test Evidence

**What it proves:** Code functionality works as expected

**Minimum Requirements:**
- Exit code (must be 0 for success)
- Test count (passed/failed/skipped)
- Timestamp

**Production-Grade Requirements:**
- Coverage metrics (>70% or project standard)
- Performance benchmarks (within thresholds)
- Edge case validation

**Collection Pattern:**
```bash
# Run tests and capture exit code
pytest tests/unit/ --tb=short -v 2>&1 | tee /tmp/test_results.log
echo "Exit code: $?"

# With coverage
pytest --cov=app --cov-report=term-missing tests/

# Performance benchmarks
pytest tests/performance/ --benchmark-only
```

**Evidence Template:**
```markdown
## Test Evidence

**Command:** `pytest tests/unit/ --tb=short -v`
**Exit Code:** 0 (success)
**Duration:** 12.4 seconds

**Results:**
- Tests passed: 185
- Tests failed: 0
- Tests skipped: 3
- Coverage: 87% (statements)

**Output Snippet:**
```
============================= test session starts ==============================
collected 188 items

tests/unit/test_search_service.py::test_hybrid_search PASSED           [ 0%]
tests/unit/test_embeddings.py::test_generate_embedding PASSED          [ 1%]
...
============================= 185 passed, 3 skipped in 12.40s ==================
```

**Timestamp:** 2026-01-05T10:30:15Z
**Environment:** Python 3.13.x, pytest 8.x
```

---

### 2. Build Evidence

**What it proves:** Code compiles/bundles without errors

**Minimum Requirements:**
- Build exit code (0 = success)
- Errors/warnings count
- Build duration

**Production-Grade Requirements:**
- Bundle size analysis (within budget)
- Build artifact verification
- Dependency tree validation

**Collection Pattern:**
```bash
# Backend build
cd backend
poetry build 2>&1 | tee /tmp/build_results.log
echo "Exit code: $?"

# Frontend build
cd frontend
npm run build 2>&1 | tee /tmp/build_results.log
echo "Exit code: $?"

# Check bundle size
du -h dist/bundle.js
```

**Evidence Template:**
```markdown
## Build Evidence

**Command:** `npm run build`
**Exit Code:** 0 (success)
**Duration:** 8.2 seconds

**Artifacts Created:**
- dist/bundle.js (234 KB)
- dist/bundle.css (18 KB)
- dist/index.html (2 KB)

**Errors:** 0
**Warnings:** 2 (unused imports)

**Output Snippet:**
```
Building for production...
✓ 124 modules transformed
dist/bundle.js     234.12 kB │ gzip: 78.45 kB
dist/bundle.css     18.32 kB │ gzip: 4.21 kB
✓ built in 8.23s
```

**Timestamp:** 2025-12-21T10:32:00Z
**Environment:** Node 20.10.0, Vite 5.0.8
```

---

### 3. Code Quality Evidence

**What it proves:** Code meets style/type/security standards

**Minimum Requirements:**
- Linter exit code
- Error count
- Warning count

**Production-Grade Requirements:**
- Zero critical errors
- Type checking passes
- Security scan shows no vulnerabilities

**Collection Pattern:**
```bash
# Python lint check (backend)
cd backend
poetry run ruff format --check app/  # Format check
poetry run ruff check app/            # Lint check
poetry run ty check app/              # Type check

# TypeScript lint check (frontend)
cd frontend
npm run lint                          # ESLint + Biome
npm run typecheck                     # TypeScript
```

**Evidence Template:**
```markdown
## Code Quality Evidence

### Formatter
**Command:** `ruff format --check app/`
**Exit Code:** 0 (no formatting needed)

### Linter
**Command:** `ruff check app/`
**Exit Code:** 0
**Errors:** 0
**Warnings:** 3 (unused variables)

**Output:**
```
All checks passed!
```

### Type Checker
**Command:** `ty check app/`
**Exit Code:** 0
**Type Errors:** 0

**Output:**
```
Success: no issues found in 47 source files
```

**Timestamp:** 2025-12-21T10:35:00Z
```

---

### 4. Deployment Evidence

**What it proves:** Code runs successfully in target environment

**Minimum Requirements:**
- Deployment exit code
- Environment details
- Health check status

**Production-Grade Requirements:**
- Smoke tests pass
- No error spikes in logs
- Rollback capability verified

**Collection Pattern:**
```bash
# Deploy to staging
kubectl apply -f deployment.yaml
echo "Exit code: $?"

# Health check
curl -f http://api.staging.example.com/health
echo "Exit code: $?"

# Smoke tests
pytest tests/smoke/ --tb=short
```

**Evidence Template:**
```markdown
## Deployment Evidence

**Environment:** staging
**Version:** v1.2.3
**Deployed At:** 2025-12-21T11:00:00Z

### Pre-Deployment Checks
- Tests: exit code 0 (185 passed)
- Build: exit code 0 (234 KB bundle)
- Security: 0 critical vulnerabilities

### Deployment
**Command:** `kubectl apply -f deployment.yaml`
**Exit Code:** 0
**Output:**
```
deployment.apps/skillforge-backend configured
service/skillforge-backend unchanged
```

### Post-Deployment Verification
**Health Check:** `curl http://api.staging.example.com/health`
**Status:** 200 OK
**Response Time:** 42ms

**Smoke Tests:** `pytest tests/smoke/`
**Exit Code:** 0
**Tests Passed:** 12/12

**Timestamp:** 2025-12-21T11:05:00Z
```

---

### 5. Integration Evidence

**What it proves:** Components interact correctly

**Minimum Requirements:**
- Integration test exit code
- API response validation
- Database query results

**Production-Grade Requirements:**
- End-to-end workflow tests
- Error handling validation
- Performance under load

**Collection Pattern:**
```bash
# Integration tests
pytest tests/integration/ --tb=short -v

# API endpoint tests
curl -X POST http://localhost:8500/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Database integrity
psql -h localhost -p 5437 -U skillforge -c "SELECT COUNT(*) FROM analyses;"
```

**Evidence Template:**
```markdown
## Integration Evidence

**Test Suite:** Integration tests
**Command:** `pytest tests/integration/ --tb=short -v`
**Exit Code:** 0

**Results:**
- API endpoints: 24/24 passed
- Database operations: 18/18 passed
- Event streaming: 8/8 passed

**Sample API Test:**
```bash
curl -X POST http://localhost:8500/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.python.org/3/library/asyncio.html"}'
```

**Response:** 201 Created (45ms)

**Database Verification:**
```sql
SELECT COUNT(*) FROM analyses WHERE status = 'completed';
-- Result: 98
```

**Timestamp:** 2025-12-21T11:10:00Z
```

---

### 6. Performance Evidence

**What it proves:** System meets performance requirements

**Minimum Requirements:**
- Response time measurements
- Throughput metrics
- Resource usage

**Production-Grade Requirements:**
- P95 latency <200ms
- Sustained throughput >100 req/s
- Memory/CPU within limits

**Collection Pattern:**
```bash
# Performance benchmarks
pytest tests/performance/ --benchmark-only

# Load testing
locust -f tests/load/locustfile.py --headless -u 100 -r 10 -t 60s

# Profiling
py-spy record -o profile.svg -- python app/main.py
```

**Evidence Template:**
```markdown
## Performance Evidence

**Benchmark Suite:** `pytest tests/performance/ --benchmark-only`
**Exit Code:** 0

**Results:**
| Operation | Min | Mean | P95 | P99 |
|-----------|-----|------|-----|-----|
| Embedding generation | 12ms | 18ms | 25ms | 32ms |
| Hybrid search | 45ms | 62ms | 88ms | 105ms |
| Analysis workflow | 2.1s | 2.8s | 3.5s | 4.2s |

**Load Test:** 100 concurrent users, 60 seconds
- Requests: 12,450
- Success rate: 99.97%
- Mean response time: 78ms
- P95 response time: 145ms

**Timestamp:** 2025-12-21T11:15:00Z
```

---

## Evidence Collection Strategies

### Strategy 1: Continuous Collection

**When to use:** During development, before every commit

**Pattern:**
```bash
# Pre-commit hook script
#!/bin/bash
set -e

echo "Running pre-commit verification..."

# Run tests
pytest tests/unit/ --tb=short -q
TEST_EXIT=$?

# Run linter
ruff format --check app/
ruff check app/
LINT_EXIT=$?

# Run type checker
ty check app/
TYPE_EXIT=$?

# Collect evidence
echo "Test exit: $TEST_EXIT"
echo "Lint exit: $LINT_EXIT"
echo "Type exit: $TYPE_EXIT"

if [ $TEST_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ] && [ $TYPE_EXIT -eq 0 ]; then
  echo "All checks passed. Commit allowed."
  exit 0
else
  echo "Verification failed. Fix issues before committing."
  exit 1
fi
```

---

### Strategy 2: Batch Collection

**When to use:** Before PRs, during code review

**Pattern:**
```bash
# Full verification script
#!/bin/bash

EVIDENCE_DIR=".claude/quality-gates/evidence"
mkdir -p $EVIDENCE_DIR
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "Running full verification suite..."

# Tests with coverage
pytest tests/ --cov=app --cov-report=term-missing \
  2>&1 | tee $EVIDENCE_DIR/tests-$TIMESTAMP.log
TEST_EXIT=$?

# Build
npm run build 2>&1 | tee $EVIDENCE_DIR/build-$TIMESTAMP.log
BUILD_EXIT=$?

# Code quality
ruff format --check app/ 2>&1 | tee $EVIDENCE_DIR/lint-$TIMESTAMP.log
LINT_EXIT=$?

# Summary
echo "=== Verification Summary ==="
echo "Tests: $TEST_EXIT"
echo "Build: $BUILD_EXIT"
echo "Lint: $LINT_EXIT"
echo "Evidence stored in: $EVIDENCE_DIR"
```

---

### Strategy 3: Progressive Collection

**When to use:** Large feature development, multi-day tasks

**Pattern:**
```bash
# Daily evidence collection
#!/bin/bash

DATE=$(date +%Y-%m-%d)

echo "Daily verification for $DATE"

# Run lightweight checks
pytest tests/unit/ --tb=no -q
ruff check app/ --statistics

# Store in daily log
echo "[$DATE] Tests: $?, Lint: $?" >> .claude/evidence/daily-log.txt
```

---

## Verification Levels

### Level 1: Minimum Acceptable

**Requirements:**
- At least ONE verification type executed
- Exit code captured (0 = pass, non-zero = fail)
- Timestamp recorded
- Evidence stored in context

**Use case:** Rapid prototyping, spike work

**Example:**
```markdown
## Evidence (Minimum)
- Tests: Exit code 0
- Timestamp: 2025-12-21T10:30:00Z
```

---

### Level 2: Production-Grade

**Requirements:**
- Tests pass (exit code 0)
- Coverage ≥70% (or project standard)
- Build succeeds (exit code 0)
- No critical linter errors
- Type checker passes
- Security scan shows no critical issues

**Use case:** Feature development, bug fixes

**Example:**
```markdown
## Evidence (Production-Grade)
- Tests: Exit 0, 185 passed, 0 failed, 87% coverage
- Build: Exit 0, 234 KB bundle
- Lint: Exit 0, 0 errors, 3 warnings
- Types: Exit 0, no type errors
- Security: 0 critical vulnerabilities
```

---

### Level 3: Gold Standard

**Requirements:**
- All production-grade requirements
- Coverage ≥80%
- No linter warnings
- Performance benchmarks within thresholds
- Accessibility audit passes (WCAG 2.1 AA)
- Integration tests pass
- Deployment verification complete

**Use case:** Critical features, production releases

**Example:**
```markdown
## Evidence (Gold Standard)
- Tests: Exit 0, 185 passed, 0 failed, 91% coverage
- Build: Exit 0, 234 KB bundle (within 250 KB budget)
- Lint: Exit 0, 0 errors, 0 warnings
- Types: Exit 0, strict mode enabled
- Security: 0 vulnerabilities (all dependencies up-to-date)
- Performance: P95 <150ms (target <200ms)
- Accessibility: WCAG 2.1 AA compliant
- Integration: 50/50 tests passed
- Deployment: Staging verified, rollback tested
```

---

## SkillForge Examples

### Example 1: Backend API Endpoint

```markdown
## Task: Create /api/v1/artifacts/{id} endpoint

### Evidence Collected

**Tests:**
```bash
cd backend
poetry run pytest tests/unit/api/v1/test_artifacts.py::test_get_artifact_by_id -v
# Exit code: 0
# PASSED
```

**Type Check:**
```bash
poetry run ty check app/api/v1/artifacts.py
# Exit code: 0
# Success: no issues found
```

**Lint:**
```bash
poetry run ruff format --check app/api/v1/artifacts.py
poetry run ruff check app/api/v1/artifacts.py
# Exit code: 0 (both)
# All checks passed
```

**Integration Test:**
```bash
curl -X GET http://localhost:8500/api/v1/artifacts/550e8400-e29b-41d4-a716-446655440000
# HTTP 200 OK
# Response: {"id": "550e8400-...", "content": "..."}
```

**Timestamp:** 2025-12-21T10:30:00Z
**Verification Level:** Production-Grade
**Status:** Task complete, evidence verified
```

---

### Example 2: Frontend Component

```markdown
## Task: Fix UI status contradiction in AnalysisProgressCard

### Evidence Collected

**Tests:**
```bash
cd frontend
npm run test -- src/features/analysis/components/steps/AnalysisProgressCard.test.tsx
# Exit code: 0
# 8 passed
```

**Type Check:**
```bash
npm run typecheck
# Exit code: 0
# No type errors found
```

**Lint:**
```bash
npm run lint
# Exit code: 0
# No linting errors found
```

**Visual Test:**
Screenshot: `/tmp/analysis-progress-card-error-state.png`
- Shows red "Complete with Errors" badge when failures exist
- Error details displayed below progress bar

**Timestamp:** 2025-12-21T11:00:00Z
**Verification Level:** Production-Grade
**Status:** Task complete, visual regression test passed
```

---

### Example 3: Database Migration

```markdown
## Task: Add content_tsvector index for faster search

### Evidence Collected

**Migration:**
```bash
cd backend
poetry run alembic upgrade head
# Exit code: 0
# INFO  [alembic.runtime.migration] Running upgrade abc123 -> def456
```

**Index Verification:**
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'analysis_chunks' AND indexname LIKE '%tsvector%';
# Result: idx_chunks_content_tsvector (GIN)
```

**Performance Test:**
```bash
poetry run pytest tests/unit/repositories/test_chunk_repository.py::test_hybrid_search_performance -v
# Exit code: 0
# PASSED
# Mean query time: 45ms (before: 220ms)
# 5x faster
```

**Integrity Test:**
```bash
poetry run pytest tests/integration/test_retrieval_quality.py -v
# Exit code: 0
# 186/203 passed (91.6%)
```

**Timestamp:** 2025-12-21T12:00:00Z
**Verification Level:** Production-Grade
**Status:** Migration successful, performance improved 5x
```

---

## Common Pitfalls

### Pitfall 1: Running tests without capturing exit code

**Bad:**
```bash
pytest tests/
# Looks at output, assumes success
```

**Good:**
```bash
pytest tests/
echo "Exit code: $?"
# OR
pytest tests/ && echo "SUCCESS (exit 0)" || echo "FAILED (exit $?)"
```

---

### Pitfall 2: Trusting cache results

**Bad:**
```bash
# Tests passed yesterday, should still be good
git commit -m "feat: add new feature"
```

**Good:**
```bash
# Always re-run before commit
pytest tests/
ruff check app/
git commit -m "feat: add new feature"
```

---

### Pitfall 3: Ignoring warnings

**Bad:**
```markdown
## Evidence
- Tests: Exit 0, 50 warnings (ignored)
- Lint: Exit 0, 15 warnings (not important)
```

**Good:**
```markdown
## Evidence
- Tests: Exit 0, 50 warnings (documented in #123 for tech debt sprint)
- Lint: Exit 0, 15 warnings (fixing in separate PR #124)
```

---

### Pitfall 4: Not storing evidence

**Bad:**
```markdown
"I ran the tests and they passed."
```

**Good:**
```markdown
## Evidence
**Command:** `pytest tests/unit/`
**Exit Code:** 0
**Output Log:** `.claude/quality-gates/evidence/tests-20251221-103000.log`
**Added to context:** Yes (quality_evidence.tests_run = true)
```

---

## Integration with Context System

Store evidence in `.claude/context/shared-context.json`:

```json
{
  "quality_evidence": {
    "tests_run": true,
    "test_exit_code": 0,
    "test_count": {
      "passed": 185,
      "failed": 0,
      "skipped": 3
    },
    "coverage_percent": 87,
    "build_success": true,
    "build_exit_code": 0,
    "linter_errors": 0,
    "linter_warnings": 3,
    "type_errors": 0,
    "timestamp": "2025-12-21T10:30:00Z",
    "verification_level": "production-grade",
    "evidence_files": [
      ".claude/quality-gates/evidence/tests-20251221-103000.log",
      ".claude/quality-gates/evidence/build-20251221-103200.log",
      ".claude/quality-gates/evidence/lint-20251221-103500.log"
    ]
  }
}
```

---

## Quick Reference

### Evidence Collection Commands (SkillForge)

**Backend (Python):**
```bash
cd backend
poetry run pytest tests/unit/ --tb=short -v 2>&1 | tee /tmp/test_results.log
poetry run ruff format --check app/
poetry run ruff check app/
poetry run ty check app/ --exclude "app/evaluation/*"
```

**Frontend (TypeScript):**
```bash
cd frontend
npm run test
npm run lint
npm run typecheck
npm run build
```

**Integration:**
```bash
cd backend
poetry run pytest tests/integration/ --tb=short -v
curl -f http://localhost:8500/health
```

---

**Remember:** Evidence is the foundation of production-grade development. Always collect, always document, never assume.
