---
title: "CC-Native-First (Don't Drift From Claude Code)"
impact: HIGH
impactDescription: "Governs ork's relationship to Claude Code internals — every parallel mechanism is a maintenance tax; adoption is as much deletion as addition"
tags: [policy, claude-code, architecture, drift, cc-watch]
---

# CC-Native-First — Don't Drift From Claude Code

## Rule

**OrchestKit is a guest; Claude Code is the substrate.** Wherever CC ships a native
mechanism, ork relies on it instead of maintaining its own version. Every place ork
keeps a parallel implementation of something CC also does natively is a standing
liability, not an asset.

The correct response to a CC release is not only *"what can we adopt?"* — it is just
as much *"what can we now delete?"*. A healthy ork **shrinks** as CC matures.

## Why drift is expensive

A parallel mechanism costs you on three axes, **forever**:

| Axis | Cost |
|------|------|
| Maintenance tax | Every CC release can move the ground under your copy |
| Brittleness | Your version breaks on CC updates CC never told you about |
| Divergence | Your behavior silently diverges from what users expect from "real" Claude Code, eroding trust in the plugin |

A native mechanism costs **zero** on all three — Anthropic maintains it.

## A taxonomy of drift (ranked by danger)

| Type | Definition | Verdict |
|------|-----------|---------|
| **Shadow** | Parallel reimplementation of a mechanism CC owns | 🔴 Highest risk — actively fights CC's own evolution |
| **Wrap** | Thin layer that adds nothing but coupling | 🟠 Pure coupling once the native path exists |
| **Mirror** | Hand-maintained copy of CC *knowledge* (e.g. a changelog re-keyed as code) | 🟠 The need may be real; the *format* is drift |
| **Workaround** | Compensates for a real CC bug/gap | 🟡 Valid **only while the gap exists** — becomes drift the instant CC fixes it |

Danger order is **Shadow > Wrap > Mirror > Workaround**.

## The decision rule

For any ork mechanism `M` that overlaps a CC-native mechanism `N`:

```
Does M do something N cannot, that users actually need?
  ├─ NO  ............... DELETE M, rely on N.            (drift removed)
  ├─ YES, N does ~80% .. THIN M to the remaining delta.  (drift contained)
  └─ YES, orthogonal ... KEEP M, document why here.      (not drift)
```

A `KEEP` is only legitimate with a written justification — see the register below.

## When this triggers

Every CC release processed by the cc-watch pipeline runs the **subtraction pass**
alongside the adoption pass: for each new/changed native mechanism, ask which ork
mechanism it makes redundant. An adoption that only *adds* code without checking for
deletions is incomplete. This pairs with `cc-support-policy.md` — see "Adoption is
subtraction" there.

## Drift register (audit targets)

Mechanisms where ork overlaps a CC-native equivalent. Each must `DELETE`, `THIN`, or
carry a written `KEEP` justification. Update this table as the audit resolves each.

| ork mechanism | CC-native equivalent | Type | Status |
|---------------|----------------------|------|--------|
| `lifecycle/session-registrar.ts` + `session-finalizer.ts` + `posttool/heartbeat.ts` (sessions.db liveness) | `claude agents --json waitingFor` (2.1.162), `done/total` (2.1.161) | Shadow | 🟠 **THIN** — delete the liveness triplet (~325 ln, 3 hooks, `sessions` table); keep `worktree_links`/`settings_overrides`/`skill_invocation`/`locks` (orthogonal). 24h sweep + `last_heartbeat` have zero in-repo readers. [#2217] |
| `stop/goal-convergence-emitter.ts` (M168 bridge) | CC owns `goal-current.json` natively | Shadow | 🔴 **DELETE** — duplicates `stop/goal-tracker`'s history write; `events.jsonl` `goal_converged` has no consumer. [#2217] |
| `prompt/goal-tracker.ts` + `stop/goal-tracker.ts` + `lifecycle/goal-budget-guard.ts` (M140 trio) | native `/goal` evaluator (2.1.139+) | Shadow | ✅ **KEEP** (justified below) |
| `notification/desktop.ts` + `notification/sound.ts` (osascript) | hook `terminalSequence` field (2.1.141) | Wrap | ⬜ audit (#1847) |
| `lib/cc-version-matrix.ts` (615 lines / 479 entries) | CC's own changelog / runtime capability | Mirror | ⬜ audit — is every entry load-bearing? |
| `lifecycle/cc-version-check.ts` | exists only to police the Mirror above | Workaround | ⬜ remove if the Mirror thins |

> **Confirmed KEEP (not drift):** the M140 goal trio enforces **hard per-session
> turn/token ceilings** (`ORK_GOAL_MAX_TURNS_PER_SESSION`=30,
> `ORK_GOAL_MAX_TOKENS_PER_SESSION`=250k) that native `/goal` has no equivalent for —
> `goal-budget-guard` (SessionEnd) writes a brake file that `prompt/goal-tracker`
> reads to gate the next `/goal` via `continueOnBlock`. Orthogonal safety guarantee;
> stays. (Audited 2026-06-05, #2217.)

## Adopting a CC feature = often deleting ork code

When a CC release adds a native mechanism, frame the adoption **subtractively**:

| Additive frame (avoid) | Subtractive frame (prefer) |
|------------------------|----------------------------|
| "Use the new Stop `additionalContext`" | Retire the homegrown turn-continuation state machine it replaces |
| "Trust subshell-aware `if:` matching" | Delete any PreToolUse hook re-parsing Bash to gate the same commands |
| "Document `requiredMinimumVersion`" | Recognize ork's `MIN_CC_VERSION` is a toothless declaration; the native setting *enforces* — lean on it, keep only the policy doc |

## Reference

- Origin: `/ork:brainstorm` no-drift analysis, CC 2.1.163 adoption window (2026-06-05)
- Pairs with: `shared/rules/cc-support-policy.md`
- Notification migration: #1847
- Version matrix: `src/hooks/src/lib/cc-version-matrix.ts`
