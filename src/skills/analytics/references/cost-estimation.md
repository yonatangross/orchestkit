# Cost Estimation

Estimate token costs from CC's `~/.claude/stats-cache.json` using model-specific pricing.

## Pricing Table (Sep 2026)

Authoritative source: `src/hooks/src/lib/models.vocab.json` (`pricing`). Keep in sync.

| Model | Input/MTok | Output/MTok | Cache Read/MTok | Cache Write/MTok |
|-------|-----------|------------|----------------|-----------------|
| claude-opus-4-8 | $5.00 | $25.00 | $0.50 | $6.25 |
| claude-sonnet-5 | $2.00 | $10.00 | $0.20 | $2.50 |
| claude-sonnet-4-6 | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-haiku-4-5 | $1.00 | $5.00 | $0.10 | $1.25 |
| gemini-3.8-flash | $0.75 | $3.75 | $0.075 | $0.75 |

> `gemini-3.8-flash` (Google, GA 2026-09-02) is the first non-Claude row. It is priced so gateway or managed-override usage lands on its own row instead of the sonnet fallback. The figures are a promo through 2026-12-31; Google doubles them to $1.50 / $7.50 / $0.15 on 2027-01-01, so re-stamp the vocab row and this mirror that day. Cache write is the input rate (Google bills cache creation at input plus per-hour storage, no write premium). `gemini-3.8-flash-cyber` is not available: gated behind the Fairwind Program, not GA, no public price, no row.

> `claude-sonnet-5` is $2/$10 per MTok. This was the launch rate and was scheduled to rise to $3/$15 on 2026-09-01, so this table carried the higher sticker on purpose. The 2026-08-10 platform release notes cancelled that increase and made $2/$10 standard, so the sticker was wrong from that date until it was corrected on 2026-08-21. Note that `claude-sonnet-4-6` stays at $3/$15; the two Sonnets no longer share a price.

> **Verify before quoting.** Prices here are a mirror of `src/hooks/src/lib/models.vocab.json` (`pricing`), which is authoritative. A dated expiry note used to guard this table, but it guarded the wrong risk: the rate changed by being made permanent, months before the expiry date it was watching. Re-check the vocab rather than trusting a future date to be the only way this can go stale.

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
| claude-sonnet-4-6 | 200K | 50K | -- | -- | $1.85 |
| **Total** | | | | | **$18.50** |

**Cache savings:** $8.20 (what it would cost without prompt caching)

### Daily Costs (Last 7 Days)
| Date | Est. Cost |
|------|-----------|
| Feb 12 | $2.10 |
| Feb 13 | $1.85 |
| **Total** | **$18.50** |
```

## Pricing Precedence (#3878)

`getCostConfig()` in `src/hooks/src/lib/cost-estimator.ts` builds the effective rate table from three layers. Higher rows win; the multiplier is applied to every rate last.

| Layer | File | Row shape | Who sets it |
|-------|------|-----------|-------------|
| 1 (lowest) | `src/hooks/src/lib/models.vocab.json` `pricing` | `input_per_mtok`, `output_per_mtok`, `cache_read_per_mtok`, `cache_write_per_mtok` | OrchestKit, pinned to the CC binary by the nightly pricing canary |
| 2 | `~/.claude/orchestkit-pricing.json` `models` | same as layer 1, partial table allowed | the user |
| 3 | managed `modelPricing.overrides` | CC's `{ "input", "output", "cacheRead", "cacheWrite" }`, all four required, each 0 to 10000 | the org, in the OS managed settings file |
| last | managed `modelPricing.multiplier` | number in (0, 1], scales every rate including overrides | the org |

The managed file is the one CC itself reads for org policy, and nothing else: `/Library/Application Support/ClaudeCode/managed-settings.json` on macOS, `/etc/claude-code/managed-settings.json` on Linux and WSL, `C:\Program Files\ClaudeCode\managed-settings.json` on Windows. A `modelPricing` block in user, project or `--settings` files is ignored, the same as CC ignores it there.

```json
{
  "modelPricing": {
    "multiplier": 0.85,
    "overrides": {
      "claude-fable-5-1": { "input": 8, "output": 40, "cacheRead": 0.2, "cacheWrite": 10 }
    }
  }
}
```

With that file, `claude-fable-5-1` prices at $6.80 in / $34 out (the override, then 0.85x) and every other model at 0.85x list, which is the figure CC's `/cost` shows for the same org. Override keys match case-insensitively, resolve through the vocab aliases (`fable` prices the current Fable), and the earlier row wins a duplicate.

Failure handling, matching CC: a missing file or a file without `modelPricing` means list price and no output. Malformed JSON, a non-object block, a multiplier outside (0, 1] or a row missing one of the four rates is skipped with one stderr line per process (`[cost-estimator] managed modelPricing: ...`); the valid parts of the same block still apply, and nothing throws.

Not covered: `managed-settings.d/` drop-ins, MDM or server-managed policy sources, and the host-application fallback CC allows when no managed source sets `modelPricing`. Those still price at list here.
