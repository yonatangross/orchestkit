# GitHub CLI Checklist

Quick reference checklist for common GitHub CLI operations in SkillForge development.

---

## Pre-Commit Checklist

**ALWAYS complete before committing:**

```bash
# 1. Verify you're NOT on dev or main
[ ] git branch --show-current
    → If dev/main, STOP and create feature branch!

# 2. Run Backend Checks (if Python changes)
[ ] cd backend
[ ] poetry run ruff format --check app/    # Format check
[ ] poetry run ruff check app/             # Lint check
[ ] poetry run ty check app/ --exclude "app/evaluation/*"  # Type check
[ ] poetry run pytest tests/unit/ -v      # Unit tests

# 3. Run Frontend Checks (if TypeScript/React changes)
[ ] cd frontend
[ ] npm run lint                          # ESLint + Biome
[ ] npm run typecheck                     # TypeScript check
[ ] npm run test                          # Unit tests

# 4. Stage and Commit
[ ] git add .
[ ] git commit -m "feat(#<issue>): <description>"
    → Use conventional commit format!

# 5. Push to Remote
[ ] git push -u origin <branch-name>
```

---

## PR Creation Checklist

**ALWAYS complete when creating a PR:**

```bash
# 1. Verify Feature Branch Pushed
[ ] git push -u origin <branch-name>

# 2. Create PR to dev (NOT main)
[ ] gh pr create --base dev --title "feat(#<issue>): <title>" --body "..."
    → Use template below

# 3. Verify PR Details
[ ] Title uses conventional commit format (feat/fix/docs/refactor)
[ ] Body includes Summary, Changes, Test Plan
[ ] Issue referenced with "Closes #<issue>"
[ ] Claude Code attribution included

# 4. Monitor CI Checks
[ ] gh pr checks
    → Wait for all checks to pass (lint, tests, build)

# 5. Request Review (if not auto-assigned)
[ ] gh pr review --request @teammate
```

**PR Body Template:**

```markdown
## Summary
<!-- 1-3 sentences describing what this PR does -->

## Changes
<!-- Bulleted list of changes -->
- ✅ File/module changed
- ✅ New feature added
- ✅ Tests updated

## Test Plan
<!-- Checklist of testing performed -->
- [x] Unit tests added/updated
- [x] Integration tests passing
- [x] Manual testing completed

## Related Issues
Closes #<issue>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Feature Branch Workflow Checklist

**Complete step-by-step for new features:**

```bash
# 1. Create Issue (if not exists)
[ ] gh issue create --title "Add <feature>" --assignee @me --label enhancement

# 2. Start from Clean dev Branch
[ ] git checkout dev
[ ] git pull origin dev
    → Ensure dev is up-to-date

# 3. Create Feature Branch
[ ] git checkout -b issue/<number>-<brief-description>
    → Example: issue/273-golden-dataset-backup

# 4. Develop Feature
[ ] ... make changes ...

# 5. Run Pre-Commit Checks (see checklist above)
[ ] Backend checks (if applicable)
[ ] Frontend checks (if applicable)

# 6. Commit with Conventional Format
[ ] git add .
[ ] git commit -m "feat(#<issue>): <description>

- Bullet points for details
- Multi-line if needed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# 7. Push Feature Branch
[ ] git push -u origin issue/<number>-<brief-description>

# 8. Create PR (see PR checklist above)
[ ] gh pr create --base dev ...

# 9. Monitor & Merge
[ ] gh pr checks  (wait for green)
[ ] gh pr merge --squash --delete-branch
```

---

## Hotfix Workflow Checklist

**ONLY use for production emergencies:**

```bash
# 1. Verify Emergency Severity
[ ] Is this blocking production? (If no, use normal feature workflow)

# 2. Create Hotfix Branch from main
[ ] git checkout main
[ ] git pull origin main
[ ] git checkout -b fix/critical-<issue>
    → Example: fix/critical-sse-crash

# 3. Fix Issue
[ ] ... make minimal changes to fix issue ...

# 4. Test Thoroughly
[ ] poetry run pytest tests/unit/ tests/integration/ -v
[ ] Manual testing in production-like environment

# 5. Commit and Push
[ ] git add .
[ ] git commit -m "fix: <critical issue description>"
[ ] git push -u origin fix/critical-<issue>

# 6. Create PR to main (NOT dev)
[ ] gh pr create --base main --title "fix: <issue>" --body "..."
    → Mark as URGENT in title

# 7. Get Immediate Approval
[ ] Request review from senior team member
[ ] Wait for approval (expedited)

# 8. Merge to main
[ ] gh pr merge --squash --delete-branch

# 9. Cherry-Pick to dev
[ ] git checkout dev
[ ] git pull origin dev
[ ] git cherry-pick <commit-sha>
[ ] git push origin dev

# 10. Deploy to Production
[ ] gh workflow run deploy-production.yml
```

---

## Release Checklist

**Complete when preparing a release:**

```bash
# 1. Verify All PRs Merged
[ ] gh pr list --base dev
    → All feature PRs for this release merged

# 2. Merge dev to main
[ ] git checkout main
[ ] git pull origin main
[ ] git merge dev
[ ] git push origin main

# 3. Create Release Tag
[ ] git tag -a v<X.Y.Z> -m "Release v<X.Y.Z> - <title>"
[ ] git push origin v<X.Y.Z>

# 4. Generate Changelog
[ ] Review commits since last release:
    gh pr list --state merged --base dev --search "merged:>2025-12-01"
[ ] Group by type: Features, Bug Fixes, Performance, Breaking Changes

# 5. Create GitHub Release
[ ] gh release create v<X.Y.Z> --title "v<X.Y.Z> - <title>" --notes "
## Features
- feat(#<issue>): <description>

## Bug Fixes
- fix(#<issue>): <description>

## Performance
- <improvement>

## Breaking Changes
None (or list changes)

## Contributors
- @username
"

# 6. Verify Release
[ ] gh release view v<X.Y.Z>
[ ] Check release assets uploaded correctly

# 7. Announce Release
[ ] Update project board
[ ] Notify team in Slack/Discord
```

---

## CI/CD Monitoring Checklist

**Monitor CI checks during development:**

```bash
# 1. View All Recent Runs
[ ] gh run list

# 2. Check Current PR Status
[ ] gh pr status
    → Shows checks status for your PRs

# 3. View Failed Runs
[ ] gh run list --status failure

# 4. View Specific Run Logs
[ ] gh run view <run-id> --log-failed
    → Shows only failed job logs

# 5. Re-run Failed Jobs
[ ] gh run rerun <run-id> --failed

# 6. Watch Run in Real-Time
[ ] gh run watch
    → Live updates as workflow runs
```

---

## Code Review Checklist

**For reviewers:**

```bash
# 1. Checkout PR Branch
[ ] gh pr checkout <pr-number>

# 2. Review Changes
[ ] gh pr diff <pr-number>
    → Review all file changes

# 3. Run Tests Locally
[ ] cd backend && poetry run pytest tests/unit/ -v
[ ] cd frontend && npm run test

# 4. Verify Pre-Commit Checks
[ ] poetry run ruff format --check app/
[ ] poetry run ruff check app/
[ ] npm run lint && npm run typecheck

# 5. Approve or Request Changes
[ ] gh pr review <pr-number> --approve --body "LGTM! <comments>"
    OR
[ ] gh pr review <pr-number> --request-changes --body "<feedback>"

# 6. Merge (if approved)
[ ] gh pr merge <pr-number> --squash --delete-branch
```

---

## Troubleshooting Checklist

### Merge Conflicts

```bash
# 1. Update Feature Branch
[ ] git checkout <feature-branch>
[ ] git fetch origin dev
[ ] git rebase origin/dev

# 2. Resolve Conflicts
[ ] ... edit conflicted files ...
[ ] git add .
[ ] git rebase --continue

# 3. Force Push (safe on feature branch)
[ ] git push --force-with-lease
```

### Failed CI Checks

```bash
# 1. View Failed Checks
[ ] gh pr checks

# 2. View Logs
[ ] gh pr checks --web
    → View detailed logs in browser

# 3. Fix Issues Locally
[ ] ... fix lint/test errors ...
[ ] git add .
[ ] git commit -m "fix: Resolve CI failures"
[ ] git push

# 4. Re-run Checks
[ ] gh run rerun --failed
```

### Accidental Commit to dev/main

```bash
# 1. Create Feature Branch at Current Commit
[ ] git checkout -b issue/<number>-<description>

# 2. Reset dev/main to Remote State
[ ] git checkout dev  # or main
[ ] git reset --hard origin/dev  # or origin/main

# 3. Push Feature Branch
[ ] git checkout issue/<number>-<description>
[ ] git push -u origin issue/<number>-<description>

# 4. Create PR Normally
[ ] gh pr create --base dev ...
```

---

## Branch Cleanup Checklist

**Clean up stale branches regularly:**

```bash
# 1. List Merged Branches
[ ] git branch --merged dev

# 2. Delete Local Merged Branches
[ ] git branch --merged dev | grep -v "^\*\|dev\|main" | xargs -n 1 git branch -d

# 3. Prune Remote Tracking Branches
[ ] git fetch --prune

# 4. Delete Remote Merged Branches (via PR merge --delete-branch)
[ ] gh pr list --state merged --json number,headRefName
[ ] ... delete via gh pr merge --delete-branch ...
```

---

## Issue Management Checklist

### Creating Issues

```bash
# 1. Search for Duplicates
[ ] gh issue list --search "<keywords>"

# 2. Create Issue
[ ] gh issue create --title "<title>" --assignee @me --label <label>

# 3. Add to Project Board
[ ] gh issue edit <issue-number> --add-project "SkillForge Sprint"

# 4. Link Related Issues
[ ] Add "Related to #<issue>" in issue body
```

### Closing Issues

```bash
# 1. Verify Issue Fixed
[ ] Test feature/fix locally

# 2. Reference in PR
[ ] PR body includes "Closes #<issue>"
    → Auto-closes when PR merged

# 3. Manual Close (if needed)
[ ] gh issue close <issue-number> --comment "Fixed in PR #<pr-number>"
```

---

## Quick Reference Commands

### Most Used Commands

```bash
# Branch management
git checkout -b issue/<number>-<description>  # Create feature branch
git push -u origin <branch>                   # Push and set upstream

# PR operations
gh pr create --base dev --title "..." --body "..."  # Create PR
gh pr checks                                   # View PR checks
gh pr merge --squash --delete-branch          # Merge and cleanup

# Issue operations
gh issue create --title "..." --assignee @me  # Create issue
gh issue list --assignee @me                  # List my issues
gh issue close <number>                       # Close issue

# CI/CD monitoring
gh run list                                    # List workflow runs
gh run view <run-id> --log-failed             # View failed logs
gh run rerun --failed                         # Re-run failed jobs

# Repository info
gh repo view --web                            # Open repo in browser
gh pr status                                  # My PR status
gh issue status                               # My issue status
```

---

## Environment-Specific Notes

### Local Development

- Always use `dev` as base branch
- Run pre-commit checks locally (lint, tests)
- Feature branches auto-deleted after merge

### CI/CD Environment

- GitHub Actions runs on all PRs
- Checks: lint, tests, build, type checking
- Must pass before merge allowed

### Production

- Only merge to `main` via dev → main merge
- Hotfixes go directly to `main` then cherry-pick to `dev`
- Release tags created from `main`

---

## References

- **GitHub CLI Manual:** https://cli.github.com/manual/
- **SkillForge Git Workflow:** See `CLAUDE.md`
- **Conventional Commits:** https://www.conventionalcommits.org/
- **Example Workflow:** `skills/devops/.claude/skills/github-cli/examples/skillforge-gh-workflow.md`
