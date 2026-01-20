---
name: fix-issue
description: Fix GitHub issue with parallel analysis and implementation. Use when fixing issues, resolving bugs, closing GitHub issues.
context: fork
version: 1.0.0
author: SkillForge
tags: [issue, bug-fix, github, debugging]
user-invocable: true
---

# Fix Issue

Systematic issue resolution with 5-7 parallel agents.

## Quick Start

```bash
/fix-issue 123
/fix-issue 456
```

## Phase 1: Understand the Issue

```bash
# Get full issue details
gh issue view $ARGUMENTS --json title,body,labels,assignees,comments

# Check related PRs
gh pr list --search "issue:$ARGUMENTS"
```

## Phase 2: Create Feature Branch

```bash
git checkout dev
git pull origin dev
git checkout -b issue/$ARGUMENTS-fix
```

## Phase 3: Memory Check

```python
mcp__memory__search_nodes(query="issue $ARGUMENTS")
```

## Phase 4: Parallel Analysis (5 Agents)

| Agent | Task |
|-------|------|
| Explore #1 | Root cause analysis |
| Explore #2 | Impact analysis |
| backend-system-architect | Backend fix design |
| frontend-ui-developer | Frontend fix design |
| code-quality-reviewer | Test requirements |

All 5 agents run in ONE message, then synthesize fix plan.

## Phase 5: Context7 for Patterns

```python
mcp__context7__get-library-docs(libraryId="/tiangolo/fastapi", topic="relevant")
mcp__context7__get-library-docs(libraryId="/facebook/react", topic="relevant")
```

## Phase 6: Implement the Fix (2 Agents)

| Agent | Task |
|-------|------|
| backend/frontend | Implement fix |
| code-quality-reviewer | Write tests |

Requirements:
- Make minimal, focused changes
- Add proper error handling
- Include type hints
- DO NOT over-engineer

## Phase 7: Validation

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

## Phase 8: Commit and PR

```bash
git add .
git commit -m "fix(#$ARGUMENTS): [Brief description]"
git push -u origin issue/$ARGUMENTS-fix
gh pr create --base dev --title "fix(#$ARGUMENTS): [Brief description]"
```

## Summary

**Total Parallel Agents: 7**
- Phase 4 (Analysis): 5 agents
- Phase 6 (Implementation): 2 agents

**Agents Used:**
- 2 Explore (root cause, impact)
- 1 backend-system-architect
- 1 frontend-ui-developer
- 2 code-quality-reviewer

**Workflow:**
1. Understand issue
2. Create branch
3. Parallel analysis
4. Design fix
5. Implement + test
6. Validate
7. PR with issue reference

## Related Skills
- commit: Commit issue fixes
- debug-investigator: Debug complex issues
- errors: Handle error patterns
- issue-progress-tracking: Auto-updates issue checkboxes from commits
## References

- [Commit Template](references/commit-template.md)