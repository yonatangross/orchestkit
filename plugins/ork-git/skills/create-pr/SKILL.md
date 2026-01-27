---
name: create-pr
description: Create GitHub pull requests with validation and auto-generated descriptions. Use when creating pull requests, opening PRs, submitting code for review.
context: fork
version: 2.2.0
author: OrchestKit
tags: [git, github, pull-request, pr, code-review]
user-invocable: true
allowedTools: [Bash, Task, TaskCreate, TaskUpdate, mcp__memory__search_nodes]
skills: [commit, review-pr, security-scanning, recall]
---

# Create Pull Request

Comprehensive PR creation with validation. All output goes directly to GitHub PR.

## Quick Start

```bash
/create-pr
```

---

## ⚠️ CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to show progress:**

```python
# 1. Create main PR task IMMEDIATELY
TaskCreate(
  subject="Create PR for {branch}",
  description="PR creation with parallel validation agents",
  activeForm="Creating pull request"
)

# 2. Create subtasks for phases
TaskCreate(subject="Pre-flight checks", activeForm="Running pre-flight checks")
TaskCreate(subject="Run parallel validation agents", activeForm="Validating with agents")
TaskCreate(subject="Run local tests", activeForm="Running local tests")
TaskCreate(subject="Create PR on GitHub", activeForm="Creating GitHub PR")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting phase
TaskUpdate(taskId="2", status="completed")    # When phase done
```

---

## Workflow

### Phase 1: Pre-Flight Checks

```bash
# Verify branch
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "dev" || "$BRANCH" == "main" ]]; then
  echo "Cannot create PR from dev/main. Create a feature branch first."
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Uncommitted changes detected. Commit or stash first."
  exit 1
fi

# Push branch if needed
git fetch origin
if ! git rev-parse --verify origin/$BRANCH &>/dev/null; then
  git push -u origin $BRANCH
fi
```

### Phase 2: Parallel Pre-PR Validation (3 Agents)

Launch validation agents in ONE message BEFORE creating PR:

```python
# PARALLEL - All 3 in ONE message
Task(
  subagent_type="security-auditor",
  prompt="""Security audit for PR changes:
  1. Check for secrets/credentials in diff
  2. Dependency vulnerabilities (npm audit/pip-audit)
  3. OWASP Top 10 quick scan
  Return: {status: PASS/BLOCK, issues: [...]}

  SUMMARY: End with: "RESULT: [PASS|WARN|BLOCK] - [N] issues: [brief list or 'clean']"
  """,
  run_in_background=True
)
Task(
  subagent_type="test-generator",
  prompt="""Test coverage verification:
  1. Run test suite with coverage
  2. Identify untested code in changed files
  Return: {coverage: N%, passed: N/N, gaps: [...]}

  SUMMARY: End with: "RESULT: [N]% coverage, [passed]/[total] tests - [status]"
  """,
  run_in_background=True
)
Task(
  subagent_type="code-quality-reviewer",
  prompt="""Code quality check:
  1. Run linting (ruff/eslint)
  2. Type checking (mypy/tsc)
  3. Check for anti-patterns
  Return: {lint_errors: N, type_errors: N, issues: [...]}

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] lint, [M] type errors"
  """,
  run_in_background=True
)
```

Wait for agents, then run local validation:

```bash
# Backend
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run pytest tests/unit/ -v --tb=short -x

# Frontend
cd ../frontend
npm run lint && npm run typecheck
```

### Phase 3: Gather Context

```bash
BRANCH=$(git branch --show-current)
ISSUE=$(echo $BRANCH | grep -oE '[0-9]+' | head -1)

git log --oneline dev..HEAD
git diff dev...HEAD --stat
```

### Phase 4: Create PR

```bash
TYPE="feat"  # Determine: feat/fix/refactor/docs/test/chore

gh pr create --base dev \
  --title "$TYPE(#$ISSUE): Brief description" \
  --body "## Summary
[1-2 sentence description]

## Changes
- [Change 1]
- [Change 2]

## Test Plan
- [x] Unit tests pass
- [x] Lint/type checks pass

Closes #$ISSUE

---
Generated with [Claude Code](https://claude.com/claude-code)"
```

### Phase 5: Verify

```bash
PR_URL=$(gh pr view --json url -q .url)
echo "PR created: $PR_URL"
gh pr view --web
```

## CC 2.1.20 Enhancements

### Optional Slack Notification

After creating a PR, optionally notify the team:

```
mcp__slack__post_message({
  channel: "#dev-prs",
  text: "New PR: #{number} - {title} | {files} files, +{additions}/-{deletions}"
})
```

CC 2.1.20's `/commit-push-pr` flow can be extended with Slack auto-posting. See `slack-integration` skill for setup.

## Rules

1. **NO junk files** - Don't create files in repo root
2. **Run validation locally** - Don't spawn agents for lint/test
3. **All content goes to GitHub** - PR body via `gh pr create --body`
4. **Keep it simple** - One command to create PR

## Agent Usage

Only use Task agents for:
- Complex code analysis requiring multiple files
- Security review of sensitive changes
- Architecture review for large refactors

## Related Skills
- commit: Create commits before PRs
- review-pr: Review PRs after creation
- slack-integration: Team notifications for PR events
## References

- [PR Template](assets/pr-template.md)