# CI Integration (#1180)

Run /ork:expect in GitHub Actions and pre-push hooks.

## GitHub Actions Workflow

```yaml
# .github/workflows/expect.yml
name: Browser Tests (expect)
on:
  pull_request:
    branches: [main]

jobs:
  expect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for git diff

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Start dev server
        run: npm run dev &
        env:
          PORT: 3000

      - name: Wait for server
        run: npx wait-on http://localhost:3000 --timeout 30000

      - name: Install Claude Code + OrchestKit
        run: |
          npm install -g @anthropic-ai/claude-code@latest
          claude plugin install orchestkit/ork

      - name: Run expect
        run: |
          claude "/ork:expect --target branch -y"
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Upload artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: expect-results
          path: |
            .expect/reports/
            .expect/screenshots/
            .expect/recordings/
```

## Pre-Push Hook

```bash
# .git/hooks/pre-push (or via husky/lefthook)
#!/usr/bin/env bash
set -euo pipefail

# Quick fingerprint check — skip if no changes
if bash scripts/expect/fingerprint.sh check >/dev/null 2>&1; then
  echo "expect: No changes since last test run — skipping"
  exit 0
fi

# Run expect with branch target, skip review
claude "/ork:expect --target branch -y"
```

## Exit Code Mapping

| /ork:expect Exit | CI Behavior |
|-----------------|-------------|
| `0` (all pass) | CI passes |
| `0` (skip — fingerprint) | CI passes (zero-cost) |
| `1` (test failure) | CI fails, artifacts uploaded |
| `0` + warning (env issue) | CI passes with warning annotation |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API access |
| `CI` | Auto-set | Detected by expect, enables CI output mode |
| `GITHUB_ACTIONS` | Auto-set | Enables GitHub annotations format |

## Cost Optimization

- Fingerprint gating: zero-cost when nothing changed
- Scope strategy: `branch` target in CI limits test count
- `-y` flag: skip human review in automated pipelines
- `--target branch`: only test branch changes, not full site
