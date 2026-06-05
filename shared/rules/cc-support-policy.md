---
title: "CC Support Window Policy"
impact: HIGH
impactDescription: "Defines which Claude Code versions OrchestKit officially supports — drives floor bumps and CI matrix"
tags: [policy, claude-code, versioning, support-window]
---

# Claude Code Support Window Policy

## Rule

OrchestKit supports the **latest released Claude Code minor version plus the previous three**.

If `latest = 2.1.126`, then:

| Version  | Status |
|----------|--------|
| 2.1.126  | latest (fully supported, all features adopted) |
| 2.1.125  | supported |
| 2.1.124  | supported |
| 2.1.123  | supported |
| 2.1.122  | **floor** (minimum required) |
| 2.1.121  | dropped — not tested, not supported |
| ≤ 2.1.120 | dropped |

## When this triggers

Whenever a new CC version lands in `src/hooks/src/lib/cc-version-matrix.ts`, the GitHub Action `cc-support-window-bump.yml` recomputes the floor as `max - 3 minors` and opens a PR if it differs from the current `shared/cc-support.json` declaration.

## What the auto-bump PR does

1. Updates `shared/cc-support.json` (`latest`, `supported_floor`, `drop_after`)
2. Runs `scripts/stamp-cc-support.mjs` to propagate the new floor to:
   - `CLAUDE.md` (Version section, `>= X.Y.Z`)
   - `src/hooks/src/lib/cc-version-matrix.ts` (`MIN_CC_VERSION` constant)
   - `manifests/ork.json` (description blurb, when present)
   - `package.json` (`engines.claudeCode`, when present)
   - `.github/workflows/*.yml` (CI matrix entries that pin CC versions)
3. Updates `src/skills/doctor/references/version-compatibility.md` with the new "Minimum required" line at the top of the matrix
4. Opens an "M{next} migration" stub issue summarizing any deprecations users on the dropped version need to know about

## Why this policy

- **Latest + 3** is wide enough to absorb a typical 2-week release cadence without forcing users to upgrade weekly, and narrow enough that we never test against >5 versions.
- A formal policy stops floor-bump debate ("is 2.1.122 too aggressive?") — the math is the answer.
- Auto-bump on matrix change keeps the floor honest: if we adopt a feature gated at 2.1.130, the matrix entry forces the bump conversation that same day.

## Adoption is subtraction

When the cc-watch pipeline processes a release, "adopt the new features" is only half
the job. Each new or changed **native** mechanism must be checked against ork's own
mechanisms with one question:

> **What does this CC release let us delete?**

If a native mechanism now does what an ork hook/skill/script was doing, the adoption is
to **retire or thin** that ork code — not to layer more on top. A release processed
without running this subtraction pass is processed incompletely. The governing rule,
the drift taxonomy, and the live drift register live in `shared/rules/cc-native-first.md`.

## Manual override

A maintainer may pin the floor below policy by editing `shared/cc-support.json` directly with a `manual_override` block:

```json
{
  "supported_floor": "2.1.118",
  "manual_override": {
    "reason": "Support enterprise customer X stuck on 2.1.118 until Q3",
    "expires": "2026-09-01"
  }
}
```

The auto-bump workflow respects an unexpired override and opens an info-only PR instead of forcing the bump. After `expires`, normal policy resumes.

## Reference

- Issue: #1488
- Predecessor: M128's manual floor bump from 2.1.118 → 2.1.122 (PR #1585)
- Stamper script: `scripts/stamp-cc-support.mjs`
- Workflow: `.github/workflows/cc-support-window-bump.yml`
- Companion rule: `shared/rules/cc-native-first.md` (don't drift — adopt subtractively)
