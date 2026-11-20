---
tags: [lane-0927, triage, fire]
max_turns: 6
timeout_seconds: 240
runs: 3
allowed_tools: [Skill]
---

Triage this bug report before anyone writes a fix. I only want the diagnosis, not a patch.

Issue #812, "Checkout returns 500 since Tuesday's deploy (v2.3.0)":
- Stack: `TypeError: Cannot read properties of undefined (reading 'currency') at formatPrice (src/cart/price.ts:42)`
- Reporter note: it only happens for some accounts. Support found that every affected account has a
  cart created before 2026-08-01. New carts check out fine.
- v2.3.0 changelog includes "cart: move price metadata into `cart.pricing` object".

I cannot give you repository access. Tell me the most likely root cause, how sure you are, and the
first thing I should check to confirm or refute it.
