---
name: review-pr
description: Comprehensive PR review with 6-7 parallel specialized agents. Use when reviewing pull requests, checking PRs, code review.
context: fork
version: 1.3.1
author: OrchestKit
tags: [code-review, pull-request, quality, security, testing]
user-invocable: true
allowedTools: [Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__memory__search_nodes]
skills: [code-review-playbook, security-scanning, type-safety-validation, recall]
---

# Review PR

Deep code review using 6-7 parallel specialized agents.

## Quick Start

```bash
/review-pr 123
/review-pr feature-branch
```

---

## ⚠️ CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main review task IMMEDIATELY
TaskCreate(
  subject="Review PR #{number}",
  description="Comprehensive code review with parallel agents",
  activeForm="Reviewing PR #{number}"
)

# 2. Create subtasks for each phase
TaskCreate(subject="Gather PR information", activeForm="Gathering PR information")
TaskCreate(subject="Launch review agents", activeForm="Dispatching review agents")
TaskCreate(subject="Run validation checks", activeForm="Running validation checks")
TaskCreate(subject="Synthesize review", activeForm="Synthesizing review")
TaskCreate(subject="Submit review", activeForm="Submitting review")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

---

## Phase 1: Gather PR Information

```bash
# Get PR details
gh pr view $ARGUMENTS --json title,body,files,additions,deletions,commits,author

# View the diff
gh pr diff $ARGUMENTS

# Check CI status
gh pr checks $ARGUMENTS
```

Identify:
- Total files changed
- Lines added/removed
- Affected domains (frontend, backend, AI)

## Phase 2: Skills Auto-Loading (CC 2.1.6)

**CC 2.1.6 auto-discovers skills** - no manual loading needed!

Relevant skills activated automatically:
- `code-review-playbook` - Review patterns, conventional comments
- `security-scanning` - OWASP, secrets, dependencies
- `type-safety-validation` - Zod, TypeScript strict

## Phase 3: Parallel Code Review (6 Agents)

Launch SIX specialized reviewers in ONE message with `run_in_background: true`:

| Agent | Focus Area |
|-------|-----------|
| code-quality-reviewer #1 | Readability, complexity, DRY |
| code-quality-reviewer #2 | Type safety, Zod, Pydantic |
| security-auditor | Security, secrets, injection |
| test-generator | Test coverage, edge cases |
| backend-system-architect | API, async, transactions |
| frontend-ui-developer | React 19, hooks, a11y |

```python
# PARALLEL - All 6 agents in ONE message
Task(
  description="Review code quality",
  subagent_type="code-quality-reviewer",
  prompt="""CODE QUALITY REVIEW for PR $ARGUMENTS

  Review code readability and maintainability:
  1. Naming conventions and clarity
  2. Function/method complexity (cyclomatic < 10)
  3. DRY violations and code duplication
  4. SOLID principles adherence

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [brief list]"
  """,
  run_in_background=True
)
Task(
  description="Review type safety",
  subagent_type="code-quality-reviewer",
  prompt="""TYPE SAFETY REVIEW for PR $ARGUMENTS

  Review type safety and validation:
  1. TypeScript strict mode compliance
  2. Zod/Pydantic schema usage
  3. No `any` types or type assertions
  4. Exhaustive switch/union handling

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] type issues: [brief list]"
  """,
  run_in_background=True
)
Task(
  description="Security audit PR",
  subagent_type="security-auditor",
  prompt="""SECURITY REVIEW for PR $ARGUMENTS

  Security audit:
  1. Secrets/credentials in code
  2. Injection vulnerabilities (SQL, XSS)
  3. Authentication/authorization checks
  4. Dependency vulnerabilities

  SUMMARY: End with: "RESULT: [PASS|WARN|BLOCK] - [N] findings: [severity summary]"
  """,
  run_in_background=True
)
Task(
  description="Review test coverage",
  subagent_type="test-generator",
  prompt="""TEST COVERAGE REVIEW for PR $ARGUMENTS

  Review test quality:
  1. Test coverage for changed code
  2. Edge cases and error paths tested
  3. Meaningful assertions (not just truthy)
  4. No flaky tests (timing, external deps)

  SUMMARY: End with: "RESULT: [N]% coverage, [M] gaps - [key missing test]"
  """,
  run_in_background=True
)
Task(
  description="Review backend code",
  subagent_type="backend-system-architect",
  prompt="""BACKEND REVIEW for PR $ARGUMENTS

  Review backend code:
  1. API design and REST conventions
  2. Async/await patterns and error handling
  3. Database query efficiency (N+1)
  4. Transaction boundaries

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [key concern]"
  """,
  run_in_background=True
)
Task(
  description="Review frontend code",
  subagent_type="frontend-ui-developer",
  prompt="""FRONTEND REVIEW for PR $ARGUMENTS

  Review frontend code:
  1. React 19 patterns (hooks, server components)
  2. State management correctness
  3. Accessibility (a11y) compliance
  4. Performance (memoization, lazy loading)

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [key concern]"
  """,
  run_in_background=True
)
```

### Optional: AI Code Review

If PR includes AI/ML code, add 7th agent:

```python
Task(
  description="Review LLM integration",
  subagent_type="llm-integrator",
  prompt="""LLM CODE REVIEW for PR $ARGUMENTS

  Review AI/LLM integration:
  1. Prompt injection prevention
  2. Token limit handling
  3. Caching strategy
  4. Error handling and fallbacks

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] LLM issues: [key concern]"
  """,
  run_in_background=True
)
```

## Phase 4: Run Validation

```bash
# Backend
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run pytest tests/unit/ -v --tb=short

# Frontend
cd frontend
npm run format:check
npm run lint
npm run typecheck
npm run test
```

## Phase 5: Synthesize Review

Combine all agent feedback into structured report:

```markdown
# PR Review: #$ARGUMENTS

## Summary
[1-2 sentence overview]

## Code Quality
| Area | Status | Notes |
|------|--------|-------|
| Readability | // | [notes] |
| Type Safety | // | [notes] |
| Test Coverage | // | [X%] |

## Security
| Check | Status |
|-------|--------|
| Secrets | / |
| Input Validation | / |
| Dependencies | / |

## Blockers (Must Fix)
- [if any]

## Suggestions (Non-Blocking)
- [improvements]
```

## Phase 6: Submit Review

```bash
# Approve
gh pr review $ARGUMENTS --approve -b "Review message"

# Request changes
gh pr review $ARGUMENTS --request-changes -b "Review message"
```

## CC 2.1.20 Enhancements

### PR Status Enrichment

The `pr-status-enricher` hook automatically detects open PRs at session start and sets:
- `ORCHESTKIT_PR_URL` - PR URL for quick reference
- `ORCHESTKIT_PR_STATE` - PR state (OPEN, MERGED, CLOSED)

### Optional Slack Notification

After submitting a review, optionally notify the team:

```
mcp__slack__post_message({
  channel: "#dev-reviews",
  text: "PR #{number} reviewed: {APPROVE|REQUEST_CHANGES} - {summary}"
})
```

See `slack-integration` skill for setup.

## Conventional Comments

Use these prefixes for comments:
- `praise:` - Positive feedback
- `nitpick:` - Minor suggestion
- `suggestion:` - Improvement idea
- `issue:` - Must fix
- `question:` - Needs clarification

## Related Skills
- commit: Create commits after review
- create-pr: Create PRs for review
- slack-integration: Team notifications for review events
## References

- [Review Template](references/review-template.md)