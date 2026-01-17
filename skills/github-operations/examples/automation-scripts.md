# GitHub Automation Scripts

Ready-to-use scripts for common GitHub automation tasks.

## Bulk Issue Operations

### Add Label to Multiple Issues

```bash
#!/usr/bin/env bash
# Add label to all issues matching criteria

LABEL="needs-review"
QUERY="is:open label:bug"

gh issue list --search "$QUERY" --json number --jq '.[].number' | \
while read -r issue; do
  echo "Adding '$LABEL' to #$issue"
  gh issue edit "$issue" --add-label "$LABEL"
done
```

### Assign Issues to Team Member

```bash
#!/usr/bin/env bash
# Assign unassigned issues in a milestone

MILESTONE="Sprint 8"
ASSIGNEE="@me"

gh issue list --milestone "$MILESTONE" --assignee "" --json number --jq '.[].number' | \
while read -r issue; do
  echo "Assigning #$issue to $ASSIGNEE"
  gh issue edit "$issue" --add-assignee "$ASSIGNEE"
done
```

### Close Stale Issues

```bash
#!/usr/bin/env bash
# Close issues with no activity > 90 days

DAYS=90
CUTOFF=$(date -v-${DAYS}d +%Y-%m-%d 2>/dev/null || date -d "$DAYS days ago" +%Y-%m-%d)

gh issue list --state open --json number,updatedAt --jq \
  ".[] | select(.updatedAt < \"$CUTOFF\") | .number" | \
while read -r issue; do
  echo "Closing stale issue #$issue"
  gh issue close "$issue" --comment "Closing due to inactivity. Reopen if still relevant."
done
```

---

## PR Automation

### Auto-Merge Approved PRs

```bash
#!/usr/bin/env bash
# Enable auto-merge for approved PRs with passing checks

gh pr list --json number,reviewDecision,statusCheckRollupState --jq \
  '.[] | select(.reviewDecision == "APPROVED" and .statusCheckRollupState == "SUCCESS") | .number' | \
while read -r pr; do
  echo "Enabling auto-merge for PR #$pr"
  gh pr merge "$pr" --auto --squash --delete-branch
done
```

### Request Reviews from CODEOWNERS

```bash
#!/usr/bin/env bash
# Add reviewers based on changed files

PR_NUMBER=$1

# Get changed files
CHANGED=$(gh pr diff "$PR_NUMBER" --name-only)

# Map to reviewers (customize per team)
REVIEWERS=""
if echo "$CHANGED" | grep -q "^src/api/"; then
  REVIEWERS="$REVIEWERS backend-team"
fi
if echo "$CHANGED" | grep -q "^src/components/"; then
  REVIEWERS="$REVIEWERS frontend-team"
fi

if [[ -n "$REVIEWERS" ]]; then
  gh pr edit "$PR_NUMBER" --add-reviewer $REVIEWERS
fi
```

### PR Status Dashboard

```bash
#!/usr/bin/env bash
# Generate PR status summary

echo "=== PR Status Dashboard ==="
echo ""

echo "## Ready to Merge"
gh pr list --json number,title,author --jq \
  '.[] | "- #\(.number) \(.title) (@\(.author.login))"' \
  --search "review:approved status:success"

echo ""
echo "## Needs Review"
gh pr list --json number,title,author --jq \
  '.[] | "- #\(.number) \(.title) (@\(.author.login))"' \
  --search "review:none"

echo ""
echo "## Changes Requested"
gh pr list --json number,title,author --jq \
  '.[] | "- #\(.number) \(.title) (@\(.author.login))"' \
  --search "review:changes-requested"
```

---

## Milestone Management

### Milestone Progress Report

```bash
#!/usr/bin/env bash
# Generate milestone progress report

echo "=== Milestone Progress ==="
echo ""

gh api repos/:owner/:repo/milestones --jq '.[] |
  "## \(.title)
Due: \(.due_on // "No due date")
Progress: \(.closed_issues)/\(.open_issues + .closed_issues) issues (\((.closed_issues * 100 / ((.open_issues + .closed_issues) | if . == 0 then 1 else . end)) | floor)%)
"'
```

### Move Issues to Next Sprint

```bash
#!/usr/bin/env bash
# Move open issues from current to next milestone

CURRENT="Sprint 7"
NEXT="Sprint 8"

gh issue list --milestone "$CURRENT" --state open --json number --jq '.[].number' | \
while read -r issue; do
  echo "Moving #$issue to $NEXT"
  gh issue edit "$issue" --milestone "$NEXT"
done
```

### Create Sprint Milestone

```bash
#!/usr/bin/env bash
# Create milestone with due date

SPRINT_NUM=$1
WEEKS=${2:-2}
DUE_DATE=$(date -v+${WEEKS}w +%Y-%m-%dT00:00:00Z 2>/dev/null || \
           date -d "+$WEEKS weeks" +%Y-%m-%dT00:00:00Z)

gh api -X POST repos/:owner/:repo/milestones \
  -f title="Sprint $SPRINT_NUM" \
  -f description="Sprint $SPRINT_NUM goals and deliverables" \
  -f due_on="$DUE_DATE"

echo "Created Sprint $SPRINT_NUM (due $DUE_DATE)"
```

---

## Cross-Repo Operations

### Sync Labels Across Repos

```bash
#!/usr/bin/env bash
# Copy labels from source repo to target repos

SOURCE_REPO="org/main-repo"
TARGET_REPOS=("org/api" "org/frontend" "org/docs")

# Get labels from source
LABELS=$(gh label list --repo "$SOURCE_REPO" --json name,color,description)

for repo in "${TARGET_REPOS[@]}"; do
  echo "Syncing labels to $repo"
  echo "$LABELS" | jq -c '.[]' | while read -r label; do
    NAME=$(echo "$label" | jq -r '.name')
    COLOR=$(echo "$label" | jq -r '.color')
    DESC=$(echo "$label" | jq -r '.description // ""')

    gh label create "$NAME" --repo "$repo" --color "$COLOR" --description "$DESC" 2>/dev/null || \
    gh label edit "$NAME" --repo "$repo" --color "$COLOR" --description "$DESC"
  done
done
```

### Find Issues Across Repos

```bash
#!/usr/bin/env bash
# Search issues across organization

ORG="my-org"
QUERY="is:open label:critical"

gh search issues --owner "$ORG" "$QUERY" --json repository,number,title --jq \
  '.[] | "\(.repository.nameWithOwner)#\(.number): \(.title)"'
```

---

## Rate Limit Handling

```bash
#!/usr/bin/env bash
# Check rate limits before bulk operations

check_rate_limit() {
  REMAINING=$(gh api rate_limit --jq '.rate.remaining')
  if [[ "$REMAINING" -lt 100 ]]; then
    RESET=$(gh api rate_limit --jq '.rate.reset')
    WAIT=$((RESET - $(date +%s)))
    echo "Rate limit low ($REMAINING). Waiting ${WAIT}s..."
    sleep "$WAIT"
  fi
}

# Use in loops
for issue in $(gh issue list --json number --jq '.[].number'); do
  check_rate_limit
  gh issue edit "$issue" --add-label "processed"
done
```

## Related

- [Issue Management](../references/issue-management.md)
- [Milestone API](../references/milestone-api.md)
- [GraphQL API](../references/graphql-api.md)
