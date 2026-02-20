---
title: Agent Prompts — Task Tool Mode
impact: HIGH
impactDescription: "Defines six parallel reviewer agents for comprehensive PR code review"
tags: task-tool, review, agents
---

# Agent Prompts — Task Tool Mode

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
# DOMAIN-AWARE AGENT SELECTION
# Only spawn agents relevant to detected domains.
# CHANGED_FILES and domain flags (HAS_FRONTEND, HAS_BACKEND, HAS_AI)
# are captured in Phase 1.

# ALWAYS spawn these 4 core agents:
# - code-quality-reviewer (readability)
# - code-quality-reviewer (type safety)
# - security-auditor
# - test-generator

# CONDITIONALLY spawn these based on domain:
# - backend-system-architect  → only if HAS_BACKEND
# - frontend-ui-developer     → only if HAS_FRONTEND
# - llm-integrator (7th)      → only if HAS_AI

# PARALLEL - All agents in ONE message
Task(
  description="Review code quality",
  subagent_type="code-quality-reviewer",
  prompt="""CODE QUALITY REVIEW for PR $PR_NUMBER

  Review code readability and maintainability:
  1. Naming conventions and clarity
  2. Function/method complexity (cyclomatic < 10)
  3. DRY violations and code duplication
  4. SOLID principles adherence

  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}

  Do NOT explore beyond these files. Focus your analysis on the diff.

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [brief list]"
  """,
  run_in_background=True,
  max_turns=25
)
Task(
  description="Review type safety",
  subagent_type="code-quality-reviewer",
  prompt="""TYPE SAFETY REVIEW for PR $PR_NUMBER

  Review type safety and validation:
  1. TypeScript strict mode compliance
  2. Zod/Pydantic schema usage
  3. No `any` types or type assertions
  4. Exhaustive switch/union handling

  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}

  Do NOT explore beyond these files. Focus your analysis on the diff.

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] type issues: [brief list]"
  """,
  run_in_background=True,
  max_turns=25
)
Task(
  description="Security audit PR",
  subagent_type="security-auditor",
  prompt="""SECURITY REVIEW for PR $PR_NUMBER

  Security audit:
  1. Secrets/credentials in code
  2. Injection vulnerabilities (SQL, XSS)
  3. Authentication/authorization checks
  4. Dependency vulnerabilities

  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}

  Do NOT explore beyond these files. Focus your analysis on the diff.

  SUMMARY: End with: "RESULT: [PASS|WARN|BLOCK] - [N] findings: [severity summary]"
  """,
  run_in_background=True,
  max_turns=25
)
Task(
  description="Review test adequacy",
  subagent_type="test-generator",
  prompt="""TEST ADEQUACY REVIEW for PR $PR_NUMBER

  Evaluate whether this PR has sufficient tests:

  1. TEST EXISTENCE CHECK
     - Does the PR add/modify code WITHOUT adding/updating tests?
     - Are there changed files with 0 corresponding test files?
     - Flag: "MISSING" if code changes have no tests at all

  2. TEST TYPE MATCHING (use testing-patterns rules)
     Match changed code to required test types:
     - API endpoint changes → need integration tests (rule: integration-api)
     - DB schema changes → need migration + integration tests (rule: integration-database)
     - UI component changes → need unit + a11y tests (rule: unit-aaa-pattern, a11y-jest-axe)
     - Business logic → need unit + property tests (rule: verification-property)
     - LLM/AI changes → need eval tests (rule: llm-deepeval)

  3. TEST QUALITY
     - Meaningful assertions (not just truthy/exists)
     - Edge cases and error paths covered
     - No flaky patterns (timing, external deps, random)
     - Mocking is appropriate (not over-mocked)

  4. COVERAGE GAPS
     - Which changed functions/methods lack test coverage?
     - Which error paths are untested?

  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}

  Do NOT explore beyond these files. Focus your analysis on the diff.

  SUMMARY: End with: "RESULT: [ADEQUATE|GAPS|MISSING] - [N] untested paths, [M] missing test types - [key gap]"
  """,
  run_in_background=True,
  max_turns=25
)
Task(
  description="Review backend code",
  subagent_type="backend-system-architect",
  prompt="""BACKEND REVIEW for PR $PR_NUMBER

  Review backend code:
  1. API design and REST conventions
  2. Async/await patterns and error handling
  3. Database query efficiency (N+1)
  4. Transaction boundaries

  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}

  Do NOT explore beyond these files. Focus your analysis on the diff.

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [key concern]"
  """,
  run_in_background=True,
  max_turns=25
)
Task(
  description="Review frontend code",
  subagent_type="frontend-ui-developer",
  prompt="""FRONTEND REVIEW for PR $PR_NUMBER

  Review frontend code:
  1. React 19 patterns (hooks, server components)
  2. State management correctness
  3. Accessibility (a11y) compliance
  4. Performance (memoization, lazy loading)

  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}

  Do NOT explore beyond these files. Focus your analysis on the diff.

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [key concern]"
  """,
  run_in_background=True,
  max_turns=25
)
```

**Incorrect — Sequential agents:**
```python
# 6 reviewers run one-by-one (slow)
Task(subagent_type="code-quality-reviewer", prompt="...")
# Wait for completion
Task(subagent_type="security-auditor", prompt="...")
# Wait again...
```

**Correct — Parallel agents:**
```python
# All 6 agents in ONE message (fast)
Task(subagent_type="code-quality-reviewer", prompt="...", run_in_background=True)
Task(subagent_type="security-auditor", prompt="...", run_in_background=True)
Task(subagent_type="test-generator", prompt="...", run_in_background=True)
# All launch simultaneously
```
