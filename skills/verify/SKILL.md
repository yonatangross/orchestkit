---
name: verify
description: Comprehensive feature verification with parallel analysis agents. Use when verifying implementations, testing changes, validating features, or checking correctness.
context: fork
version: 1.1.0
author: SkillForge
tags: [verification, testing, quality, validation]
---

# Verify Feature

Comprehensive verification using parallel specialized agents.

## When to Use

- Verifying completed features
- Pre-merge validation
- Quality gate checks
- End-to-end verification

## Quick Start

```bash
/verify authentication flow
/verify user profile feature
```

## Phase 1: Gather Context

```bash
# Get recent changes
git diff main --stat
git log main..HEAD --oneline

# Identify affected areas
git diff main --name-only | sort -u
```

## Phase 2: Skills Auto-Loading (CC 2.1.6)

**CC 2.1.6 auto-discovers skills** - no manual loading needed!

Relevant skills activated automatically:
- `code-review-playbook` - Quality patterns
- `security-scanning` - Security validation
- `evidence-verification` - Completion proof

## Phase 3: Parallel Verification (5 Agents)

Launch ALL agents in ONE message with `run_in_background: true`:

| Agent | Focus |
|-------|-------|
| code-quality-reviewer | Code quality, patterns |
| security-auditor | Security compliance |
| test-generator | Test coverage |
| backend-system-architect | API correctness |
| frontend-ui-developer | UI/UX validation |

```python
# PARALLEL - All 5 agents in ONE message
Task(subagent_type="code-quality-reviewer", prompt="Verify code quality...", run_in_background=True)
Task(subagent_type="security-auditor", prompt="Verify security...", run_in_background=True)
Task(subagent_type="test-generator", prompt="Verify test coverage...", run_in_background=True)
Task(subagent_type="backend-system-architect", prompt="Verify API...", run_in_background=True)
Task(subagent_type="frontend-ui-developer", prompt="Verify UI...", run_in_background=True)
```

## Phase 4: Run Tests

```bash
# Backend tests
cd backend && poetry run pytest tests/ -v --cov=app --cov-report=term-missing

# Frontend tests
cd frontend && npm run test -- --coverage

# E2E tests (if available)
cd e2e && npx playwright test
```

## Phase 5: Compile Evidence

```markdown
# Verification Report

## Feature: [Name]

## Test Results
- Unit Tests: X/Y passed
- Integration Tests: X/Y passed
- E2E Tests: X/Y passed
- Coverage: X%

## Quality Gates
| Gate | Status |
|------|--------|
| Type Safety | / |
| Security Scan | / |
| Linting | / |
| Coverage >= 70% | / |

## Evidence
- Test output attached
- Coverage report attached
- Security scan results attached
```

## Phase 6: E2E Verification (Optional)

If UI changes, verify with Playwright MCP:

```python
mcp__playwright__browser_navigate(url="http://localhost:5173")
mcp__playwright__browser_snapshot()
mcp__playwright__browser_take_screenshot(filename="verification.png")
```


## Related Skills
- implement: Verify implementations
- code-review-playbook: Code review patterns for verification
## References

- [Verification Checklist](references/verification-checklist.md)