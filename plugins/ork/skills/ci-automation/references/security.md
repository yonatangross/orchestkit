# CI Security Best Practices

## API Key Management

### GitHub Secrets (Required)

Store `ANTHROPIC_API_KEY` as a repository or organization secret:

```
Settings > Secrets and variables > Actions > New repository secret
```

Reference in workflows:

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Never Do

- Hard-code API keys in workflow YAML
- Echo or log API keys in workflow steps
- Store keys in `.env` files committed to the repo
- Use `set -x` in scripts that handle secrets

## Permission Scoping

Always use minimal permissions:

```yaml
# PR review: read code, write comments
permissions:
  contents: read
  pull-requests: write

# Issue triage: read code, write comments on issues
permissions:
  contents: read
  issues: write

# Health report: read-only
permissions:
  contents: read
  issues: read
  pull-requests: read
```

## Tool Whitelisting

In headless mode, use `--allowedTools` to restrict what Claude can do:

```bash
# Read-only analysis (health reports)
--allowedTools "Read,Grep,Glob,Bash(gh:*),Bash(npm:*)"

# Never allow in CI
# --dangerously-skip-permissions  (bypasses all safety checks)
```

## Fork PR Security

### Safe: `pull_request` Event

```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

- Runs in the fork's context
- No access to base repo secrets
- Safe from code injection

### Dangerous: `pull_request_target` Event

```yaml
# WARNING: Runs in base repo context with secret access
on:
  pull_request_target:
    types: [opened, synchronize]
```

- Runs with base repo permissions and secrets
- Fork code can access `ANTHROPIC_API_KEY`
- Only use for trusted contributors or with explicit checkout controls

### If You Must Use `pull_request_target`

```yaml
steps:
  # Checkout base branch (safe) for workflow code
  - uses: actions/checkout@v4

  # Only checkout PR code in an isolated step
  - uses: actions/checkout@v4
    with:
      ref: ${{ github.event.pull_request.head.sha }}
      path: pr-code

  # Never run PR code directly
  # Only analyze it with Claude
```

## Audit Logging

### GitHub Actions Logs

All workflow runs are logged in the Actions tab with:
- Trigger event and actor
- Full step output
- Duration and status

### HQ Integration (Phase 2)

Reports ingested to HQ include:
- `triggeredBy`: who/what started the run
- `runUrl`: link back to GitHub Actions
- `costUsd`: API spend per run
- `model`: which Claude model was used

## Concurrency Controls

Prevent abuse and runaway costs:

```yaml
concurrency:
  group: claude-review-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

This ensures:
- Only one review runs per PR at a time
- New pushes cancel stale in-progress reviews
- No parallel cost accumulation
