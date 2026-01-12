# GitHub Projects v2

## Overview

GitHub Projects v2 uses custom fields for advanced project management. The `gh project` commands provide basic operations, but setting custom fields requires GraphQL.

---

## SkillForge Project Configuration

**Project**: Reporter Accuracy - Sprint Board
**Number**: 1
**Owner**: yonatangross
**Project ID**: `PVT_kwHOAS8tks4BIL_t`

### Status Field (13 States)

| Status | Option ID | Description |
|--------|-----------|-------------|
| 📋 ready | `19303ae5` | Ready to start |
| 🎯 planned | `f2085676` | Planned for sprint |
| 🚧 in-development | `92ee1ecd` | Active development |
| 🔧 code-complete | `e27c7ae4` | Code finished |
| 🧪 unit-testing | `048fd4bb` | Running unit tests |
| 🔗 integration-testing | `4be449e1` | Integration tests |
| 🎭 e2e-testing | `b55bb79c` | E2E testing |
| 👀 review-ready | `14cafa46` | Ready for review |
| 🔍 reviewing | `612eb4af` | In code review |
| ✅ approved | `1e03846e` | PR approved |
| 🚀 staging-ready | `e3bcef39` | Ready for staging |
| 🏭 production-ready | `42a25f2e` | Ready for production |
| 🎉 deployed | `f39cbda5` | Deployed |

### Priority Field

| Priority | Option ID |
|----------|-----------|
| 🔥 Critical | `c7f4abc6` |
| ⚡ High | `71b87386` |
| 🔄 Medium | `8ccbc1d2` |
| 📋 Low | `114a8646` |

### Domain Field

| Domain | Option ID |
|--------|-----------|
| 🤖 ML | `538d3e91` |
| 🎨 UX | `48aa306d` |
| 🔧 Backend | `cdbd5e4f` |
| 🧪 Testing | `5ea2714a` |
| 🔒 Security | `16b6f018` |

### Field IDs

| Field | Field ID |
|-------|----------|
| Status | `PVTSSF_lAHOAS8tks4BIL_tzg4uOTk` |
| Priority | `PVTSSF_lAHOAS8tks4BIL_tzg4uQnI` |
| Domain | `PVTSSF_lAHOAS8tks4BIL_tzg4uRL8` |
| Sprint | `PVTIF_lAHOAS8tks4BIL_tzg4uQFA` |
| Story Points | `PVTF_lAHOAS8tks4BIL_tzg4uQ1g` |

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
  --url "https://github.com/ArieGoldkin/SkillForge/issues/123"
```

---

## Setting Custom Fields (GraphQL)

### Set Status Field

```bash
PROJECT_ID="PVT_kwHOAS8tks4BIL_t"
ITEM_ID="PVTI_..."  # From item-add result
STATUS_FIELD_ID="PVTSSF_lAHOAS8tks4BIL_tzg4uOTk"
IN_DEV_OPTION_ID="92ee1ecd"

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
  -f fieldId="$STATUS_FIELD_ID" \
  -f optionId="$IN_DEV_OPTION_ID"
```

### Set Priority Field

```bash
PRIORITY_FIELD_ID="PVTSSF_lAHOAS8tks4BIL_tzg4uQnI"
HIGH_PRIORITY_ID="71b87386"

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
  -f fieldId="$PRIORITY_FIELD_ID" \
  -f optionId="$HIGH_PRIORITY_ID"
```

---

## Complete Workflow: Create Issue + Add to Project

```bash
#!/bin/bash
# create-and-track.sh

TITLE="$1"
BODY="$2"
LABELS="${3:-enhancement}"
STATUS="${4:-19303ae5}"  # Default: 📋 ready

# Configuration
PROJECT_NUMBER=1
PROJECT_OWNER="yonatangross"
PROJECT_ID="PVT_kwHOAS8tks4BIL_t"
STATUS_FIELD_ID="PVTSSF_lAHOAS8tks4BIL_tzg4uOTk"
REPO="ArieGoldkin/SkillForge"

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
  -f optionId="$STATUS"

echo "Set status to: $STATUS"
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
' -f owner="yonatangross" -F number=1
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
' -f owner="yonatangross" -F number=1 \
  --jq '.data.user.projectV2.items.nodes[] | select(.fieldValues.nodes[].name == "🚧 in-development") | .content'
```

---

## Discovering Field IDs

If you need to find field/option IDs for a new project:

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
' -f owner="yonatangross" -F number=1 | jq '.data.user.projectV2'
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
    -f projectId="PVT_kwHOAS8tks4BIL_t" \
    -f itemId="$ITEM_ID" \
    -f fieldId="PVTSSF_lAHOAS8tks4BIL_tzg4uOTk" \
    -f optionId="$STATUS_OPTION_ID"
}

# Usage
move_to_status "PVTI_abc123" "92ee1ecd"  # Move to 🚧 in-development
```

---

## Remove Item from Project

```bash
gh project item-delete 1 --owner yonatangross --id "PVTI_abc123"
```
