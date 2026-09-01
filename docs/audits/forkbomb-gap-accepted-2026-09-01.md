# Decision: the fork-bomb gap is accepted, not guarded

**Date:** 2026-09-01
**Status:** Decided (option 1 of #3858), operator-approved
**Scope:** operator permission payload (`src/skills/setup/references/operator-permissions.json`), every repo that adopts it

---

## The decision

OrchestKit ships no guard for the shell fork bomb (`:(){ :|:& };:`), and this is deliberate. No PreToolUse hook is restored for it, and no deny rule is shipped for it. The payload README records the gap; this document records the decision and its expiry conditions.

## How we got here

1. The `dangerous-command-blocker` hook matched the fork-bomb pattern. The #3835 divergence purge deleted it, on the assumption that the native deny rule `Bash(:(){ :|:& };:)` held.
2. Measured 2026-08-31 on CC 2.1.252: that rule never held. CC rejects it at load ("Empty parentheses", rule skipped) and, since 2.1.25x, prints a Settings Warning for it at every session start.
3. No working spelling exists. `Bash(*:|:*)` and `Bash(:*)` were both measured with the restricted-smoke stub harness: the canary executed in both trip arms while the control arm proved the probe could see execution. A pattern containing `()` cannot be expressed at all.
4. Payload v4 (#3855) therefore deleted the rule. A rule that only looks like protection is worse than a recorded gap.

## Why accept rather than restore a hook

- The blocker hook's own fork-bomb match was broken for most of its life: its pattern was split on `|` and `;` during normalization, so the documented pattern never matched, and only a secondary legacy re-check caught it by accident (recorded in the #835 review notes). We would be restoring a guard with a poor track record, not a proven one.
- The deleted-hook classes that matter (`rm -rf` roots, device writes, force-push) either have working native rules, measured in `probe-payload-rules.sh`, or are refused by CC itself with no rule present (4 rules measured redundant on 2.1.252).
- A fork bomb in a CC session is disruptive but recoverable (kill the session); it does not destroy data or publish anything. The guard budget is better spent on the irreversible classes.
- The model layer refuses to run one regardless. That is not a gate, which is exactly why this is recorded as an accepted RISK, not as covered.

## What would reverse this

- CC permission rules gain escaping for parentheses (upstream ask, option 3 in #3858): restore a native rule and a trip case the same day.
- A real incident where a fork bomb executes in a session: restore a narrow PreToolUse hook scoped to this one pattern (option 2), with a test that pins the pattern actually matching, which the old hook never had.

## Evidence trail

- #3855, payload v4 changelog and README
- `tests/ci/restricted-smoke/probe-payload-rules.sh`, per-rule trip arms
- #3858, the issue this decision closes
