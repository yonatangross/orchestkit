---
title: Token Cost Calculation
impact: HIGH
impactDescription: "Ignoring cache token types in cost calculations produces wildly inaccurate estimates — cache reads are 10x cheaper than regular input and must be calculated separately"
tags: cost, tokens, pricing, cache, estimation
---

## Token Cost Calculation

Calculate accurate token costs using model-specific pricing with cache-aware formulas.

**Incorrect — treating all tokens equally:**
```typescript
// WRONG: ignores cache pricing difference (10x cheaper for reads)
const cost = totalTokens / 1_000_000 * 5.00;
```

**Correct — separate pricing per token type:**
```typescript
const mtok = 1_000_000;
const pricing = { input: 5.00, output: 25.00, cache_read: 0.50, cache_write: 6.25 };

const cost =
  (tokens.input / mtok) * pricing.input +
  (tokens.output / mtok) * pricing.output +
  (tokens.cache_read / mtok) * pricing.cache_read +
  (tokens.cache_write / mtok) * pricing.cache_write;

// Cache savings: what it would cost if cache reads were full-price input
const withoutCache =
  ((tokens.input + tokens.cache_read) / mtok) * pricing.input +
  (tokens.output / mtok) * pricing.output;

const savings = withoutCache - cost;
```

**Key rules:**
- Always calculate 4 token types separately: input, output, cache_read, cache_write
- Cache reads are 10x cheaper than regular input — this is the biggest cost factor
- Show cache savings prominently — users want to know caching is working
- When daily data only has total tokens (no split), estimate 70% input / 30% output
- Use `formatCost()` from `cost-estimator.ts` for consistent formatting
- Pricing is user-overridable via `~/.claude/orchestkit-pricing.json`
