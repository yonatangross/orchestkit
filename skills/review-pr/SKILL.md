---
name: review-pr
description: Comprehensive PR review with 6-7 parallel specialized agents. Use when reviewing pull requests, checking PRs, code review.
context: fork
version: 1.1.0
author: SkillForge
tags: [code-review, pull-request, quality, security, testing]
user-invocable: true
---

# Review PR

Deep code review using 6-7 parallel specialized agents.

## Quick Start

```bash
/review-pr 123
/review-pr feature-branch
```

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
Task(subagent_type="code-quality-reviewer", prompt="Review readability...", run_in_background=True)
Task(subagent_type="code-quality-reviewer", prompt="Review type safety...", run_in_background=True)
Task(subagent_type="security-auditor", prompt="Security audit...", run_in_background=True)
Task(subagent_type="test-generator", prompt="Test coverage...", run_in_background=True)
Task(subagent_type="backend-system-architect", prompt="API review...", run_in_background=True)
Task(subagent_type="frontend-ui-developer", prompt="React review...", run_in_background=True)
```

### Optional: AI Code Review

If PR includes AI/ML code, add 7th agent:

```python
Task(subagent_type="llm-integrator", prompt="Review LLM patterns...", run_in_background=True)
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
## References

- [Review Template](references/review-template.md)