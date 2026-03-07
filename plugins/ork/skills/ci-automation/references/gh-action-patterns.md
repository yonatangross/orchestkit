# GitHub Action Patterns

## PR Review Workflow

Full workflow with conventional comments, concurrency, and cost controls:

```yaml
name: Claude PR Review
on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]
  workflow_dispatch:
    inputs:
      pr_number:
        description: "PR number to review"
        required: true
        type: string

permissions:
  contents: read
  pull-requests: write
  issues: write

concurrency:
  group: claude-review-${{ github.event.pull_request.number || github.event.inputs.pr_number }}
  cancel-in-progress: true

jobs:
  review:
    if: |
      github.event_name == 'pull_request' ||
      github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude'))
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Review this PR for code quality, security, tests, types, and performance.
            Use conventional comments: praise/suggestion/issue/nitpick.
          claude_args: "--max-turns 5 --model sonnet"
```

## Issue Triage Workflow

Auto-classify new issues with Haiku for cost efficiency:

```yaml
name: Claude Issue Triage
on:
  issues:
    types: [opened]
  workflow_dispatch:
    inputs:
      issue_number:
        description: "Issue number to triage"
        required: true
        type: string

permissions:
  contents: read
  issues: write

jobs:
  triage:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Triage this issue: classify type, suggest labels,
            recommend milestone, estimate complexity and priority.
            Do NOT auto-apply labels or milestones -- suggestion only.
          claude_args: "--max-turns 3 --model haiku"
```

## Nightly Health Report

Uses `claude -p` (headless CLI) for structured JSON output:

```yaml
name: Nightly Health Report
on:
  schedule:
    - cron: "0 2 * * *"
  workflow_dispatch:

permissions:
  contents: read
  issues: read
  pull-requests: read

jobs:
  health:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code
      - name: Run health assessment
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude -p "Run health assessment..." \
            --output-format json \
            --max-turns 10 \
            --model sonnet \
            --allowedTools "Bash(gh:*),Read,Grep,Glob" \
            > /tmp/health-report.json
```

## @claude Mention Handler

The `issue_comment` trigger combined with a body check enables @claude mentions:

```yaml
on:
  issue_comment:
    types: [created]

jobs:
  respond:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

The action automatically reads the comment context and responds inline.

## workflow_dispatch for HQ Integration

Trigger workflows from external systems (e.g., HQ dashboard buttons):

```bash
# Via gh CLI
gh workflow run claude-review.yml -f pr_number=123

# Via GitHub API
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/OWNER/REPO/actions/workflows/claude-review.yml/dispatches" \
  -d '{"ref":"main","inputs":{"pr_number":"123"}}'
```

## Fork PR Security

Use `pull_request` (not `pull_request_target`) for fork PRs:

```yaml
# SAFE: runs in fork context, no access to secrets
on:
  pull_request:
    types: [opened, synchronize]

# DANGEROUS: runs in base repo context with secrets access
# Only use if you trust ALL contributors
on:
  pull_request_target:
    types: [opened, synchronize]
```

For fork PRs, the workflow runs without `ANTHROPIC_API_KEY` access, so the review step will be skipped. This is the safe default.
