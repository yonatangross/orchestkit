---
name: ci-automation
license: MIT
compatibility: "Claude Code 2.1.59+. Requires gh CLI."
author: OrchestKit
description: "CI/CD automation with Claude Code -- GitHub Actions, headless CLI, and SDK patterns for automated reviews, triage, and health reports. Use when setting up CI pipelines with Claude."
context: fork
version: 1.0.0
tags: [ci, cd, github-actions, automation, headless, claude-code-action]
user-invocable: false
complexity: medium
metadata:
  category: devops
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# CI Automation

Patterns for integrating Claude Code into CI/CD pipelines using GitHub Actions, the headless CLI (`claude -p`), and the TypeScript SDK.

## Overview

Three automation methods, each suited to different use cases:

| Method | Use Case | Auth | Best For |
|--------|----------|------|----------|
| `anthropics/claude-code-action@v1` | GitHub Actions native | `ANTHROPIC_API_KEY` secret | PR reviews, issue triage |
| `claude -p "prompt"` | Scripts, cron, pipelines | `ANTHROPIC_API_KEY` env var | Health reports, batch analysis |
| `claude-code-js` SDK | Programmatic multi-turn | `ANTHROPIC_API_KEY` | Custom integrations |

## Quick Start: PR Review

Minimal workflow to auto-review PRs:

```yaml
name: Claude PR Review
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "Review this PR for code quality, security, and test coverage."
          claude_args: "--max-turns 5 --model sonnet"
```

## Authentication

### GitHub Actions

Store `ANTHROPIC_API_KEY` as a repository secret (Settings > Secrets > Actions).

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Headless CLI

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
claude -p "Analyze this codebase" --output-format json
```

### Alternative Providers

```bash
# AWS Bedrock
claude -p "prompt" --model bedrock:anthropic.claude-sonnet-4-20250514-v1:0

# Google Vertex AI
claude -p "prompt" --model vertex:claude-sonnet-4@20250514
```

## Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| Text | (default) | Human-readable PR comments |
| JSON | `--output-format json` | Structured data for ingestion |
| Stream JSON | `--output-format stream-json` | Real-time progress tracking |

### Parsing JSON Output

```bash
claude -p "Analyze code" --output-format json > result.json
# Extract the result field
node -e "const r = require('./result.json'); console.log(r.result)"
```

## Cost Controls

| Control | How |
|---------|-----|
| Cap iterations | `--max-turns 5` (review), `--max-turns 3` (triage) |
| Hard timeout | `timeout-minutes: 10` in workflow |
| Prevent duplicates | `concurrency: { group: ..., cancel-in-progress: true }` |
| Model selection | Haiku for classification, Sonnet for analysis, Opus for complex review |
| Tool whitelist | `--allowedTools "Read,Grep,Glob"` for read-only |

### Cost per Job

| Job | Model | Est. Cost/Run |
|-----|-------|---------------|
| PR Review | Sonnet | $0.05-0.15 |
| Issue Triage | Haiku | $0.01-0.03 |
| Health Report | Sonnet | $0.10-0.20 |
| @claude mention | Sonnet | $0.05-0.10 |

## Trigger Patterns

### Auto-trigger on Events

```yaml
on:
  pull_request:          # PR review
    types: [opened, synchronize]
  issues:                # Issue triage
    types: [opened]
  schedule:              # Nightly health
    - cron: "0 2 * * *"
```

### Manual Trigger (workflow_dispatch)

```yaml
on:
  workflow_dispatch:
    inputs:
      pr_number:
        description: "PR number to review"
        required: true
        type: string
```

Trigger via CLI: `gh workflow run claude-review.yml -f pr_number=123`

Trigger via API (for HQ dashboard integration):

```bash
gh api repos/{owner}/{repo}/actions/workflows/claude-review.yml/dispatches \
  -f ref=main -f "inputs[pr_number]=123"
```

### @claude Mentions

```yaml
on:
  issue_comment:
    types: [created]

jobs:
  respond:
    if: contains(github.event.comment.body, '@claude')
```

## Security

- API keys in GitHub Secrets only -- never in workflow YAML
- Scope `permissions:` to minimum needed (e.g., `contents: read`, `pull-requests: write`)
- Use `--allowedTools` to restrict tool access in headless mode
- Never use `--dangerously-skip-permissions` in CI
- Fork PRs: use `pull_request` (not `pull_request_target`) to avoid code injection

## Related Skills

- `github-operations` -- GitHub CLI patterns for issues, PRs, milestones
- `devops-deployment` -- Deployment automation and infrastructure
- `quality-gates` -- CI/CD quality gate integration
- `security-patterns` -- Security best practices for CI pipelines

## References

- [GitHub Action Patterns](references/gh-action-patterns.md) -- Full workflow examples
- [Headless CLI](references/headless-cli.md) -- `claude -p` flag reference
- [Cost Model](references/cost-model.md) -- Pricing and budget projections
- [Security](references/security.md) -- CI security best practices
