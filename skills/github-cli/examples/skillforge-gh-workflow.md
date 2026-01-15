# SkillForge GitHub CLI Workflow

## Overview

SkillForge uses `gh` (GitHub CLI) for all GitHub operations including PR creation, issue management, and project board updates. This ensures consistency, automation, and audit trails.

**Key Principles:**
- NEVER commit directly to `dev` or `main` - always use feature branches
- ALWAYS create PRs for code review and CI checks
- ALWAYS reference issue numbers in commits and PRs
- Use conventional commits for changelog generation

---

## Installation & Setup

### Install GitHub CLI

```bash
# macOS
brew install gh

# Linux
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Verify
gh --version
```

### Authenticate

```bash
# Login to GitHub
gh auth login

# Select:
# - GitHub.com
# - HTTPS
# - Authenticate with browser
# - Default git protocol: HTTPS

# Verify authentication
gh auth status
```

---

## Branch Strategy

### Branch Naming Convention

```bash
# Issue-based branches (preferred)
issue/<number>-<brief-description>

# Feature branches (no issue)
feature/<description>

# Bug fix branches
fix/<description>

# Examples
issue/273-golden-dataset-expansion
feature/socratic-tutor-ui
fix/sse-race-condition
```

### Creating Feature Branches

```bash
# Start from dev branch
git checkout dev
git pull origin dev

# Create issue-based branch
git checkout -b issue/273-golden-dataset-expansion

# Create feature branch
git checkout -b feature/llm-caching-patterns
```

---

## Commit Workflow

### Conventional Commits

SkillForge uses [Conventional Commits](https://www.conventionalcommits.org/) for changelog generation:

```bash
# Format
<type>(#<issue>): <description>

# Types
feat     # New feature
fix      # Bug fix
docs     # Documentation only
refactor # Code refactoring
test     # Adding/updating tests
chore    # Tooling, dependencies
perf     # Performance improvement
```

### Example Commits

```bash
# Feature commits
git commit -m "feat(#273): Add golden dataset backup script"
git commit -m "feat(#280): Implement hybrid search with BM25 + vector"

# Bug fix commits
git commit -m "fix(#438): Resolve SSE schema validation failures"
git commit -m "fix(#299): Fix artifact download 404 error"

# Documentation commits
git commit -m "docs: Add MCP 0.2 migration guide"

# Refactor commits
git commit -m "refactor(#273): Extract dataset validation to separate module"

# Test commits
git commit -m "test(#280): Add retrieval evaluation tests"

# Multi-line commits with body
git commit -m "feat(#273): Add golden dataset backup/restore

- Implement JSON serialization for analyses, artifacts, chunks
- Add verify command for integrity checks
- Document backup/restore workflow in CLAUDE.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Pre-Commit Checks

**ALWAYS run before committing:**

```bash
# Backend
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run ty check app/ --exclude "app/evaluation/*"

# Frontend
cd frontend
npm run lint
npm run typecheck

# If checks pass, commit
git add .
git commit -m "feat(#273): Add golden dataset backup script"
```

---

## Pull Request Workflow

### 1. Push Feature Branch

```bash
# Push feature branch to remote
git push -u origin issue/273-golden-dataset-expansion

# -u flag sets upstream tracking (only needed first time)
```

### 2. Create PR with gh CLI

```bash
# Create PR to dev branch (default)
gh pr create --base dev --title "feat(#273): Add golden dataset backup/restore" --body "$(cat <<'EOF'
## Summary
- Implement JSON backup/restore for golden dataset (98 analyses)
- Add integrity verification with hash checks
- Document workflow in CLAUDE.md and new skill

## Changes
- ✅ `backend/scripts/backup_golden_dataset.py` - Backup/restore script
- ✅ `backend/data/golden_dataset_backup.json` - JSON backup (version-controlled)
- ✅ Tests in `backend/tests/unit/scripts/test_backup_golden_dataset.py`
- ✅ Updated `CLAUDE.md` with backup commands

## Test Plan
- [x] Backup creates valid JSON
- [x] Verify detects data integrity issues
- [x] Restore regenerates embeddings correctly
- [x] Backup survives database wipe + restore

## Related Issues
Closes #273

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Shorter syntax for simple PRs:**

```bash
gh pr create --base dev --title "fix(#438): Fix SSE race condition" --body "
## Summary
Fixes SSE race condition where events published before subscriber connects are lost.

## Changes
- Add event buffering to EventBroadcaster
- Replay last 100 events to new subscribers

## Test Plan
- [x] Unit tests for buffer behavior
- [x] Integration test for SSE reconnection

Closes #438
"
```

### 3. Monitor PR Checks

```bash
# View PR status
gh pr status

# View PR checks (CI, tests, linting)
gh pr checks

# View PR diff
gh pr diff

# View PR in browser
gh pr view --web
```

### 4. Review & Merge

```bash
# Request review from team member
gh pr review <PR_NUMBER> --request-changes --body "Please add tests for edge cases"

# Approve PR
gh pr review <PR_NUMBER> --approve --body "LGTM! Great work on the golden dataset backup."

# Merge PR (after approval and passing checks)
gh pr merge <PR_NUMBER> --squash --delete-branch

# --squash: Squash commits into one
# --delete-branch: Delete feature branch after merge
```

---

## Issue Management

### Creating Issues

```bash
# Create issue with template
gh issue create --title "Add semantic caching for LLM responses" --body "
## Description
Implement semantic caching to reduce LLM costs by 70-95%.

## Acceptance Criteria
- [ ] Implement semantic similarity check (>0.95 threshold)
- [ ] Add Redis backend for cache storage
- [ ] Add cache hit/miss metrics
- [ ] Update observability dashboard

## References
- LangChain semantic cache docs
- Redis vector similarity search
"

# Create issue and assign to yourself
gh issue create --title "Fix SSE race condition" --assignee @me --label bug

# Create issue with milestone
gh issue create --title "Implement Socratic tutor UI" --milestone "v1.0"
```

### Listing Issues

```bash
# List open issues
gh issue list

# List issues assigned to you
gh issue list --assignee @me

# List issues with specific label
gh issue list --label bug

# List issues in milestone
gh issue list --milestone "v1.0"

# Search issues
gh issue list --search "SSE race condition"
```

### Closing Issues

```bash
# Close issue manually
gh issue close 273

# Close issue with comment
gh issue close 273 --comment "Fixed in PR #280"

# Reopen issue
gh issue reopen 273

# Close via PR (automatic when PR merged)
# In PR body: "Closes #273" or "Fixes #273"
```

---

## Project Board Management

SkillForge uses GitHub Projects for sprint tracking.

### View Project Board

```bash
# List projects
gh project list --owner yonatangross

# View project board in browser
gh project view <PROJECT_NUMBER> --web
```

### Add Issue to Project

```bash
# Add issue to project board
gh issue edit 273 --add-project "SkillForge Sprint 1"

# Add PR to project board
gh pr edit 280 --add-project "SkillForge Sprint 1"
```

### Update Issue Status

```bash
# Move issue to "In Progress"
gh issue edit 273 --add-field "Status=In Progress"

# Move issue to "Done"
gh issue edit 273 --add-field "Status=Done"
```

---

## Release Management

### Creating Releases

```bash
# Create release tag
git tag -a v1.0.0 -m "Release v1.0.0 - Golden Dataset & Hybrid Search"
git push origin v1.0.0

# Create GitHub release
gh release create v1.0.0 --title "v1.0.0 - Golden Dataset & Hybrid Search" --notes "
## Features
- Golden dataset backup/restore (#273)
- Hybrid search with BM25 + vector (#280)
- Semantic caching for LLM responses (#285)

## Bug Fixes
- Fix SSE race condition (#438)
- Fix artifact download 404 (#299)

## Performance
- 70% LLM cost reduction via caching
- 5x faster search with indexed tsvector
- 91.6% retrieval precision@5

## Breaking Changes
None

## Contributors
- @yonatangross
- @claude-opus-4-5
"

# Create pre-release
gh release create v1.0.0-rc1 --prerelease --title "v1.0.0 Release Candidate 1"
```

### Listing Releases

```bash
# List all releases
gh release list

# View specific release
gh release view v1.0.0

# Download release assets
gh release download v1.0.0
```

---

## CI/CD Integration

### Viewing Workflow Runs

```bash
# List recent workflow runs
gh run list

# View specific run
gh run view <RUN_ID>

# View run logs
gh run view <RUN_ID> --log

# Watch run in real-time
gh run watch

# View failed runs only
gh run list --status failure
```

### Re-running Failed Workflows

```bash
# Re-run failed jobs
gh run rerun <RUN_ID> --failed

# Re-run entire workflow
gh run rerun <RUN_ID>
```

---

## Common Workflows

### Full Feature Development Workflow

```bash
# 1. Create issue
gh issue create --title "Add LLM semantic caching" --assignee @me --label enhancement

# 2. Create feature branch
git checkout dev
git pull origin dev
git checkout -b issue/285-llm-semantic-caching

# 3. Develop feature
# ... make changes ...

# 4. Run pre-commit checks
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run ty check app/ --exclude "app/evaluation/*"
poetry run pytest tests/unit/ -v

cd ../frontend
npm run lint
npm run typecheck
npm run test

# 5. Commit changes
git add .
git commit -m "feat(#285): Add semantic caching for LLM responses

- Implement similarity check with 0.95 threshold
- Add Redis backend with connection pooling
- Add cache hit/miss metrics to Langfuse
- 70% cost reduction in tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# 6. Push to remote
git push -u origin issue/285-llm-semantic-caching

# 7. Create PR
gh pr create --base dev --title "feat(#285): Add LLM semantic caching" --body "
## Summary
Implements semantic caching to reduce LLM costs by 70-95%.

## Changes
- ✅ Semantic similarity check (0.95 threshold)
- ✅ Redis backend with connection pooling
- ✅ Cache hit/miss metrics in Langfuse
- ✅ Tests with 70% cost reduction

## Test Plan
- [x] Unit tests for similarity calculation
- [x] Integration tests with real Redis
- [x] Performance tests show 70% cost reduction

Closes #285

🤖 Generated with [Claude Code](https://claude.com/claude-code)
"

# 8. Monitor PR checks
gh pr checks

# 9. Merge PR (after approval)
gh pr merge --squash --delete-branch
```

### Hotfix Workflow (Emergency)

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b fix/critical-sse-crash

# 2. Fix issue
# ... make changes ...

# 3. Test thoroughly
cd backend
poetry run pytest tests/unit/ tests/integration/ -v

# 4. Commit and push
git add .
git commit -m "fix: Critical SSE crash on null events

Null checks added to EventBroadcaster.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push -u origin fix/critical-sse-crash

# 5. Create PR to main (not dev)
gh pr create --base main --title "fix: Critical SSE crash on null events" --body "
## Summary
Critical hotfix for SSE crash when null events are published.

## Changes
- Add null checks to EventBroadcaster
- Add defensive validation in all SSE endpoints

## Test Plan
- [x] Unit tests for null event handling
- [x] Integration test with null events
- [x] Manual testing in production

Fixes #450
"

# 6. Merge immediately after approval
gh pr merge --squash --delete-branch

# 7. Cherry-pick to dev
git checkout dev
git pull origin dev
git cherry-pick <COMMIT_SHA>
git push origin dev
```

---

## GitHub Actions Workflows

### Manual Workflow Dispatch

```bash
# Trigger workflow manually (e.g., deploy to staging)
gh workflow run deploy-staging.yml

# Trigger with inputs
gh workflow run deploy-staging.yml --field environment=staging --field version=v1.0.0
```

### Viewing Workflow Files

```bash
# List workflows
gh workflow list

# View workflow YAML
gh workflow view deploy-staging.yml

# View workflow runs
gh workflow view deploy-staging.yml --web
```

---

## Advanced Usage

### PR Templates

```markdown
# .github/pull_request_template.md
## Summary
<!-- Brief description of changes -->

## Changes
<!-- Bulleted list of changes -->
- ✅
- ✅

## Test Plan
<!-- Checklist of testing performed -->
- [ ] Unit tests added/updated
- [ ] Integration tests passing
- [ ] Manual testing completed

## Related Issues
<!-- Reference issues -->
Closes #

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Issue Templates

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yml
name: Bug Report
description: Report a bug in SkillForge
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to report a bug!

  - type: textarea
    id: description
    attributes:
      label: Description
      description: What happened?
      placeholder: "The SSE connection drops after 30 seconds..."
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: How can we reproduce this?
      value: |
        1. Start analysis
        2. Wait 30 seconds
        3. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What should happen?
    validations:
      required: true

  - type: dropdown
    id: severity
    attributes:
      label: Severity
      options:
        - Critical (blocks release)
        - High (major feature broken)
        - Medium (workaround exists)
        - Low (minor annoyance)
    validations:
      required: true
```

### GitHub CLI Aliases

```bash
# Add aliases to ~/.config/gh/config.yml
aliases:
  co: pr checkout
  prc: pr create --base dev
  prv: pr view --web
  iss: issue list --assignee @me
  run: run view --log-failed

# Usage
gh co 280        # Checkout PR #280
gh prc           # Create PR to dev
gh prv           # View current PR in browser
gh iss           # List my assigned issues
gh run           # View failed logs
```

---

## Best Practices

### DO
- ✅ Always create feature branches from `dev`
- ✅ Use conventional commits for all commits
- ✅ Reference issue numbers in commits and PRs
- ✅ Run pre-commit checks before pushing
- ✅ Request reviews before merging
- ✅ Delete feature branches after merging
- ✅ Use `--squash` to keep clean git history

### DON'T
- ❌ Never commit directly to `dev` or `main`
- ❌ Never push without running lint/tests
- ❌ Never merge without approval and passing CI
- ❌ Never skip PR creation for code changes
- ❌ Never use `git push --force` on shared branches
- ❌ Never commit secrets or API keys

---

## Troubleshooting

### PR Merge Conflicts

```bash
# Update feature branch with latest dev
git checkout issue/273-golden-dataset-expansion
git fetch origin dev
git rebase origin/dev

# Resolve conflicts
# ... edit files ...
git add .
git rebase --continue

# Force push (safe on feature branch)
git push --force-with-lease
```

### Failed CI Checks

```bash
# View failed checks
gh pr checks

# View logs in browser
gh pr checks --web

# Re-run failed checks
gh run rerun --failed

# Fix issues locally and push again
# ... make changes ...
git add .
git commit -m "fix: Resolve linting errors"
git push
```

### Stale Branches

```bash
# List merged branches
git branch --merged dev

# Delete local merged branches
git branch --merged dev | grep -v "^\*\|dev\|main" | xargs -n 1 git branch -d

# Delete remote merged branches
gh pr list --state merged --json number,headRefName --jq '.[] | .headRefName' | xargs -I {} git push origin --delete {}
```

---

## References

- **GitHub CLI Docs:** https://cli.github.com/manual/
- **Conventional Commits:** https://www.conventionalcommits.org/
- **SkillForge Branch Strategy:** See `CLAUDE.md`
- **PR Template:** `.github/pull_request_template.md`
- **Issue Templates:** `.github/ISSUE_TEMPLATE/`
