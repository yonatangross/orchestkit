---
name: verify
description: Comprehensive feature verification with parallel analysis agents
context: fork
version: 1.0.0
author: SkillForge
tags: [verification, testing, security, code-quality]
---

# Verify Feature Branch

Complete verification using subagents, skills, MCPs, and latest best practices.

## When to Use

- Verifying feature branches before merge
- Running comprehensive code quality checks
- Security auditing changes
- Validating against current best practices

## Quick Start

```bash
/verify                    # Verify current branch
/verify issue/123-feature  # Verify specific branch
```

## Step 1: Analyze Scope

```bash
# What changed?
git diff --name-only dev...HEAD
git log --oneline dev..HEAD
```

Identify libraries used, patterns implemented, and complexity.

## Step 2: Fetch Latest Best Practices

### Web Search
```python
WebSearch("React 19 best practices 2025")
WebSearch("FastAPI security patterns 2025")
WebSearch("Python CVE security vulnerabilities 2025")
```

### Context7 Documentation
```python
mcp__context7__get-library-docs(libraryId="/facebook/react", topic="hooks")
mcp__context7__get-library-docs(libraryId="/tiangolo/fastapi", topic="dependencies")
```

## Step 3: Load Review Skills

```python
Read(".claude/skills/code-review-playbook/capabilities.json")
Read(".claude/skills/security-checklist/capabilities.json")
Read(".claude/skills/testing-strategy-builder/capabilities.json")
```

## Step 4: Parallel Code Review (3 Agents)

Launch THREE reviewers in ONE message:

| Agent | Focus |
|-------|-------|
| code-quality-reviewer #1 | Backend: Ruff, ty, tests |
| code-quality-reviewer #2 | Frontend: Biome, ESLint, tsc |
| code-quality-reviewer #3 | Security: OWASP, secrets, deps |

## Step 5: Run Test Suite

```bash
# Backend
cd backend
poetry run pytest tests/unit/ -v --tb=short \
  --cov=app --cov-report=term-missing --cov-fail-under=80

# Frontend
cd frontend
npm run test -- --coverage
```

## Step 6: E2E Verification

If UI changes, use Playwright MCP:

```python
mcp__playwright__browser_navigate(url="http://localhost:5173")
mcp__playwright__browser_snapshot()
mcp__playwright__browser_take_screenshot(filename="e2e-verification.png")
```

## Step 7: Generate Report

Output structured report:

| Section | Content |
|---------|---------|
| Summary | READY / NEEDS ATTENTION / BLOCKED |
| Code Quality | Lint, types, format checks |
| Test Results | Pass/fail counts, coverage |
| Security | Secrets scan, npm/pip audit |
| Suggestions | Non-blocking improvements |
| Blockers | Must-fix issues |

## Tools Used

- context7 MCP (library documentation)
- WebSearch (today's best practices)
- 3 parallel subagents (backend, frontend, security)
- Skills (code-review, security, testing)
- Playwright MCP (E2E verification)
- Evidence collection (logs, screenshots)

## References

- [Report Template](references/report-template.md)