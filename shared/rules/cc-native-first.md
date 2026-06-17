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
carry a written `KEEP` justification.

> **Re-audited 2026-06-05 (#2217), adversarially verified.** The first-pass audit (by
> code-only agents) was **~60% wrong** — it inferred "redundant with CC" from surface
> overlap without checking CC runtime behavior or structural dependencies. Every "rely
> on native" verdict was re-tested with a CC-capability check **and** a read of the
> consuming code. Net real drift across all 5 surfaces: the goal-emitter (shipped #2219)
> and the version-matrix catalogue (shipped #2229). The other three are load-bearing
> KEEPs. The 2.1.178 subtraction pass (2026-06-17) added two more rows — both KEEP.

| ork mechanism | CC-native equivalent | Verdict (verified) |
|---------------|----------------------|--------------------|
| `lifecycle/session-registrar.ts` + `session-finalizer.ts` + `posttool/heartbeat.ts` (sessions.db) | `claude agents --json` liveness (2.1.161/162) | 🟢 **KEEP** — `sessions` is the **enforced-FK parent** (`PRAGMA foreign_keys=ON`) of `locks`/`settings_overrides`/`worktree_links`; `enter-registrar.ts:54-57` does a two-phase insert *because* `worktree_links.child_sid` FK requires the session row first. The spine is load-bearing, not liveness drift. Only `posttool/heartbeat.ts` + the dead `last_heartbeat` column (~59 ln) is marginal removable drift. |
| `stop/goal-convergence-emitter.ts` (M168 bridge) | CC owns `goal-current.json` | ✅ **DONE (#2219)** — genuine Shadow (read CC-owned state, re-wrote `goal-history.jsonl`, emitted `goal_converged` with zero consumers). Removed. The M140 trio it was confused with is independently KEEP (below). |
| `prompt/goal-tracker.ts` + `stop/goal-tracker.ts` + `lifecycle/goal-budget-guard.ts` (M140 trio) | native `/goal` (2.1.139+) | 🟢 **KEEP** — enforces hard per-session turn/token ceilings (`ORK_GOAL_MAX_TURNS_PER_SESSION`=30, `ORK_GOAL_MAX_TOKENS_PER_SESSION`=250k) native `/goal` lacks; `goal-budget-guard` writes a brake file `prompt/goal-tracker` reads to gate the next `/goal` via `continueOnBlock`. Orthogonal safety guarantee. |
| `notification/desktop.ts` + `unified-dispatcher.ts` + `entries/notification.ts` (osascript) | hook `terminalSequence` (2.1.141) | 🟢 **KEEP** — *original THIN overturned.* `terminalSequence` is a raw OSC escape, **terminal-emulator-dependent** (silent in Apple Terminal / VS Code / tmux), title+body only; CC has **no native OS-level notification**. `osascript`/`notify-send` reaches the OS notification center across **all** terminals with rich content (repo+branch+issue#). Irreplaceable. [#1847 → won't-do] |
| `lib/cc-version-matrix.ts` (41 lines / 2 constants — was 615 lines / 478 entries) | CC has **no** runtime capability API | ✅ **DONE (#2229)** — the THIN shipped: `hasFeature`/`getAvailableFeatures`/`getMissingFeatures` had **zero production call-sites** (only `cc-version-check.ts` + `generate-docs-data.js`, each reading a single scalar), so the 478-row catalogue collapsed to `MIN_CC_VERSION` + `LATEST_KNOWN_CC` + `compareCCVersions()`. `LATEST_KNOWN_CC` is now stamped from `shared/cc-support.json` by `stamp-cc-support.mjs` once per adoption cycle. [#2217 → #2229] |
| `lifecycle/cc-version-check.ts` | CC 2.1.163 `requiredMinimumVersion` | 🟢 **KEEP** — `requiredMinimumVersion` is **managed-settings-only** (admin/MDM, hard-blocks before plugins load); a publicly-distributed plugin's users **cannot** set it. ork's SessionStart floor-warning is the only below-floor notice they get. The matrix-derived *adoption nudge* (now a single `LATEST_KNOWN_CC` scalar) is orthogonal and stays. |
| `subagent-start/model-cost-advisor.ts` + `pretool/task/fable-spend-consent.ts` | CC 2.1.178 `Tool(param:value)` permission rules, e.g. `Agent(model:opus)` | 🟢 **KEEP** — *subtraction pass run for 2.1.178, adversarially verified.* `Tool(param:value)` is **static** allow/deny matching with no I/O. `model-cost-advisor` reads agent frontmatter at runtime, infers complexity, computes savings %, and warns when a pinned tier is excluded by `availableModels` (#2408 correctness check); `fable-spend-consent` issues an interactive `outputAsk()` consent prompt with an `ORK_FABLE_OK` env bypass. Neither is a static gate — a permission rule cannot run logic, output advisory context, or prompt the user. Orthogonal, not Shadow. |
| (none — no ork code) | CC 2.1.178 fix: MCP server-level specs (`mcp__server`, `mcp__*`) in subagent `disallowedTools` now enforced | ✅ **N/A** — subtraction pass found **no ork workaround** for the pre-2.1.178 bug (no agent used `mcp__*` in `disallowedTools`; `mcp-health-check.ts` only validates config, never restricts tools). Pure CC bug fix — nothing to retire. Agents may now rely on native `disallowedTools: [mcp__*]` to scope MCP in subagents. |

## Adopting a CC feature = often deleting ork code

When a CC release adds a native mechanism, frame the adoption **subtractively**:

| Additive frame (avoid) | Subtractive frame (prefer) |
|------------------------|----------------------------|
| "Use the new Stop `additionalContext`" | Retire the homegrown turn-continuation state machine it replaces |
| "Trust subshell-aware `if:` matching" | Delete any PreToolUse hook re-parsing Bash to gate the same commands |
| "Document `requiredMinimumVersion`" | But it is **managed-settings-only** (admin/MDM) — a public plugin's users can't set it, so it does **not** replace a user-facing floor warning (see surface 5). Don't delete the warning hook on its account. |

## Auditing this register — two mandatory gates

The first-pass audit of this register was ~60% wrong because it reasoned from the file
*under* audit alone. Before acting on any "rely on CC native / this is drift" verdict:

1. **CC-capability check.** Actively feature-detect what the native surface
   (`terminalSequence`, native `/goal`, `requiredMinimumVersion`, capability APIs) can
   and cannot do on the current CC version. Never infer parity from a one-line changelog
   claim — that is exactly how the notification THIN was wrong (terminalSequence is
   terminal-dependent) and the version-check DELETE was wrong (`requiredMinimumVersion`
   is managed-only).
2. **Read the consumer, don't grep it.** Trace actual imports, FK constraints, and
   call-sites *in the consuming function* — never the "used somewhere" heuristic. Reading
   `cc-version-check.ts` revealed its only need is a scalar; reading `enter-registrar.ts`
   revealed the `sessions` FK is load-bearing; a grep that matched the word "feature"
   falsely flagged `cc-file-adoption-issues.sh` as a matrix consumer.

A grep for call-sites **plus a read of the consuming function** beats any verdict reasoned
from the audited file alone.

## Reference

- Origin: `/ork:brainstorm` no-drift analysis, CC 2.1.163 adoption window (2026-06-05)
- Re-audited + adversarially verified: 2026-06-05 (#2217)
- Pairs with: `shared/rules/cc-support-policy.md`
- Notification migration #1847: closed won't-do (terminalSequence would degrade)
- Version matrix: `src/hooks/src/lib/cc-version-matrix.ts` (THIN shipped #2229 — now 2 stamped constants)
- 2.1.178 subtraction pass: 2026-06-17 (CC 2.1.177–179 adoption window) — `Tool(param:value)` + MCP `disallowedTools` both KEEP, 0 drift removable
