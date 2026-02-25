---
title: Parallel Validation Agents
version: 1.0.0
---

# Parallel Validation Agents

## Overview

For Feature and Bug fix PRs, launch validation agents in parallel BEFORE creating the PR. All three agents run in ONE message using `run_in_background=True`.

## Agent Configuration

### Security Auditor

```python
Task(
  subagent_type="security-auditor",
  prompt="""Security audit for PR changes:
  1. Check for secrets/credentials in diff
  2. Dependency vulnerabilities (npm audit/pip-audit)
  3. OWASP Top 10 quick scan
  Return: {status: PASS/BLOCK, issues: [...]}

  Scope: ONLY read files directly relevant to the PR diff. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [PASS|WARN|BLOCK] - [N] issues: [brief list or 'clean']"
  """,
  run_in_background=True,
  max_turns=25
)
```

### Test Generator

```python
Task(
  subagent_type="test-generator",
  prompt="""Test coverage verification:
  1. Run test suite with coverage
  2. Identify untested code in changed files
  Return: {coverage: N%, passed: N/N, gaps: [...]}

  Scope: ONLY read files directly relevant to the PR diff. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [N]% coverage, [passed]/[total] tests - [status]"
  """,
  run_in_background=True,
  max_turns=25
)
```

### Code Quality Reviewer

```python
Task(
  subagent_type="code-quality-reviewer",
  prompt="""Code quality check:
  1. Run linting (ruff/eslint)
  2. Type checking (mypy/tsc)
  3. Check for anti-patterns
  Return: {lint_errors: N, type_errors: N, issues: [...]}

  Scope: ONLY read files directly relevant to the PR diff. Do NOT explore the entire codebase.

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] lint, [M] type errors"
  """,
  run_in_background=True,
  max_turns=25
)
```

## When to Use Agents

| PR Type | Agents |
|---------|--------|
| Feature | All 3 (security + tests + quality) |
| Bug fix | test-generator only |
| Refactor | code-quality-reviewer only |
| Quick | None — skip agent validation |

## After Agent Results

Wait for all agents to complete, then run local validation (lint + test) to confirm. Agent results inform the PR body's Test Plan section.
