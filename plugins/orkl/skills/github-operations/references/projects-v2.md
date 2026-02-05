# GitHub Projects v2

## Overview

GitHub Projects v2 uses custom fields for advanced project management. The `gh project` commands provide basic operations, but setting custom fields requires GraphQL.

---

## Basic Project Commands

```bash
# List projects
gh project list --owner @me

# View project
gh project view 1 --owner @me

# List fields
gh project field-list 1 --owner @me --format json

# Add item to project
gh project item-add 1 --owner @me \
  --url "https://github.com/org/repo/issues/123"

# Remove item from project
gh project item-delete 1 --owner @me --id "PVTI_abc123"
```

---

## Setting Custom Fields (GraphQL)

### Set Single Select Field (Status, Priority, etc.)

```bash
PROJECT_ID="PVT_kwHOAS8tks4BIL_t"
ITEM_ID="PVTI_..."  # From item-add result
FIELD_ID="PVTSSF_lAHOAS8tks4BIL_tzg4uOTk"
OPTION_ID="92ee1ecd"  # Option value ID

gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }) {
      projectV2Item {
        id
      }
    }
  }
' \
  -f projectId="$PROJECT_ID" \
  -f itemId="$ITEM_ID" \
  -f fieldId="$FIELD_ID" \
  -f optionId="$OPTION_ID"
```

### Set Text Field

```bash
gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $text: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { text: $text }
    }) {
      projectV2Item { id }
    }
  }
' \
  -f projectId="$PROJECT_ID" \
  -f itemId="$ITEM_ID" \
  -f fieldId="$TEXT_FIELD_ID" \
  -f text="Custom value"
```

### Set Number Field

```bash
gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $number: Float!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { number: $number }
    }) {
      projectV2Item { id }
    }
  }
' \
  -f projectId="$PROJECT_ID" \
  -f itemId="$ITEM_ID" \
  -f fieldId="$NUMBER_FIELD_ID" \
  -F number=5
```

---

## Complete Workflow: Create Issue + Add to Project

```bash
#!/bin/bash
# create-and-track.sh

TITLE="$1"
BODY="$2"
LABELS="${3:-enhancement}"
STATUS_OPTION="${4:-19303ae5}"  # Default: ready

# Configuration
PROJECT_NUMBER=1
PROJECT_OWNER="username"
PROJECT_ID="PVT_..."
STATUS_FIELD_ID="PVTSSF_..."
REPO="org/repo"

# 1. Create issue
ISSUE_URL=$(gh issue create \
  --repo "$REPO" \
  --title "$TITLE" \
  --body "$BODY" \
  --label "$LABELS" \
  --json url --jq '.url')

echo "Created: $ISSUE_URL"

# 2. Add to project
ITEM_ID=$(gh project item-add $PROJECT_NUMBER \
  --owner $PROJECT_OWNER \
  --url "$ISSUE_URL" \
  --format json | jq -r '.id')

echo "Added to project: $ITEM_ID"

# 3. Set status
gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }) {
      projectV2Item { id }
    }
  }
' \
  -f projectId="$PROJECT_ID" \
  -f itemId="$ITEM_ID" \
  -f fieldId="$STATUS_FIELD_ID" \
  -f optionId="$STATUS_OPTION"

echo "Set status"
```

---

## Query Project Items

### Get All Items with Status

```bash
gh api graphql -f query='
  query($owner: String!, $number: Int!) {
    user(login: $owner) {
      projectV2(number: $number) {
        items(first: 50) {
          nodes {
            id
            content {
              ... on Issue {
                number
                title
              }
              ... on PullRequest {
                number
                title
              }
            }
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
              }
            }
          }
        }
      }
    }
  }
' -f owner="username" -F number=1
```

### Get Items by Status

```bash
# Get all "In Development" items
gh api graphql -f query='
  query($owner: String!, $number: Int!) {
    user(login: $owner) {
      projectV2(number: $number) {
        items(first: 100) {
          nodes {
            content {
              ... on Issue { number title }
            }
            fieldValues(first: 5) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
' -f owner="username" -F number=1 \
  --jq '.data.user.projectV2.items.nodes[] | select(.fieldValues.nodes[].name == "In Development") | .content'
```

---

## Discovering Field IDs

If you need to find field/option IDs for a project:

```bash
# Get all fields with options
gh api graphql -f query='
  query($owner: String!, $number: Int!) {
    user(login: $owner) {
      projectV2(number: $number) {
        id
        fields(first: 20) {
          nodes {
            ... on ProjectV2Field {
              id
              name
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
            ... on ProjectV2IterationField {
              id
              name
            }
          }
        }
      }
    }
  }
' -f owner="username" -F number=1 | jq '.data.user.projectV2'
```

---

## Move Item Between Statuses

```bash
# Helper function
move_to_status() {
  local ITEM_ID="$1"
  local STATUS_OPTION_ID="$2"

  gh api graphql -f query='
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }
  ' \
    -f projectId="$PROJECT_ID" \
    -f itemId="$ITEM_ID" \
    -f fieldId="$STATUS_FIELD_ID" \
    -f optionId="$STATUS_OPTION_ID"
}

# Usage
move_to_status "PVTI_abc123" "92ee1ecd"  # Move to In Development
```

---

## Organization Projects

For organization-owned projects, use `organization` instead of `user`:

```bash
gh api graphql -f query='
  query($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        id
        title
      }
    }
  }
' -f org="my-org" -F number=1
```
