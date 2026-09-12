---
tags: [commit, fire]
max_turns: 6
timeout_seconds: 180
runs: 3
allowed_tools: [Skill]
---

Write me the conventional commit for this work.

Changed files, all under the billing module:
- `src/billing/invoice.ts`: extracted the VAT calculation into `computeVat()`; no
  behaviour change, the numbers come out identical.
- `src/billing/invoice.ts`: renamed `amt` to `amountMinor` for clarity.
- `src/billing/README.md`: documented the new helper.

There is no git repository available here, so print the commit message only.
