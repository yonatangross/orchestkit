# Issue Management

## Creating Issues

### Basic Creation

```bash
# Non-interactive (ideal for automation)
gh issue create \
  --title "Bug: API returns 500 on invalid input" \
  --body "Description of the issue..." \
  --label "bug,backend" \
  --assignee "@me" \
  --milestone "Sprint 5"
```

### With Multi-line Body (Heredoc)

```bash
gh issue create \
  --title "feat: Implement hybrid search" \
  --body "$(cat <<'EOF'
## Description
Implement hybrid search combining BM25 and vector similarity.

## Acceptance Criteria
- [ ] HNSW index on chunks table
- [ ] RRF fusion algorithm
- [ ] 95%+ test pass rate

## Technical Notes
See PGVector skill for implementation details.
EOF
)"
```

### Using Templates

```bash
# Use repo template from .github/ISSUE_TEMPLATE/
gh issue create --template "bug_report.md"

# Use local file as body
gh issue create --title "..." --body-file ./issue-body.md
```

---

## Editing Issues

```bash
# Add labels
gh issue edit 123 --add-label "high,backend"

# Remove labels
gh issue edit 123 --remove-label "low"

# Set milestone
gh issue edit 123 --milestone "Sprint 8"

# Assign users
gh issue edit 123 --add-assignee "username1,username2"

# Update title/body
gh issue edit 123 --title "New title" --body "Updated body"
```

---

## Listing and Filtering

```bash
# Open issues assigned to me
gh issue list --state open --assignee @me

# By label (multiple)
gh issue list --label "bug" --label "backend"

# By milestone
gh issue list --milestone "Sprint 5"

# Search with GitHub search syntax
gh issue list --search "status:success author:@me"

# Limit results
gh issue list --limit 20
```

### JSON Output for Scripting

```bash
# Get issue data as JSON
gh issue list --json number,title,labels,milestone,state

# Filter with jq
gh issue list --json number,labels \
  --jq '[.[] | select(.labels[].name == "critical")] | .[].number'

# Get specific fields
gh issue view 123 --json title,body,labels,assignees
```

---

## Bulk Operations

### Add Label to Multiple Issues

```bash
# Inline list
gh issue edit 23 34 45 --add-label "needs-review"

# From query result
gh issue list --label "stale" --json number --jq '.[].number' | \
  xargs -I {} gh issue edit {} --add-label "deprecated"
```

### Close Multiple Issues

```bash
# Close with comment
gh issue list --label "duplicate" --json number --jq '.[].number' | \
  while read num; do
    gh issue close "$num" --comment "Closing as duplicate"
  done
```

### Bulk Assign to Milestone

```bash
MILESTONE="Sprint 8"
ISSUES=$(gh issue list --label "sprint-8" --json number --jq '.[].number')

for issue in $ISSUES; do
  gh issue edit "$issue" --milestone "$MILESTONE"
  echo "Assigned #$issue to $MILESTONE"
done
```

---

## Issue Comments

```bash
# Add comment
gh issue comment 123 --body "Working on this now"

# View comments
gh issue view 123 --comments

# Edit last comment (via web)
gh issue view 123 --web
```

---

## Issue Development Flow

```bash
# Create branch linked to issue
gh issue develop 123 --checkout

# This creates: username/issue-123-title-slug
# And checks it out locally
```

---

## Sub-Issues

Native sub-issues are available but CLI support is limited:

```bash
# Install extension for sub-issue support
gh extension install yahsan2/gh-sub-issue

# Create sub-issue
gh sub-issue create 123 --title "Implement API endpoint"

# List sub-issues
gh sub-issue list 123
```

**Alternative: Use GraphQL**

```bash
gh api graphql -f query='
  mutation {
    addSubIssue(input: {
      parentId: "I_kwDOABCD1234"
      subIssueId: "I_kwDOABCD5678"
    }) {
      parentIssue { title }
      subIssue { title }
    }
  }
'
```

---

## Transfer and Pin Issues

```bash
# Move issue to another repo
gh issue transfer 123 owner/new-repo

# Pin to repo (max 3)
gh issue pin 123

# Unpin
gh issue unpin 123
```

---

## Common Patterns

### Create Issue and Get Number

```bash
ISSUE_URL=$(gh issue create --title "..." --body "..." --json url --jq '.url')
ISSUE_NUM=$(echo "$ISSUE_URL" | grep -o '[0-9]*$')
echo "Created issue #$ISSUE_NUM"
```

### Find Untriaged Issues

```bash
# Issues with no labels
gh issue list --json number,title,labels \
  --jq '[.[] | select(.labels | length == 0)]'
```

### Issue Statistics

```bash
# Count by label
gh issue list --state all --json labels \
  --jq '[.[].labels[].name] | group_by(.) | map({label: .[0], count: length}) | sort_by(-.count)'
```
