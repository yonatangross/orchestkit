# Pull Request Workflows

## Creating PRs

### Basic Creation

```bash
# Interactive (opens editor)
gh pr create

# Non-interactive with auto-fill from commits
gh pr create --fill

# Explicit title and body
gh pr create \
  --title "feat(#123): Add hybrid search with PGVector" \
  --body "Description..." \
  --base dev \
  --head feature/pgvector-search
```

### Full PR Creation Pattern

```bash
gh pr create \
  --title "feat(#${ISSUE_NUM}): Implement Langfuse tracing" \
  --body "$(cat <<'EOF'
## Summary
- Added @observe decorator to workflow functions
- Implemented CallbackHandler for LangChain
- Added session and user tracking

## Changes
- `backend/app/shared/services/langfuse/` - New Langfuse client
- `backend/app/workflows/nodes/` - Added tracing decorators
- `backend/tests/unit/services/` - Langfuse unit tests

## Test Plan
- [ ] Unit tests pass (`poetry run pytest tests/unit/`)
- [ ] Integration test with real Langfuse instance
- [ ] Verify traces appear in Langfuse UI

Closes #372

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)" \
  --base dev \
  --label "enhancement,backend" \
  --assignee "@me" \
  --reviewer "teammate"
```

### Using Body File

```bash
gh pr create --title "..." --body-file pr-description.md
```

---

## PR Checks and Status

### View Check Status

```bash
# List all checks
gh pr checks 456

# Watch checks in real-time
gh pr checks 456 --watch

# Wait for specific check
gh pr checks 456 --watch --fail-fast
```

### JSON Output for Automation

```bash
# Get check status
gh pr checks 456 --json name,state,conclusion

# Check if all passed
gh pr checks 456 --json conclusion \
  --jq 'all(.[].conclusion == "SUCCESS")'
```

### Wait for Checks Pattern

```bash
PR_NUMBER=456

while true; do
  STATUS=$(gh pr view $PR_NUMBER --json statusCheckRollupState --jq '.statusCheckRollupState')

  case "$STATUS" in
    "SUCCESS")
      echo "All checks passed!"
      break
      ;;
    "FAILURE")
      echo "Checks failed!"
      gh pr checks $PR_NUMBER
      exit 1
      ;;
    *)
      echo "Waiting... (status: $STATUS)"
      sleep 30
      ;;
  esac
done
```

---

## PR Reviews

### Requesting Reviews

```bash
# Request review
gh pr edit 456 --add-reviewer "username1,username2"

# Remove reviewer
gh pr edit 456 --remove-reviewer "username"
```

### Submitting Reviews

```bash
# Approve
gh pr review 456 --approve

# Approve with comment
gh pr review 456 --approve --body "LGTM! Clean implementation."

# Request changes
gh pr review 456 --request-changes --body "Need tests for edge cases"

# Comment without approval/rejection
gh pr review 456 --comment --body "Nice refactoring!"
```

### View Review Status

```bash
# Get review decision
gh pr view 456 --json reviewDecision

# List reviews
gh pr view 456 --json reviews \
  --jq '.reviews[] | "\(.author.login): \(.state)"'
```

---

## Merging PRs

### Merge Strategies

```bash
# Merge commit (default)
gh pr merge 456 --merge

# Squash merge (recommended for clean history)
gh pr merge 456 --squash

# Rebase merge
gh pr merge 456 --rebase

# With branch deletion
gh pr merge 456 --squash --delete-branch
```

### Auto-Merge

```bash
# Enable auto-merge (merges when checks pass + approved)
gh pr merge 456 --auto --squash --delete-branch

# Disable auto-merge
gh pr merge 456 --disable-auto
```

### Admin Merge (Bypass Protections)

```bash
# Bypass branch protection rules (requires admin)
gh pr merge 456 --admin --squash
```

---

## Safe Merge Pattern

```bash
#!/bin/bash
PR_NUMBER=$1

# 1. Verify checks passed
if ! gh pr view $PR_NUMBER --json statusCheckRollupState \
  --jq '.statusCheckRollupState == "SUCCESS"' | grep -q true; then
  echo "ERROR: Checks not passed"
  gh pr checks $PR_NUMBER
  exit 1
fi

# 2. Verify approved
APPROVED=$(gh pr view $PR_NUMBER --json reviewDecision --jq '.reviewDecision')
if [[ "$APPROVED" != "APPROVED" ]]; then
  echo "ERROR: PR not approved (status: $APPROVED)"
  exit 1
fi

# 3. Verify mergeable
MERGEABLE=$(gh pr view $PR_NUMBER --json mergeable --jq '.mergeable')
if [[ "$MERGEABLE" != "MERGEABLE" ]]; then
  echo "ERROR: PR has conflicts"
  exit 1
fi

# 4. Merge
gh pr merge $PR_NUMBER --squash --delete-branch
echo "Successfully merged PR #$PR_NUMBER"
```

---

## PR Comments

```bash
# Add comment
gh pr comment 456 --body "Addressed review feedback in latest commit"

# View comments
gh pr view 456 --comments
```

---

## Checkout and Edit

```bash
# Checkout PR locally
gh pr checkout 456

# Edit PR metadata
gh pr edit 456 --title "New title" --add-label "urgent"

# Close without merging
gh pr close 456 --comment "Superseded by #789"

# Reopen
gh pr reopen 456
```

---

## PR Listing and Search

```bash
# My open PRs
gh pr list --author @me --state open

# PRs needing my review
gh pr list --search "review-requested:@me"

# Ready to merge
gh pr list --json number,title,reviewDecision,statusCheckRollupState \
  --jq '[.[] | select(.reviewDecision == "APPROVED" and .statusCheckRollupState == "SUCCESS")]'

# Draft PRs
gh pr list --draft
```

---

## Convert Draft to Ready

```bash
# Mark ready for review
gh pr ready 456

# Convert to draft
gh pr ready 456 --undo
```

---

## PR Diff and Files

```bash
# View diff
gh pr diff 456

# List changed files
gh pr view 456 --json files --jq '.files[].path'

# View specific file
gh pr diff 456 -- path/to/file.py
```

---

## Common Patterns

### Create PR from Current Branch

```bash
# Push and create PR in one flow
git push -u origin $(git branch --show-current) && \
gh pr create --fill --base dev
```

### Find Stale PRs

```bash
# PRs not updated in 7 days
gh pr list --json number,title,updatedAt \
  --jq '[.[] | select(.updatedAt < (now - 604800 | todate))]'
```

### PR Statistics

```bash
# Average time to merge
gh pr list --state merged --limit 20 --json createdAt,mergedAt \
  --jq '[.[] | (.mergedAt | fromdateiso8601) - (.createdAt | fromdateiso8601)] | add / length / 3600 | "Average: \(.) hours"'
```
