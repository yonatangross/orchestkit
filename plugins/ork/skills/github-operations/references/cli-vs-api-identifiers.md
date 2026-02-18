# CLI vs REST API Identifier Mapping

GitHub CLI (`gh`) and the REST API use **different identifier types** for the same resources. Mixing them is the #1 source of silent failures in automation.

## Quick Reference

| Resource | `gh` CLI flag | REST API field | Example |
|----------|---------------|----------------|---------|
| Milestone | `--milestone "Sprint 8"` (NAME) | `milestones/:number` (INTEGER) | CLI: `"Sprint 8"` → API: `/milestones/5` |
| Issue | `gh issue view 123` (number) | `issues/:number` (INTEGER) | Same — issue number works in both |
| PR | `gh pr view 456` (number) | `pulls/:number` (INTEGER) | Same — PR number works in both |
| User | `--assignee "username"` (LOGIN) | `assignees/:username` (STRING) | Same format, no confusion |
| Label | `--label "bug"` (NAME) | labels by name only | Same — no number in API either |
| Project | `gh project` uses **NUMBER** | Projects v2 uses **node_id** | Different! GraphQL needs `node_id` |

---

## The Milestone Footgun

`gh issue edit --milestone` and `gh issue list --milestone` accept a **milestone NAME (string)**, not a number.

The REST API endpoint is `repos/:owner/:repo/milestones/:number` — it uses the **milestone NUMBER (integer)**.

```bash
# CORRECT: gh CLI uses milestone NAME
gh issue edit 123 --milestone "Sprint 8"         # ✓ Name
gh issue list --milestone "Sprint 8"             # ✓ Name

# CORRECT: REST API uses milestone NUMBER
gh api -X PATCH repos/:owner/:repo/milestones/5 -f state=closed  # ✓ Number

# WRONG: don't pass a number to --milestone
gh issue edit 123 --milestone 5    # ✗ Silently fails or wrong milestone
```

### Look Up a Milestone Number

When you need a number (for REST API calls), look it up from the name:

```bash
# Get milestone number from name
MILESTONE_NUM=$(gh api repos/:owner/:repo/milestones \
  --jq '.[] | select(.title == "Sprint 8") | .number')

# Then use the number for REST API calls
gh api -X PATCH repos/:owner/:repo/milestones/$MILESTONE_NUM -f state=closed
```

---

## Projects v2 Identifier Confusion

Projects v2 has an extra layer: the project **number** (shown in URL) vs the project **node_id** (needed for GraphQL mutations).

```bash
# List projects — shows both number and id
gh project list --owner @me --format json --jq '.projects[] | {number, id}'
# Output: {"number": 1, "id": "PVT_kwDOAbc123"}

# gh project commands use NUMBER
gh project item-add 1 --owner @me --url https://github.com/org/repo/issues/123

# GraphQL mutations need node_id (the "PVT_..." value)
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "PVT_kwDOAbc123"   # node_id, not number
      ...
    })
  }
'
```

---

## Issue and PR Numbers

Issues and PRs use the same number in both CLI and REST API — no translation needed.

```bash
# Both work identically
gh issue view 123
gh api repos/:owner/:repo/issues/123

# JSON output includes both number and node_id
gh issue view 123 --json number,id
# {"number": 123, "id": "I_kwDOAbc123"}
```

GraphQL sub-issue mutations require the **node_id** (`I_kwDO...`), not the number.

---

## Safe Patterns

### Always resolve milestone names to numbers before REST API calls

```bash
get_milestone_number() {
  local name="$1"
  gh api repos/:owner/:repo/milestones \
    --jq --arg name "$name" '.[] | select(.title == $name) | .number'
}

MS_NUM=$(get_milestone_number "Sprint 8")
gh api -X PATCH repos/:owner/:repo/milestones/$MS_NUM -f state=closed
```

### Use `--json` to capture the created resource's identifier

```bash
# Capture milestone number at creation time
MILESTONE_NUM=$(gh api -X POST repos/:owner/:repo/milestones \
  -f title="Sprint 9" \
  --jq '.number')

# Now you have the number for REST API calls
gh api repos/:owner/:repo/milestones/$MILESTONE_NUM
```
