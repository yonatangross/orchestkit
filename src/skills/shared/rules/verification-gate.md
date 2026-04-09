---
title: Verification Gate
impact: critical
impactDescription: Prevents premature completion claims across all skills
tags: [verification, evidence, completion, cross-cutting]
---

## NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE

Before ANY claim of success, completion, or readiness:

1. **IDENTIFY** the proof command (test suite, linter, build, type check)
2. **RUN** it fresh — previous runs do NOT count
3. **READ** the complete output and exit code
4. **VERIFY** the output actually matches your claim
5. **ONLY THEN** state the claim with cited evidence

### Red Flags

If you catch yourself writing any of these, STOP:

- "Should work now" → RUN IT
- "Done!" before running tests → you are NOT done
- "I'm confident that..." → PROVE IT with output
- Expressing satisfaction before verification → RESET

### Evidence Format

```
✅ Tests pass (exit 0, 47/47 green)
✅ Build succeeds (exit 0, 0 warnings)
✅ Types check (exit 0, 0 errors)
```

Not acceptable:
```
❌ "Should be fine"
❌ "I believe this works"
❌ "Tests were passing earlier"
```

### Scope

This is the MINIMUM gate every skill must pass. It is NOT a replacement for `/ork:verify` (full pipeline with parallel agents and grading).

Violating the letter of this rule IS violating the spirit of this rule. No exceptions for time pressure, exhaustion, or user requests to skip.
