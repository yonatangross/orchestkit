---
name: commit
license: MIT
compatibility: "Claude Code 2.1.76+."
description: "Creates commits with conventional format and validation. Use when committing changes or generating commit messages."
argument-hint: "[message]"
context: inherit
agent: git-operations-engineer
version: 1.2.0
author: OrchestKit
tags: [git, commit, version-control, conventional-commits]
user-invocable: true
disable-model-invocation: true
allowed-tools: [Bash]
skills: [chain-patterns]
complexity: low
effort: low
hooks:
  PreToolUse:
    - matcher: "Bash"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/commit-convention-loader"
      once: true
    - matcher: "Bash(git *)"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs pretool/bash/git-validator"
metadata:
  category: workflow-automation
---

# Smart Commit

Simple, validated commit creation. Run checks locally, no agents needed for standard commits.

## Quick Start

```bash
/ork:commit
/ork:commit fix typo in auth module
```

## Argument Resolution

```python
COMMIT_MSG = "$ARGUMENTS"  # Optional commit message, e.g., "fix typo in auth module"
# If provided, use as commit message. If empty, generate from staged changes.
# $ARGUMENTS[0] is the first token (CC 2.1.59 indexed access)
```

## Workflow

### Phase 1: Pre-Commit Safety Check

```bash
# CRITICAL: Verify we're not on dev/main
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "dev" || "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  echo "STOP! Cannot commit directly to $BRANCH"
  echo "Create a feature branch: git checkout -b issue/<number>-<description>"
  exit 1
fi
```

### Phase 2: Run Validation Locally

Run every check that CI runs:

```bash
# Backend (Python)
poetry run ruff format --check app/
poetry run ruff check app/
poetry run mypy app/

# Frontend (Node.js)
npm run format:check
npm run lint
npm run typecheck
```

Fix any failures before proceeding.

### Phase 3: Review Changes

```bash
git status
git diff --staged   # What will be committed
git diff            # Unstaged changes
```

### Phase 4: Stage and Commit

```bash
# Stage files
git add <files>
# Or all: git add .

# Commit with conventional format
git commit -m "<type>(#<issue>): <brief description>

- [Change 1]
- [Change 2]

Co-Authored-By: Claude <noreply@anthropic.com>"

# Verify
git log -1 --stat
```

### Handoff File

After successful commit, write handoff:

```python
Write(".claude/chain/committed.json", JSON.stringify({
  "phase": "commit", "sha": "<commit-sha>",
  "message": "<commit-message>", "branch": "<branch>",
  "files": [<staged-files>]
}))
```

## Commit Types

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code improvement |
| `docs` | Documentation |
| `test` | Tests only |
| `chore` | Build/deps/CI |

## Rules

1. **Run validation locally** - Don't spawn agents to run lint/test
2. **NO file creation** - Don't create MD files or documentation
3. **One logical change per commit** - Keep commits focused
4. **Reference issues** - Use `#123` format in commit message
5. **Subject line < 72 chars** - Keep it concise

## Quick Commit

For trivial changes (typos, single-line fixes):

```bash
git add . && git commit -m "fix(#123): Fix typo in error message

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Related Skills
- `ork:create-pr`: Create pull requests from commits
- `ork:review-pr`: Review changes before committing
- `ork:fix-issue`: Fix issues and commit the fixes
- `ork:issue-progress-tracking`: Auto-updates GitHub issues with commit progress

## Rules

Each category has individual rule files in `rules/` loaded on-demand:

| Category | Rule | Impact | Key Pattern |
|----------|------|--------|-------------|
| Atomic Commits | `${CLAUDE_SKILL_DIR}/rules/atomic-commit.md` | CRITICAL | One logical change per commit, atomicity test |
| Branch Protection | `${CLAUDE_SKILL_DIR}/rules/branch-protection.md` | CRITICAL | Protected branches, required PR workflow |
| Commit Splitting | `${CLAUDE_SKILL_DIR}/rules/commit-splitting.md` | HIGH | `git add -p`, interactive staging, separation strategies |
| Conventional Format | `${CLAUDE_SKILL_DIR}/rules/conventional-format.md` | HIGH | type(scope): description, breaking changes |
| History Hygiene | `${CLAUDE_SKILL_DIR}/rules/history-hygiene.md` | HIGH | Squash WIP, fixup commits, clean history |
| Issue Reference | `${CLAUDE_SKILL_DIR}/rules/issue-reference-required.md` | HIGH | Reference issue `#N` in commits on issue branches |
| Merge Strategy | `${CLAUDE_SKILL_DIR}/rules/merge-strategy.md` | HIGH | Rebase-first, conflict resolution, force-with-lease |
| Stacked PRs | `${CLAUDE_SKILL_DIR}/rules/stacked-pr-workflow.md` | HIGH | Stack planning, PR creation, dependency tracking |
| Stacked PRs | `${CLAUDE_SKILL_DIR}/rules/stacked-pr-rebase.md` | HIGH | Rebase management, force-with-lease, retargeting |

**Total: 9 rules across 7 categories**

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:
| File | Content |
|------|---------|
| `references/conventional-commits.md` | Conventional commits specification |
| `references/recovery.md` | Recovery procedures |