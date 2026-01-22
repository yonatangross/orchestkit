# Evidence Verification Checklist

**Use this checklist before marking any task complete to ensure production-grade quality**

---

## Pre-Verification Checks

**Before collecting evidence, verify:**

- [ ] All code files saved (no unsaved changes)
- [ ] Dependencies installed (`poetry install` / `npm install`)
- [ ] Database migrations applied (`alembic upgrade head`)
- [ ] Environment variables set (`.env` file present)
- [ ] Development servers running (if needed for tests)

---

## Evidence Collection Checklist

### Minimum Evidence (Required for ALL tasks)

- [ ] At least ONE verification type executed
- [ ] Exit code captured and documented
- [ ] Timestamp recorded
- [ ] Evidence added to shared context

---

### Production-Grade Evidence (Required for feature development)

#### 1. Test Evidence

- [ ] **Test suite executed**
  ```bash
  # Backend
  cd backend
  poetry run pytest tests/unit/ --tb=short -v 2>&1 | tee /tmp/test_results.log

  # Frontend
  cd frontend
  npm run test
  ```

- [ ] **Exit code captured** (must be 0)
  ```bash
  echo "Exit code: $?"
  ```

- [ ] **Test results documented:**
  - [ ] Tests passed count
  - [ ] Tests failed count (should be 0)
  - [ ] Tests skipped count
  - [ ] Coverage percentage (≥70% for production-grade)

- [ ] **Test output saved** (first 50 lines or full log)
  ```bash
  tail -50 /tmp/test_results.log
  ```

#### 2. Build Evidence (if applicable)

- [ ] **Build executed**
  ```bash
  # Backend
  poetry build

  # Frontend
  npm run build
  ```

- [ ] **Build exit code captured** (must be 0)

- [ ] **Build artifacts verified:**
  - [ ] Files created in `dist/` or `build/`
  - [ ] Bundle size within budget (if applicable)
  - [ ] No critical errors in output

#### 3. Code Quality Evidence

- [ ] **Formatter checked**
  ```bash
  # Backend
  poetry run ruff format --check app/

  # Frontend
  npm run format:check
  ```

- [ ] **Linter executed**
  ```bash
  # Backend
  poetry run ruff check app/

  # Frontend
  npm run lint
  ```

- [ ] **Type checker executed**
  ```bash
  # Backend
  poetry run ty check app/

  # Frontend
  npm run typecheck
  ```

- [ ] **Quality results documented:**
  - [ ] Format exit code (must be 0)
  - [ ] Lint exit code (must be 0)
  - [ ] Type check exit code (must be 0)
  - [ ] Error count (should be 0)
  - [ ] Warning count (documented if >0)

---

### Gold Standard Evidence (Required for critical features)

#### 4. Integration Evidence

- [ ] **Integration tests executed**
  ```bash
  cd backend
  poetry run pytest tests/integration/ --tb=short -v
  ```

- [ ] **API endpoints tested** (if applicable)
  ```bash
  # Example: Test artifact endpoint
  curl -X GET http://localhost:8500/api/v1/artifacts/{id}
  # Expected: 200 OK
  ```

- [ ] **Database integrity verified** (if applicable)
  ```bash
  psql -h localhost -p 5437 -U orchestkit -c "SELECT COUNT(*) FROM analyses;"
  ```

- [ ] **Event streaming verified** (if applicable)
  ```bash
  # Check SSE events
  curl -N http://localhost:8500/api/v1/workflow/sse/{workflow_id}
  ```

#### 5. Performance Evidence

- [ ] **Performance benchmarks executed**
  ```bash
  pytest tests/performance/ --benchmark-only
  ```

- [ ] **Response time measured:**
  - [ ] P95 latency <200ms (or project threshold)
  - [ ] Mean response time documented

- [ ] **Resource usage checked:**
  - [ ] Memory usage within limits
  - [ ] CPU usage acceptable

#### 6. Security Evidence

- [ ] **Security scan executed**
  ```bash
  # Backend
  poetry run pip-audit

  # Frontend
  npm audit --audit-level=moderate
  ```

- [ ] **Vulnerabilities documented:**
  - [ ] Critical vulnerabilities: 0
  - [ ] High vulnerabilities: documented with remediation plan
  - [ ] Medium/Low vulnerabilities: tracked

#### 7. Accessibility Evidence (Frontend only)

- [ ] **Accessibility audit executed**
  ```bash
  npm run a11y-check
  ```

- [ ] **WCAG 2.1 AA compliance verified:**
  - [ ] Color contrast ratios meet standards
  - [ ] Keyboard navigation works
  - [ ] Screen reader tested

---

## Documentation Checklist

### Evidence Recording

- [ ] **Evidence template completed** (see `references/evidence-patterns.md`)

- [ ] **Evidence includes:**
  - [ ] Command executed
  - [ ] Exit code
  - [ ] Output snippet (first 10-50 lines)
  - [ ] Timestamp
  - [ ] Environment details

- [ ] **Evidence stored in context:**
  ```json
  {
    "quality_evidence": {
      "tests_run": true,
      "test_exit_code": 0,
      "coverage_percent": 87,
      "timestamp": "2025-12-21T10:30:00Z"
    }
  }
  ```

- [ ] **Evidence files saved** (if applicable):
  - [ ] Test logs: `.claude/quality-gates/evidence/tests-{timestamp}.log`
  - [ ] Build logs: `.claude/quality-gates/evidence/build-{timestamp}.log`
  - [ ] Lint logs: `.claude/quality-gates/evidence/lint-{timestamp}.log`

---

## Validation Checklist

### Before Marking Task Complete

- [ ] **All verification checks passed** (exit code 0)

- [ ] **No critical errors** in any verification type

- [ ] **Coverage threshold met** (≥70% for production-grade, ≥80% for gold standard)

- [ ] **Evidence documented** in task completion message

- [ ] **Evidence added to shared context** (`.claude/context/session/state.json (Context Protocol 2.0)`)

- [ ] **Evidence files linked** in completion message

### Final Checks

- [ ] **Task description matches implementation** (no scope creep)

- [ ] **All acceptance criteria met** (if defined)

- [ ] **No regressions introduced** (existing tests still pass)

- [ ] **Documentation updated** (if user-facing changes)

- [ ] **Git status clean** (no uncommitted debugging code)

---

## OrchestKit-Specific Checklist

### Backend Tasks

- [ ] **Database migrations tested:**
  ```bash
  # Check current revision
  alembic current

  # Test downgrade/upgrade
  alembic downgrade -1
  alembic upgrade head
  ```

- [ ] **API endpoints tested:**
  ```bash
  # Health check
  curl -f http://localhost:8500/health

  # Specific endpoint
  curl -X POST http://localhost:8500/api/v1/analyze \
    -H "Content-Type: application/json" \
    -d '{"url": "https://example.com"}'
  ```

- [ ] **Event broadcasting tested:**
  ```bash
  # Check SSE events
  curl -N http://localhost:8500/api/v1/workflow/sse/{workflow_id}
  ```

- [ ] **Golden dataset integrity verified** (if data changes):
  ```bash
  poetry run python scripts/backup_golden_dataset.py verify
  ```

### Frontend Tasks

- [ ] **Component tests pass:**
  ```bash
  npm run test -- src/features/analysis/components/
  ```

- [ ] **Visual regression tested** (manual check or screenshot comparison)

- [ ] **Browser console clean** (no errors/warnings)

- [ ] **Responsive design verified** (mobile/tablet/desktop)

### Full-Stack Tasks

- [ ] **Backend tests pass**
- [ ] **Frontend tests pass**
- [ ] **Integration tests pass**
- [ ] **End-to-end workflow tested** (manual or automated)

---

## Common Failure Scenarios

### Scenario 1: Tests fail

**Action:**
- [ ] Review test output for failure reason
- [ ] Fix failing tests
- [ ] Re-run tests until exit code 0
- [ ] Document fix in evidence

**Do NOT:**
- ❌ Mark task complete with failing tests
- ❌ Skip tests "just this once"
- ❌ Disable failing tests without documentation

---

### Scenario 2: Build fails

**Action:**
- [ ] Review build errors
- [ ] Fix compilation/bundling issues
- [ ] Re-run build until exit code 0
- [ ] Verify artifacts created

**Do NOT:**
- ❌ Mark task complete with build errors
- ❌ Ignore build warnings (document them instead)

---

### Scenario 3: Linter fails

**Action:**
- [ ] Run auto-fix if available (`ruff format app/`, `npm run lint:fix`)
- [ ] Manually fix remaining issues
- [ ] Re-run linter until exit code 0
- [ ] Document any disabled rules

**Do NOT:**
- ❌ Disable linter rules without team consensus
- ❌ Add `# noqa` comments without explanation

---

### Scenario 4: Coverage drops

**Action:**
- [ ] Add tests for new code
- [ ] Ensure edge cases covered
- [ ] Re-run tests with coverage
- [ ] Verify coverage ≥ project threshold

**Do NOT:**
- ❌ Lower coverage threshold to pass check
- ❌ Add fake/trivial tests just for coverage

---

## Evidence Storage Locations

### Shared Context
**File:** `.claude/context/session/state.json (Context Protocol 2.0)`
**Contains:** Structured evidence metadata
```json
{
  "quality_evidence": {
    "tests_run": true,
    "test_exit_code": 0,
    "coverage_percent": 87,
    "timestamp": "2025-12-21T10:30:00Z"
  }
}
```

### Evidence Files
**Directory:** `.claude/quality-gates/evidence/`
**Files:**
- `tests-{timestamp}.log` - Full test output
- `build-{timestamp}.log` - Full build output
- `lint-{timestamp}.log` - Full lint output

### Task Completion Messages
**Include:**
- Summary of evidence collected
- Link to evidence files
- Verification level achieved (minimum/production-grade/gold standard)

**Example:**
```markdown
Task complete: Create /api/v1/artifacts/{id} endpoint

Evidence collected (Production-Grade):
- Tests: Exit 0, 185 passed, 87% coverage
- Build: Exit 0, 234 KB bundle
- Lint: Exit 0, 0 errors
- Types: Exit 0, no type errors

Evidence files:
- .claude/quality-gates/evidence/tests-20251221-103000.log
- .claude/quality-gates/evidence/lint-20251221-103500.log

Shared context updated: quality_evidence
Timestamp: 2025-12-21T10:30:00Z
```

---

## Quick Reference

### Minimum Evidence (ALL tasks)
```bash
# Run one verification type
pytest tests/
echo "Exit code: $?"
# Document in completion message
```

### Production-Grade Evidence (Feature development)
```bash
# Backend
cd backend
poetry run pytest tests/unit/ --tb=short -v
poetry run ruff format --check app/
poetry run ruff check app/
poetry run ty check app/

# Frontend
cd frontend
npm run test
npm run lint
npm run typecheck
npm run build
```

### Gold Standard Evidence (Critical features)
```bash
# All production-grade checks PLUS:
pytest tests/integration/ --tb=short -v
pytest tests/performance/ --benchmark-only
npm audit --audit-level=moderate
npm run a11y-check
```

---

**Remember:** Evidence is not optional. No task is complete without verifiable proof.
