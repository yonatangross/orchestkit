---
name: review-pr
description: Comprehensive PR review with 6-7 parallel specialized agents
context: fork
version: 1.0.0
author: SkillForge
tags: [code-review, pull-request, quality, security, testing]
---

# Review PR

Deep code review using 6-7 parallel specialized agents.

## When to Use

- Reviewing pull requests
- Code quality assessment
- Security auditing PRs
- Test coverage validation

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

## Phase 2: Load Review Skills

```python
# PARALLEL - Load capabilities
Read(".claude/skills/code-review-playbook/capabilities.json")
Read(".claude/skills/security-checklist/capabilities.json")
Read(".claude/skills/testing-strategy-builder/capabilities.json")
Read(".claude/skills/type-safety-validation/capabilities.json")
```

## Phase 3: Parallel Code Review (6 Agents)

Launch SIX specialized reviewers in ONE message:

| Agent | Focus Area |
|-------|-----------|
| code-quality-reviewer #1 | Readability, complexity, DRY |
| code-quality-reviewer #2 | Type safety, Zod, Pydantic |
| code-quality-reviewer #3 | Security, secrets, injection |
| code-quality-reviewer #4 | Test coverage, edge cases |
| backend-system-architect | API, async, transactions |
| frontend-ui-developer | React 19, hooks, a11y |

### Optional: AI Code Review

If PR includes AI/ML code, add 7th agent for:
- Prompt engineering quality
- LangGraph workflow correctness
- Token usage optimization

## Phase 4: Run Validation

```bash
# Backend
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run ty check app/
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
| Readability | ✅/⚠️/❌ | [notes] |
| Type Safety | ✅/⚠️/❌ | [notes] |
| Test Coverage | ✅/⚠️/❌ | [X%] |

## Security
| Check | Status |
|-------|--------|
| Secrets | ✅/❌ |
| Input Validation | ✅/❌ |
| Dependencies | ✅/❌ |

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

## References

- [Review Template](references/review-template.md)