# Automation Patterns

## Custom Aliases

### Creating Aliases

```bash
# Simple alias
gh alias set iv 'issue view --comments'

# With arguments
gh alias set prc 'pr checkout'

# List my PRs
gh alias set myprs 'pr list --author @me --state open'

# Shell alias (complex commands)
gh alias set co --shell 'id="$(gh pr list -L100 | fzf | cut -f1)"; [ -n "$id" ] && gh pr checkout "$id"'
```

### Useful SkillForge Aliases

```bash
# Create feature branch from issue
gh alias set feature --shell '
  ISSUE_NUM="$1"
  ISSUE_TITLE=$(gh issue view "$ISSUE_NUM" --json title --jq ".title" | tr "[:upper:]" "[:lower:]" | tr " " "-" | cut -c1-40)
  BRANCH="issue/${ISSUE_NUM}-${ISSUE_TITLE}"
  git checkout dev && git pull origin dev
  git checkout -b "$BRANCH"
  echo "Created branch: $BRANCH"
'
# Usage: gh feature 123

# Quick PR to dev
gh alias set pr-dev --shell '
  BRANCH=$(git branch --show-current)
  ISSUE=$(echo "$BRANCH" | grep -o "[0-9]*" | head -1)
  gh pr create --base dev --title "feat(#${ISSUE}): $1" --body "Closes #${ISSUE}" --fill
'
# Usage: gh pr-dev "Implement feature X"

# List sprint issues
gh alias set sprint 'issue list --milestone'
# Usage: gh sprint "🔄 Langfuse Migration"

# Untriaged issues
gh alias set untriaged --shell '
  gh issue list --json number,title,labels \
    --jq "[.[] | select(.labels | length == 0)] | .[] | \"#\(.number): \(.title)\""
'
```

### View Aliases

```bash
# List all aliases
gh alias list

# Delete alias
gh alias delete myalias
```

---

## Error Handling

### Basic Pattern

```bash
if gh pr create --title "..." --body "..."; then
  echo "PR created successfully"
else
  echo "Failed to create PR (exit code: $?)"
  exit 1
fi
```

### Capture Output with Status

```bash
OUTPUT=$(gh issue create --title "..." --body "..." 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
  ISSUE_URL=$(echo "$OUTPUT" | grep -o "https://.*")
  echo "Created: $ISSUE_URL"
else
  echo "Error: $OUTPUT"
  exit 1
fi
```

### Retry with Exponential Backoff

```bash
retry_with_backoff() {
  local max_attempts=5
  local timeout=1
  local attempt=1

  while [[ $attempt -le $max_attempts ]]; do
    if "$@"; then
      return 0
    fi

    if [[ $attempt -lt $max_attempts ]]; then
      echo "Attempt $attempt failed. Retrying in ${timeout}s..." >&2
      sleep $timeout
      timeout=$((timeout * 2))
      attempt=$((attempt + 1))
    else
      echo "Max attempts reached. Failing." >&2
      return 1
    fi
  done
}

# Usage
retry_with_backoff gh pr create --title "..." --body "..."
```

---

## Rate Limit Handling

### Check Before Bulk Operations

```bash
check_rate_limit() {
  local MIN_REMAINING=${1:-50}

  REMAINING=$(gh api rate_limit --jq '.resources.core.remaining')

  if [[ $REMAINING -lt $MIN_REMAINING ]]; then
    RESET=$(gh api rate_limit --jq '.resources.core.reset')
    WAIT=$((RESET - $(date +%s) + 60))
    echo "Rate limit low ($REMAINING remaining). Waiting ${WAIT}s..."
    sleep $WAIT
  fi
}

# Usage before bulk operations
check_rate_limit 100
```

### Rate Limit Status

```bash
gh api rate_limit --jq '.resources.core | {
  remaining: .remaining,
  limit: .limit,
  reset: (.reset | strftime("%Y-%m-%d %H:%M:%S"))
}'
```

---

## Bulk Operations

### Close Stale Issues

```bash
STALE_LABEL="stale"
CLOSE_MESSAGE="Closing stale issue. Please reopen if still relevant."

gh issue list --label "$STALE_LABEL" --json number --jq '.[].number' | \
  while read num; do
    echo "Closing #$num..."
    gh issue close "$num" --comment "$CLOSE_MESSAGE"
    sleep 1  # Rate limit protection
  done
```

### Add Label to Multiple Issues

```bash
ISSUES="123 456 789"
LABEL="needs-review"

for issue in $ISSUES; do
  gh issue edit "$issue" --add-label "$LABEL"
  echo "Added $LABEL to #$issue"
done
```

### Bulk Transfer Issues

```bash
TARGET_REPO="org/new-repo"
ISSUES=$(gh issue list --label "migrate" --json number --jq '.[].number')

for issue in $ISSUES; do
  echo "Transferring #$issue..."
  gh issue transfer "$issue" "$TARGET_REPO"
  sleep 2
done
```

---

## Validation Patterns

### Verify Repo Access

```bash
validate_repo() {
  local owner="$1"
  local repo="$2"

  if ! gh api "repos/$owner/$repo" &>/dev/null; then
    echo "ERROR: Repository $owner/$repo not found or not accessible"
    return 1
  fi
  return 0
}

# Usage
validate_repo "ArieGoldkin" "SkillForge" || exit 1
```

### Verify Branch Exists

```bash
validate_branch() {
  local branch="$1"

  if ! git rev-parse --verify "$branch" &>/dev/null; then
    echo "ERROR: Branch $branch does not exist"
    return 1
  fi
  return 0
}
```

### Pre-PR Checks

```bash
pre_pr_check() {
  # Verify on feature branch
  BRANCH=$(git branch --show-current)
  if [[ "$BRANCH" == "dev" || "$BRANCH" == "main" ]]; then
    echo "ERROR: Cannot create PR from $BRANCH. Use a feature branch."
    return 1
  fi

  # Verify clean working tree
  if ! git diff --quiet; then
    echo "ERROR: Uncommitted changes exist"
    return 1
  fi

  # Verify pushed to remote
  if ! git rev-parse --verify "origin/$BRANCH" &>/dev/null; then
    echo "Pushing to origin..."
    git push -u origin "$BRANCH"
  fi

  return 0
}
```

---

## Logging and Debugging

### Enable Debug Mode

```bash
# Show API calls
GH_DEBUG=api gh pr create --title "..." --body "..."

# Full debug
GH_DEBUG=1 gh pr create --title "..." --body "..."
```

### Log All Commands

```bash
gh_logged() {
  echo "[$(date +%Y-%m-%d\ %H:%M:%S)] gh $*" >> /tmp/gh_commands.log
  gh "$@" 2>&1 | tee -a /tmp/gh_output.log
}

# Usage
gh_logged pr create --title "..." --body "..."
```

---

## Complete Workflow Script

```bash
#!/bin/bash
# skillforge-feature.sh - Complete feature workflow

set -e

TITLE="$1"
BODY="$2"
LABELS="${3:-enhancement,backend}"

if [[ -z "$TITLE" ]]; then
  echo "Usage: $0 <title> [body] [labels]"
  exit 1
fi

# Configuration
REPO="ArieGoldkin/SkillForge"
PROJECT_NUMBER=1
PROJECT_OWNER="yonatangross"

echo "=== Creating Issue ==="
ISSUE_URL=$(gh issue create \
  --repo "$REPO" \
  --title "$TITLE" \
  --body "${BODY:-No description provided.}" \
  --label "$LABELS" \
  --json url --jq '.url')

ISSUE_NUM=$(echo "$ISSUE_URL" | grep -o '[0-9]*$')
echo "Created issue #$ISSUE_NUM: $ISSUE_URL"

echo "=== Creating Feature Branch ==="
git checkout dev && git pull origin dev
BRANCH="issue/${ISSUE_NUM}-$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | cut -c1-40)"
git checkout -b "$BRANCH"
echo "Created branch: $BRANCH"

echo "=== Adding to Project ==="
ITEM_ID=$(gh project item-add $PROJECT_NUMBER \
  --owner $PROJECT_OWNER \
  --url "$ISSUE_URL" \
  --format json 2>/dev/null | jq -r '.id' || echo "")

if [[ -n "$ITEM_ID" ]]; then
  echo "Added to project: $ITEM_ID"
else
  echo "Note: Could not add to project (check permissions)"
fi

echo ""
echo "=== Ready to Work ==="
echo "Branch: $BRANCH"
echo "Issue:  $ISSUE_URL"
echo ""
echo "When done:"
echo "  git add . && git commit -m \"feat(#${ISSUE_NUM}): ...\""
echo "  git push -u origin $BRANCH"
echo "  gh pr create --base dev --fill"
```

---

## Environment Variables

```bash
# Authentication
export GH_TOKEN="ghp_xxxx"

# Default repo
export GH_REPO="ArieGoldkin/SkillForge"

# Preferred editor
export GH_EDITOR="code --wait"

# Pager settings
export GH_PAGER="less -R"

# Disable prompts (for CI)
export GH_PROMPT_DISABLED=1
```
