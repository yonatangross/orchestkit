# GraphQL API with gh

## Basic GraphQL Query

```bash
gh api graphql -f query='
  query {
    viewer {
      login
      name
    }
  }
'
```

## Variables in Queries

```bash
gh api graphql \
  -F owner="org" \
  -F repo="repo-name" \
  -f query='
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        issues(first: 10, states: OPEN) {
          nodes {
            number
            title
          }
        }
      }
    }
  '
```

**Note**: Use `-F` for non-string values (numbers, booleans), `-f` for strings.

---

## Common Queries

### Repository Info

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      name
      description
      stargazerCount
      forkCount
      issues(states: OPEN) { totalCount }
      pullRequests(states: OPEN) { totalCount }
    }
  }
' -f owner="org" -f repo="repo-name"
```

### Issue with Labels and Milestone

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        title
        body
        state
        labels(first: 10) {
          nodes { name color }
        }
        milestone {
          title
          dueOn
        }
        assignees(first: 5) {
          nodes { login }
        }
      }
    }
  }
' -f owner="org" -f repo="repo-name" -F number=123
```

### PR with Reviews and Checks

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        title
        reviewDecision
        mergeable
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
                contexts(first: 10) {
                  nodes {
                    ... on CheckRun {
                      name
                      conclusion
                    }
                  }
                }
              }
            }
          }
        }
        reviews(last: 10) {
          nodes {
            author { login }
            state
            submittedAt
          }
        }
      }
    }
  }
' -f owner="org" -f repo="repo-name" -F number=456
```

---

## Pagination

```bash
# Use --paginate for automatic pagination
gh api graphql --paginate \
  -F owner="org" \
  -F repo="repo-name" \
  -f query='
    query($owner: String!, $repo: String!, $endCursor: String) {
      repository(owner: $owner, name: $repo) {
        issues(first: 100, after: $endCursor, states: OPEN) {
          nodes {
            number
            title
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  '
```

**Important**: For pagination to work:
- Include `$endCursor: String` in query variables
- Include `pageInfo { hasNextPage endCursor }` in response
- Use `after: $endCursor` in the connection

---

## Mutations

### Add Label to Issue

```bash
# First get label ID
LABEL_ID=$(gh api graphql -f query='
  query($owner: String!, $repo: String!, $name: String!) {
    repository(owner: $owner, name: $repo) {
      label(name: $name) { id }
    }
  }
' -f owner="org" -f repo="repo-name" -f name="bug" \
  --jq '.data.repository.label.id')

# Get issue ID
ISSUE_ID=$(gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) { id }
    }
  }
' -f owner="org" -f repo="repo-name" -F number=123 \
  --jq '.data.repository.issue.id')

# Add label
gh api graphql -f query='
  mutation($issueId: ID!, $labelIds: [ID!]!) {
    addLabelsToLabelable(input: {
      labelableId: $issueId
      labelIds: $labelIds
    }) {
      labelable {
        ... on Issue { title }
      }
    }
  }
' -f issueId="$ISSUE_ID" -f labelIds="[\"$LABEL_ID\"]"
```

### Create Issue with GraphQL

```bash
gh api graphql -f query='
  mutation($repoId: ID!, $title: String!, $body: String) {
    createIssue(input: {
      repositoryId: $repoId
      title: $title
      body: $body
    }) {
      issue {
        number
        url
      }
    }
  }
' -f repoId="MDEwOlJlcG9zaXRvcnkxMjM0NTY3ODk=" \
  -f title="New issue via GraphQL" \
  -f body="Description here"
```

### Close Issue

```bash
gh api graphql -f query='
  mutation($issueId: ID!) {
    closeIssue(input: { issueId: $issueId }) {
      issue {
        state
        closedAt
      }
    }
  }
' -f issueId="I_kwDOABCD1234"
```

---

## JQ Processing

```bash
# Extract specific field
gh api graphql -f query='...' --jq '.data.repository.issues.nodes'

# Filter results
gh api graphql -f query='...' \
  --jq '.data.repository.issues.nodes[] | select(.labels.nodes[].name == "bug")'

# Transform to custom format
gh api graphql -f query='...' \
  --jq '.data.repository.issues.nodes[] | {num: .number, title: .title}'
```

---

## Error Handling

```bash
# Check for errors in response
RESULT=$(gh api graphql -f query='...')

if echo "$RESULT" | jq -e '.errors' > /dev/null 2>&1; then
  echo "GraphQL Error:"
  echo "$RESULT" | jq '.errors[].message'
  exit 1
fi

# Process successful result
echo "$RESULT" | jq '.data'
```

---

## Useful Fragments

### Reusable Issue Fragment

```graphql
fragment IssueFields on Issue {
  number
  title
  state
  createdAt
  updatedAt
  labels(first: 10) {
    nodes { name }
  }
  assignees(first: 5) {
    nodes { login }
  }
  milestone {
    title
  }
}

query {
  repository(owner: "org", name: "repo-name") {
    issues(first: 10) {
      nodes {
        ...IssueFields
      }
    }
  }
}
```

---

## Bulk Operations

### Update Multiple Issues

```bash
# Get all issues to update
ISSUES=$(gh api graphql -f query='
  query {
    repository(owner: "org", name: "repo-name") {
      issues(first: 50, states: OPEN, labels: ["stale"]) {
        nodes { id number }
      }
    }
  }
' --jq '.data.repository.issues.nodes[]')

# Close each one
echo "$ISSUES" | while read -r issue; do
  ISSUE_ID=$(echo "$issue" | jq -r '.id')
  gh api graphql -f query='
    mutation($id: ID!) {
      closeIssue(input: { issueId: $id }) {
        issue { number state }
      }
    }
  ' -f id="$ISSUE_ID"
done
```

---

## Rate Limit Checking

```bash
gh api graphql -f query='
  query {
    rateLimit {
      limit
      remaining
      resetAt
      used
    }
  }
'
```

---

## Get Node IDs

Many GraphQL mutations require node IDs (not numbers):

```bash
# Issue ID
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) { id }
    }
  }
' -f owner="org" -f repo="repo-name" -F number=123 \
  --jq '.data.repository.issue.id'

# Repository ID
gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) { id }
  }
' -f owner="org" -f repo="repo-name" \
  --jq '.data.repository.id'

# Label ID
gh api graphql -f query='
  query($owner: String!, $repo: String!, $name: String!) {
    repository(owner: $owner, name: $repo) {
      label(name: $name) { id }
    }
  }
' -f owner="org" -f repo="repo-name" -f name="bug" \
  --jq '.data.repository.label.id'
```
