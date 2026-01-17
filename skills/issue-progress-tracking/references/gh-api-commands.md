# GitHub CLI Commands for Issue Progress

## Commands Used by Hooks

### View Issue
```bash
# Get issue details
gh issue view 123 --json number,body,title

# Get just the body (for checkbox parsing)
gh issue view 123 --json body -q '.body'
```

### Post Comment
```bash
# Post progress comment
gh issue comment 123 --body "Progress update..."

# Multi-line with heredoc
gh issue comment 123 --body "$(cat <<'EOF'
## Progress Update

- Commit 1
- Commit 2
EOF
)"
```

### Update Issue Body
```bash
# Get repo info
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')

# Update issue body via API
gh api -X PATCH "repos/$REPO/issues/123" -f body="Updated body text"
```

### Check PR Exists
```bash
# Get PR URL for branch
gh pr view branch-name --json url -q '.url'
```

## Manual Progress Update

If automatic updates fail, you can manually post progress:

```bash
# Quick progress comment
gh issue comment 123 --body "Progress: Completed validation logic, tests passing"

# Check off a task manually
BODY=$(gh issue view 123 --json body -q '.body')
UPDATED=$(echo "$BODY" | sed 's/- \[ \] Add tests/- [x] Add tests/')
gh api -X PATCH repos/owner/repo/issues/123 -f body="$UPDATED"
```

## Authentication

The hooks require `gh` CLI to be authenticated:

```bash
# Check auth status
gh auth status

# Login if needed
gh auth login
```

## Rate Limits

GitHub API has rate limits. The hooks are designed to be lightweight:
- One API call per commit (verify issue exists)
- One API call for checkbox updates
- One API call per issue at session end

For bulk operations, check limits:
```bash
gh api rate_limit --jq '.resources.core'
```
