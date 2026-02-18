# Cost Estimation

Estimate token costs from CC's `~/.claude/stats-cache.json` using model-specific pricing.

## Pricing Table (Feb 2026)

| Model | Input/MTok | Output/MTok | Cache Read/MTok | Cache Write/MTok |
|-------|-----------|------------|----------------|-----------------|
| claude-opus-4-6 | $5.00 | $25.00 | $0.50 | $6.25 |
| claude-sonnet-4-5 | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-haiku-4-5 | $1.00 | $5.00 | $0.10 | $1.25 |

## Cost Formula

```
cost = (input_tokens / 1M * input_price)
     + (output_tokens / 1M * output_price)
     + (cache_read_tokens / 1M * cache_read_price)
     + (cache_write_tokens / 1M * cache_write_price)
```

**Cache savings** = cost if all cache reads were full-price input minus actual cost.

## All-Time Model Usage Query

```bash
jq '.modelUsage | to_entries | map({
  model: .key,
  input: .value.inputTokens,
  output: .value.outputTokens,
  cache_read: .value.cacheReadInputTokens,
  cache_write: .value.cacheCreationInputTokens
})' ~/.claude/stats-cache.json
```

## Daily Costs (Last 7 Days)

```bash
jq '.dailyModelTokens[-7:] | .[] | {date: .date, tokens: .tokensByModel}' ~/.claude/stats-cache.json
```

Note: `dailyModelTokens` only has total tokens per model, not split by type. Estimate with 70% input / 30% output ratio as a rough average for CC usage.

## Presentation Format

```markdown
## Token Cost Estimate

| Model | Input Tokens | Output Tokens | Cache Read | Cache Write | Est. Cost |
|-------|-------------|--------------|------------|-------------|-----------|
| claude-opus-4-6 | 5.2M | 1.4M | 42.0M | 2.1M | $16.20 |
| claude-sonnet-4-5 | 200K | 50K | -- | -- | $1.85 |
| **Total** | | | | | **$18.50** |

**Cache savings:** $8.20 (what it would cost without prompt caching)

### Daily Costs (Last 7 Days)
| Date | Est. Cost |
|------|-----------|
| Feb 12 | $2.10 |
| Feb 13 | $1.85 |
| **Total** | **$18.50** |
```

## User-Overridable Config

Users can override pricing by creating `~/.claude/orchestkit-pricing.json` — see `src/hooks/src/lib/cost-estimator.ts` for the schema.
