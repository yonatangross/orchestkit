---
description: "Creates GitHub pull requests with validation. Use when opening PRs or submitting code for review."
allowed-tools: [AskUserQuestion, Bash, Task, TaskCreate, TaskUpdate, mcp__memory__search_nodes]
---

# Auto-generated from skills/create-pr/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Create Pull Request

Comprehensive PR creation with validation. All output goes directly to GitHub PR.

## Quick Start

```bash
/ork:create-pr
/ork:create-pr "Add user authentication"
```

## Argument Resolution

```python
TITLE = "$ARGUMENTS"  # Optional PR title, e.g., "Add user authentication"
# If provided, use as PR title. If empty, generate from branch/commits.
# $ARGUMENTS[0] is the first token (CC 2.1.59 indexed access)
```


## STEP 0: Verify User Intent

**BEFORE creating tasks**, clarify PR type with AskUserQuestion:

- **Feature**: Full validation with all agents
- **Bug fix**: Focus on test verification
- **Refactor**: Skip new feature validation
- **Quick**: Skip all validation, just create PR


## STEP 1: Create Tasks (MANDATORY)

Create tasks immediately to show progress:

```python
TaskCreate(subject="Create PR for {branch}", description="PR creation with validation", activeForm="Creating pull request")
TaskCreate(subject="Pre-flight checks", activeForm="Running pre-flight checks")
TaskCreate(subject="Run validation agents", activeForm="Validating with agents")
TaskCreate(subject="Run local tests", activeForm="Running local tests")
TaskCreate(subject="Create PR on GitHub", activeForm="Creating GitHub PR")
```


## Workflow

### Phase 1: Pre-Flight Checks

See `rules/preflight-validation.md` for the full checklist.

```bash
BRANCH=$(git branch --show-current)
[[ "$BRANCH" == "dev" || "$BRANCH" == "main" ]] && echo "Cannot PR from dev/main" && exit 1
[[ -n $(git status --porcelain) ]] && echo "Uncommitted changes" && exit 1

git fetch origin
git rev-parse --verify "origin/$BRANCH" &>/dev/null || git push -u origin "$BRANCH"
```

### Phase 2: Parallel Validation (Feature/Bug fix PRs)

Launch agents in ONE message. See `references/parallel-validation.md` for full agent configs.

| PR Type | Agents to launch |
|---------|-----------------|
| Feature | security-auditor + test-generator + code-quality-reviewer |
| Bug fix | test-generator only |
| Refactor | code-quality-reviewer only |
| Quick | None |

After agents complete, run local validation:

```bash
# Adapt to project stack
npm run lint && npm run typecheck && npm test -- --bail
# or: ruff check . && pytest tests/unit/ -v --tb=short -x
```

### Phase 3: Gather Context

```bash
BRANCH=$(git branch --show-current)
ISSUE=$(echo "$BRANCH" | grep -oE '[0-9]+' | head -1)
git log --oneline dev..HEAD
git diff dev...HEAD --stat
```

### Phase 4: Create PR

Follow `rules/pr-title-format.md` and `rules/pr-body-structure.md`. Use HEREDOC pattern from `references/pr-body-templates.md`.

```bash
TYPE="feat"  # Determine: feat/fix/refactor/docs/test/chore
gh pr create --base dev \
  --title "$TYPE(#$ISSUE): Brief description" \
  --body "$(cat <<'EOF'
## Summary
[1-2 sentence description]

## Changes
- [Change 1]
- [Change 2]

## Test Plan
- [x] Unit tests pass
- [x] Lint/type checks pass

Closes #$ISSUE

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Phase 5: Verify

```bash
PR_URL=$(gh pr view --json url -q .url)
echo "PR created: $PR_URL"
```


## Rules

1. **NO junk files** — Don't create files in repo root
2. **Run validation locally** — Don't spawn agents for lint/test
3. **All content goes to GitHub** — PR body via `gh pr create --body`
4. **Keep it simple** — One command to create PR

## Related Skills

- `ork:commit` — Create commits before PRs
- `ork:review-pr` — Review PRs after creation

## References

- [PR Body Templates](references/pr-body-templates.md)
- [Parallel Validation Agents](references/parallel-validation.md)
- [CI Integration Patterns](references/ci-integration.md)
- [Multi-Commit PR Guidance](references/multi-commit-pr.md)
- [PR Template (legacy)](assets/pr-template.md)
