# Milestone API Reference

GitHub CLI has NO native milestone commands. Use `gh api` REST calls for all milestone operations.

## API Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List | GET | `/repos/:owner/:repo/milestones` |
| Get | GET | `/repos/:owner/:repo/milestones/:number` |
| Create | POST | `/repos/:owner/:repo/milestones` |
| Update | PATCH | `/repos/:owner/:repo/milestones/:number` |
| Delete | DELETE | `/repos/:owner/:repo/milestones/:number` |

---

## Create Milestone

```bash
# Minimal
gh api -X POST repos/:owner/:repo/milestones \
  -f title="Sprint 10"

# Full options
gh api -X POST repos/:owner/:repo/milestones \
  -f title="Sprint 10: Performance" \
  -f state="open" \
  -f description="Focus on frontend performance optimization" \
  -f due_on="2026-03-15T00:00:00Z"

# Create and capture number
MILESTONE_NUM=$(gh api -X POST repos/:owner/:repo/milestones \
  -f title="Sprint 8" \
  --jq '.number')
echo "Created milestone #$MILESTONE_NUM"
```

---

## List Milestones

```bash
# All open (default)
gh api repos/:owner/:repo/milestones

# All milestones (including closed)
gh api "repos/:owner/:repo/milestones?state=all"

# Closed only
gh api "repos/:owner/:repo/milestones?state=closed"

# Sorted by due date
gh api "repos/:owner/:repo/milestones?sort=due_on&direction=asc"

# With jq formatting
gh api repos/:owner/:repo/milestones --jq '
  .[] | {
    number,
    title,
    state,
    due: .due_on,
    progress: "\(.closed_issues)/\(.open_issues + .closed_issues)"
  }'

# Progress summary
gh api repos/:owner/:repo/milestones --jq '.[] | "\(.title): \(.closed_issues)/\(.open_issues + .closed_issues) done"'
```

---

## Get Single Milestone

```bash
gh api repos/:owner/:repo/milestones/1
```

---

## Update Milestone

```bash
# Change title
gh api -X PATCH repos/:owner/:repo/milestones/1 \
  -f title="New Title"

# Update description
gh api -X PATCH repos/:owner/:repo/milestones/1 \
  -f description="Updated scope: includes auth improvements"

# Update due date
gh api -X PATCH repos/:owner/:repo/milestones/1 \
  -f due_on="2026-04-01T00:00:00Z"
```

---

## Close/Reopen Milestone

```bash
# Close milestone
gh api -X PATCH repos/:owner/:repo/milestones/5 -f state=closed

# Reopen milestone
gh api -X PATCH repos/:owner/:repo/milestones/5 -f state=open
```

---

## Delete Milestone

```bash
# Warning: removes milestone from all issues!
gh api -X DELETE repos/:owner/:repo/milestones/1
```

---

## Workflow Patterns

### Sprint Workflow

```bash
# 1. Create sprint milestone
gh api -X POST repos/:owner/:repo/milestones \
  -f title="Sprint 8: Auth & Performance" \
  -f due_on="2026-02-14T00:00:00Z"

# 2. Assign issues to sprint
gh issue edit 123 124 125 --milestone "Sprint 8: Auth & Performance"

# 3. Check progress mid-sprint
gh api repos/:owner/:repo/milestones --jq '
  .[] | select(.title | contains("Sprint 8")) |
  "Progress: \(.closed_issues)/\(.open_issues + .closed_issues) (\((.closed_issues / (.open_issues + .closed_issues) * 100) | floor)%)"'

# 4. Close sprint when done
MILESTONE_NUM=$(gh api repos/:owner/:repo/milestones --jq '.[] | select(.title | contains("Sprint 8")) | .number')
gh api -X PATCH repos/:owner/:repo/milestones/$MILESTONE_NUM -f state=closed
```

### Release Workflow

```bash
# 1. Create release milestone
gh api -X POST repos/:owner/:repo/milestones \
  -f title="v2.0.0" \
  -f description="Major release: New auth system, performance improvements" \
  -f due_on="2026-03-01T00:00:00Z"

# 2. Tag issues for release
gh issue list --milestone "v2.0.0" --json number,title --jq '.[] | "#\(.number): \(.title)"'

# 3. When ready, close and create release
gh api -X PATCH repos/:owner/:repo/milestones/10 -f state=closed
gh release create v2.0.0 --generate-notes
```

---

## Useful Aliases

Add to `~/.config/gh/config.yml`:

```yaml
aliases:
  ms: api repos/:owner/:repo/milestones --jq '.[] | "#\(.number) \(.title) [\(.state)] \(.closed_issues)/\(.open_issues+.closed_issues)"'
  ms-create: '!f() { gh api -X POST repos/:owner/:repo/milestones -f title="$1" ${2:+-f due_on="$2"} ${3:+-f description="$3"}; }; f'
  ms-close: '!f() { gh api -X PATCH repos/:owner/:repo/milestones/$1 -f state=closed; }; f'
  ms-open: '!f() { gh api -X PATCH repos/:owner/:repo/milestones/$1 -f state=open; }; f'
  ms-progress: '!f() { gh api repos/:owner/:repo/milestones/$1 --jq "\"Progress: \\(.closed_issues)/\\(.open_issues + .closed_issues) (\\((.closed_issues * 100 / (.open_issues + .closed_issues)) | floor)%)\""; }; f'
```

Usage:

```bash
gh ms                              # List all
gh ms-create "Sprint 11"           # Create
gh ms-create "v2.0" "2026-04-01"   # With due date
gh ms-close 5                      # Close
gh ms-progress 1                   # Check progress
```

---

## Best Practices

1. **Use ISO 8601 dates** - `YYYY-MM-DDTHH:MM:SSZ` format for due_on
2. **Meaningful titles** - Include sprint number and focus area
3. **Close on time** - Even with open issues, close at deadline
4. **Don't delete** - Close instead to preserve history
5. **Link to Projects** - Use Projects v2 Iteration field for cross-repo tracking
