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

  Scope: ONLY read files directly relevant to the PR diff. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [brief list]"
  """,
  run_in_background=True,
  max_turns=25
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

  Scope: ONLY read files directly relevant to the PR diff. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] type issues: [brief list]"
  """,
  run_in_background=True,
  max_turns=25
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

  Scope: ONLY read files directly relevant to the PR diff. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [PASS|WARN|BLOCK] - [N] findings: [severity summary]"
  """,
  run_in_background=True,
  max_turns=25
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

  Scope: ONLY read files directly relevant to the PR diff. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [N]% coverage, [M] gaps - [key missing test]"
  """,
  run_in_background=True,
  max_turns=25
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

  Scope: ONLY read files directly relevant to the PR diff. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [key concern]"
  """,
  run_in_background=True,
  max_turns=25
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

  Scope: ONLY read files directly relevant to the PR diff. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [key concern]"
  """,
  run_in_background=True,
  max_turns=25
)
```
