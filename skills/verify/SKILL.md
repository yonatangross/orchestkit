---
name: verify
description: Comprehensive feature verification with parallel analysis agents. Use when verifying implementations, testing changes, validating features, or checking correctness.
context: fork
version: 2.0.0
author: OrchestKit
tags: [verification, testing, quality, validation, parallel-agents]
user-invocable: true
allowedTools: [Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList]
skills: [code-review-playbook, security-scanning, evidence-verification, run-tests, unit-testing, integration-testing]
---

# Verify Feature

Comprehensive verification using parallel specialized agents with CC 2.1.16 task tracking.

## Quick Start

```bash
/verify authentication flow
/verify user profile feature
/verify --scope=backend database migrations
```

## Workflow Overview

```
Phase 1: Context & Task Creation (MANDATORY)
    |
    v
Phase 2: Parallel Agent Dispatch (5-7 agents)
    |
    +---> code-quality-reviewer    --+
    +---> security-auditor           |
    +---> test-generator             +---> Results
    +---> backend-system-architect   |
    +---> frontend-ui-developer    --+
    |
    v
Phase 3: Parallel Test Execution
    |
    +---> Backend tests (pytest)
    +---> Frontend tests (vitest)
    |
    v
Phase 4: Evidence Compilation & Report
```

## Phase 1: Context & Task Creation (MANDATORY)

**ALWAYS create tasks before verification** - This tracks progress and provides clear completion criteria.

### 1a. Gather Context

```bash
# PARALLEL - Run all in ONE message
git diff main --stat                    # Changes summary
git log main..HEAD --oneline           # Commit history
git diff main --name-only | sort -u    # Affected files
```

### 1b. Create Verification Tasks

```python
# Create task hierarchy for verification
TaskCreate(
  subject="Verify [feature-name] implementation",
  description="Comprehensive verification of [feature] including quality, security, tests",
  activeForm="Verifying [feature-name] implementation"
)

# Create subtasks for each verification domain
TaskCreate(subject="Run code quality checks", activeForm="Running code quality checks")
TaskCreate(subject="Execute security audit", activeForm="Executing security audit")
TaskCreate(subject="Verify test coverage", activeForm="Verifying test coverage")
TaskCreate(subject="Validate API correctness", activeForm="Validating API correctness")
TaskCreate(subject="Check UI/UX compliance", activeForm="Checking UI/UX compliance")
TaskCreate(subject="Compile verification report", activeForm="Compiling verification report")
```

### 1c. Identify Verification Scope

| Scope | Agents | Focus Areas |
|-------|--------|-------------|
| `backend` | 3 | API, database, security |
| `frontend` | 3 | UI, accessibility, performance |
| `full-stack` | 5-7 | All domains |
| `security` | 2 | Security-focused audit |

## Phase 2: Parallel Agent Dispatch (5-7 Agents)

Launch ALL agents in ONE message with `run_in_background: true`.

### Agent Configuration Matrix

| Agent | Focus | Skills Auto-Injected | Output |
|-------|-------|---------------------|--------|
| code-quality-reviewer | Lint, types, patterns | code-review-playbook, biome-linting, clean-architecture | JSON quality report |
| security-auditor | OWASP, secrets, CVEs | owasp-top-10, security-scanning, defense-in-depth | JSON security findings |
| test-generator | Coverage gaps, test quality | unit-testing, integration-testing, msw-mocking | Coverage analysis |
| backend-system-architect | API design, async patterns | api-design-framework, fastapi-advanced, error-handling-rfc9457 | API compliance report |
| frontend-ui-developer | React 19, Zod, a11y | react-server-components-framework, wcag-compliance, type-safety-validation | UI compliance report |

### Parallel Dispatch Template

```python
# PARALLEL - Launch ALL 5 agents in ONE message
# Mark main verification task as in_progress first
TaskUpdate(taskId="1", status="in_progress")

Task(
  subagent_type="code-quality-reviewer",
  prompt="""QUALITY VERIFICATION for: $ARGUMENTS

  Execute REAL checks (not simulated):
  1. Run linting: `npm run lint` / `poetry run ruff check app/`
  2. Run type checking: `npm run typecheck` / `poetry run ty check app/`
  3. Check for anti-patterns (no console.log, no any types)
  4. Verify SOLID principles compliance
  5. Check cyclomatic complexity < 10

  Output JSON:
  {
    "linting": {"tool": "...", "exit_code": 0, "errors": 0, "warnings": 0},
    "type_check": {"tool": "...", "exit_code": 0, "errors": 0},
    "patterns": {"violations": [], "compliance": "PASS/FAIL"},
    "approval": {"status": "APPROVED/NEEDS_FIXES", "blockers": []}
  }""",
  run_in_background=True
)

Task(
  subagent_type="security-auditor",
  prompt="""SECURITY AUDIT for: $ARGUMENTS

  Execute REAL scans:
  1. Dependency audit: `npm audit --json` / `poetry run pip-audit --format=json`
  2. Secret detection: grep for API keys, passwords, tokens
  3. OWASP Top 10 check (injection, XSS, auth bypass)
  4. Check for hardcoded credentials
  5. Verify rate limiting on sensitive endpoints

  Output JSON:
  {
    "scan_summary": {"files_scanned": N, "vulnerabilities_found": N},
    "critical": [...],
    "high": [...],
    "secrets_detected": [...],
    "recommendations": [...],
    "approval": {"status": "PASS/BLOCK", "blockers": []}
  }""",
  run_in_background=True
)

Task(
  subagent_type="test-generator",
  prompt="""TEST COVERAGE VERIFICATION for: $ARGUMENTS

  Execute and analyze:
  1. Run tests with coverage: `poetry run pytest --cov=app --cov-report=json`
  2. Identify untested code paths
  3. Check test quality (meaningful assertions, not just `assert result`)
  4. Verify edge cases covered (empty input, errors, timeouts)
  5. Check for flaky tests (no sleep, no timing dependencies)

  Output JSON:
  {
    "coverage": {"current": N, "target": 70, "passed": true/false},
    "test_summary": {"total": N, "passed": N, "failed": N, "skipped": N},
    "gaps": ["file:line - reason"],
    "quality_issues": ["test_name - issue"],
    "approval": {"status": "PASS/FAIL", "blockers": []}
  }""",
  run_in_background=True
)

Task(
  subagent_type="backend-system-architect",
  prompt="""API VERIFICATION for: $ARGUMENTS

  Verify backend compliance (READ ONLY - no changes):
  1. API endpoints follow REST conventions
  2. Pydantic v2 schemas have proper validation
  3. Error handling uses RFC 9457 Problem Details
  4. Async operations have timeout protection
  5. Database queries are optimized (no N+1)

  Output JSON:
  {
    "api_compliance": {"rest_conventions": true/false, "issues": []},
    "validation": {"pydantic_v2": true/false, "issues": []},
    "error_handling": {"rfc9457": true/false, "issues": []},
    "async_safety": {"timeouts": true/false, "issues": []},
    "approval": {"status": "PASS/FAIL", "blockers": []}
  }""",
  run_in_background=True
)

Task(
  subagent_type="frontend-ui-developer",
  prompt="""UI/UX VERIFICATION for: $ARGUMENTS

  Verify frontend compliance (READ ONLY - no changes):
  1. React 19 APIs used (useOptimistic, useFormStatus, use())
  2. Zod validation on ALL API responses
  3. Exhaustive type checking (assertNever in switches)
  4. Skeleton loading states (not spinners)
  5. Prefetching on navigation links
  6. WCAG 2.1 AA accessibility

  Output JSON:
  {
    "react_19": {"apis_used": [...], "missing": [], "compliant": true/false},
    "zod_validation": {"validated_endpoints": N, "unvalidated": []},
    "type_safety": {"exhaustive_switches": true/false, "any_types": N},
    "ux_patterns": {"skeletons": true/false, "prefetching": true/false},
    "accessibility": {"wcag_issues": []},
    "approval": {"status": "PASS/FAIL", "blockers": []}
  }""",
  run_in_background=True
)
```

### Conditional Agents (Add When Applicable)

```python
# Add for AI/ML features
Task(
  subagent_type="llm-integrator",
  prompt="Verify LLM integration: token limits, caching, error handling...",
  run_in_background=True
)

# Add for performance-critical features
Task(
  subagent_type="performance-engineer",
  prompt="Verify performance: bundle size, Core Web Vitals, N+1 queries...",
  run_in_background=True
)
```

## Phase 3: Parallel Test Execution

After agent dispatch, run actual tests in parallel:

```bash
# PARALLEL - Run backend and frontend tests simultaneously

# Backend tests
cd /path/to/backend && poetry run pytest tests/ -v \
  --cov=app --cov-report=term-missing --cov-report=json \
  --tb=short --maxfail=5

# Frontend tests
cd /path/to/frontend && npm run test -- --coverage --passWithNoTests
```

### Test Scope by Argument

| Argument | Backend Command | Frontend Command |
|----------|----------------|------------------|
| (none) | Full test suite | Full test suite |
| `unit` | `pytest tests/unit/` | `npm test -- unit` |
| `integration` | `pytest tests/integration/` | `npm test -- integration` |
| `e2e` | Skip | `npx playwright test` |

## Phase 4: Evidence Compilation & Report

### 4a. Collect Agent Results

Wait for all background agents to complete, then synthesize:

```python
# Update tasks as agents complete
TaskUpdate(taskId="2", status="completed")  # Quality checks done
TaskUpdate(taskId="3", status="completed")  # Security audit done
# ... etc
```

### 4b. Generate Verification Report

Use the template from `references/report-template.md`:

```markdown
# Feature Verification Report
**Date**: [TODAY'S DATE]
**Branch**: [branch-name]
**Feature**: $ARGUMENTS
**Reviewer**: Claude Code with 5 parallel subagents

## Summary
[READY FOR MERGE | NEEDS ATTENTION | BLOCKED]

## Agent Results

### Code Quality (code-quality-reviewer)
| Check | Status | Details |
|-------|--------|---------|
| Linting | [result] | [errors/warnings] |
| Type Check | [result] | [type errors] |
| Patterns | [result] | [violations] |

### Security (security-auditor)
| Check | Status | Issues |
|-------|--------|--------|
| Dependencies | [result] | [critical/high counts] |
| Secrets Scan | [result] | [findings] |
| OWASP | [result] | [issues] |

### Test Coverage (test-generator)
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Coverage | X% | 70% | [result] |
| Tests Passed | X/Y | 100% | [result] |

### API Compliance (backend-system-architect)
| Check | Status |
|-------|--------|
| REST Conventions | [result] |
| Pydantic v2 | [result] |
| Error Handling | [result] |

### UI Compliance (frontend-ui-developer)
| Check | Status |
|-------|--------|
| React 19 APIs | [result] |
| Zod Validation | [result] |
| Accessibility | [result] |

## Quality Gates
| Gate | Required | Actual | Status |
|------|----------|--------|--------|
| Test Coverage | >= 70% | X% | [PASS/FAIL] |
| Security (Critical) | 0 | N | [PASS/FAIL] |
| Type Errors | 0 | N | [PASS/FAIL] |
| Lint Errors | 0 | N | [PASS/FAIL] |

## Blockers (Must Fix)
- [List any blocking issues]

## Suggestions (Non-Blocking)
- [List improvement suggestions]

## Evidence
- Test output: `/tmp/test_results.log`
- Coverage: `/tmp/coverage.json`
- Security scan: `/tmp/security_audit.json`
```

### 4c. Mark Verification Complete

```python
# Only mark complete when ALL checks pass
TaskUpdate(taskId="1", status="completed")
```

## Phase 5: E2E Verification (Optional)

For UI changes, verify with agent-browser:

```bash
# Start verification session
agent-browser open http://localhost:5173
agent-browser wait --load networkidle

# Capture snapshot with interactive refs
agent-browser snapshot -i

# Click elements using refs
agent-browser click @e1  # Login button
agent-browser type @e2 "test@example.com"

# Capture evidence
agent-browser screenshot /tmp/verification.png

# Cleanup
agent-browser close
```

## Optimization Patterns

### Pattern 1: Scope-Based Agent Selection

```python
# Backend-only verification (3 agents)
if scope == "backend":
    agents = ["code-quality-reviewer", "security-auditor", "backend-system-architect"]

# Frontend-only verification (3 agents)
elif scope == "frontend":
    agents = ["code-quality-reviewer", "test-generator", "frontend-ui-developer"]

# Full-stack (5 agents)
else:
    agents = ["code-quality-reviewer", "security-auditor", "test-generator",
              "backend-system-architect", "frontend-ui-developer"]
```

### Pattern 2: Fast-Fail on Blockers

```python
# If security audit finds critical issues, prioritize that report
if security_result.critical > 0:
    return early_exit_with_blockers(security_result)
```

### Pattern 3: Incremental Verification

```python
# For PRs, only verify changed files
changed_files = git_diff_files(base="main")
scope_agents_by_files(changed_files)
```

## Related Skills

- `implement` - Full implementation with verification
- `review-pr` - PR-specific verification workflow
- `run-tests` - Detailed test execution patterns
- `evidence-verification` - Evidence collection standards
- `code-review-playbook` - Review quality patterns

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent Count | 5-7 | Balance between coverage and context usage |
| Parallel Dispatch | All at once | Maximum speed, agents are independent |
| Task Tracking | CC 2.1.16 | Progress visibility, dependency management |
| Evidence Format | JSON | Machine-readable for automation |
| Quality Threshold | 70% coverage | Industry standard minimum |

## References

- [Verification Report Template](references/report-template.md)