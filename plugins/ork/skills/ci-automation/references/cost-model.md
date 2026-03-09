# CI Automation Cost Model

## Per-Model Pricing (Approximate)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Best For |
|-------|----------------------|------------------------|----------|
| Haiku | $0.25 | $1.25 | Classification, triage |
| Sonnet | $3.00 | $15.00 | Code review, analysis |
| Opus | $15.00 | $75.00 | Complex multi-file review |

## Estimated Cost Per Job

| Job | Model | Turns | Est. Input | Est. Output | Cost/Run |
|-----|-------|-------|------------|-------------|----------|
| PR Review | Sonnet | 5 | ~20K | ~5K | $0.05-0.15 |
| Issue Triage | Haiku | 3 | ~5K | ~2K | $0.01-0.03 |
| Health Report | Sonnet | 10 | ~50K | ~10K | $0.10-0.20 |
| @claude Ad-hoc | Sonnet | 5 | ~15K | ~5K | $0.05-0.10 |

## Monthly Projections

### Low Activity (Solo Dev)

| Job | Frequency | Cost/Run | Monthly |
|-----|-----------|----------|---------|
| PR Review | 10 PRs | $0.08 | $0.80 |
| Issue Triage | 5 issues | $0.02 | $0.10 |
| Health Report | 30 nights | $0.15 | $4.50 |
| **Total** | | | **~$5.40** |

### Medium Activity (Small Team)

| Job | Frequency | Cost/Run | Monthly |
|-----|-----------|----------|---------|
| PR Review | 40 PRs | $0.08 | $3.20 |
| Issue Triage | 20 issues | $0.02 | $0.40 |
| Health Report | 30 nights | $0.15 | $4.50 |
| @claude mentions | 20 | $0.10 | $2.00 |
| **Total** | | | **~$10.10** |

### High Activity (Active Team)

| Job | Frequency | Cost/Run | Monthly |
|-----|-----------|----------|---------|
| PR Review | 100 PRs | $0.10 | $10.00 |
| Issue Triage | 50 issues | $0.02 | $1.00 |
| Health Report | 30 nights | $0.15 | $4.50 |
| @claude mentions | 50 | $0.10 | $5.00 |
| **Total** | | | **~$20.50** |

## Cost Optimization Strategies

1. **Model selection**: Use Haiku for classification tasks (triage), Sonnet for analysis (review, health)
2. **Turn limits**: `--max-turns 3` for triage, `--max-turns 5` for review, `--max-turns 10` for health
3. **Concurrency groups**: Prevent duplicate runs on rapid pushes with `cancel-in-progress: true`
4. **Timeouts**: Hard `timeout-minutes` as a safety net
5. **Skip drafts**: Add `if: github.event.pull_request.draft == false` to skip draft PRs
6. **Path filters**: Only trigger review for meaningful file changes

```yaml
on:
  pull_request:
    paths:
      - "src/**"
      - "*.ts"
      - "*.tsx"
    paths-ignore:
      - "docs/**"
      - "*.md"
```

## Budget Alerts

Monitor spending via GitHub Actions billing page or set up alerts:

```bash
# Check monthly usage
gh api /orgs/{org}/settings/billing/actions
```

For HQ integration (Phase 2), each report includes `costUsd` for tracking in Sanity/Prometheus.
