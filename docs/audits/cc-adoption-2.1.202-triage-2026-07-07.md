# CC 2.1.202 adoption audit — cross-verified triage

**Date:** 2026-07-07
**Author:** adoption session (routed via `/hq-ext:auto` → `/ork:auto` → a recon/verify/critic Workflow)
**Precedent:** `docs/audits/cc-adoption-2.1.198-201-triage-2026-07-05.md`
**Scope:** the full CC 2.1.202 changelog — 18 bullets — against every ork surface (`src/skills`,
`src/agents`, `src/hooks`, `src/settings`, `manifests`, `docs`, telemetry). npm latest at audit
time: 2.1.202; `latest_known` on `origin/main`: 2.1.201 → **2.1.202 in this PR** (see Key finding).

## Method

A single background Workflow, 15 agents, three phases — the "verify gate between extract and file"
the 2.1.186 triage asked for, run as machinery this time:

1. **Recon** (7 read-only Explore agents, one per candidate opportunity): read the actual source and
   proposed a precise edit spec (file, verbatim anchor, change, rationale). Read-only by construction
   — no agent could mutate the tree.
2. **Verify** (7 adversarial Explore agents, pipelined per opportunity): re-read each target,
   confirmed every anchor exists verbatim, corrected drift, and checked each change is faithful to
   the specific bullet (no invented capability). This phase produced the authoritative edit list.
3. **Critic** (1 Explore agent): independently re-classified all 18 bullets adopt/no-op with a
   default-to-flag bias, and checked the opportunity set for completeness.

### Key finding — the bump was uncommitted in-session, not merged (audit-at-HEAD)

`origin/main` carries `latest_known: 2.1.201`. The `latest_known: 2.1.202` bump, the
`otel-fields.md` field table, and the `cc-adoption-gaps.json` clear are **uncommitted working-tree
changes produced earlier in this same session** — by the `/hq-ext:auto` forked execution that ran the
adoption plan — **not** merged commits. The recon/verify pass read the working tree and mistook that
uncommitted `otel-fields.md` section for `origin/main` state (reporting it "already documented"),
which is the classic audit-at-HEAD misread this repo's memory (`audit pipeline state at origin/HEAD`)
and the prior audit's "audit corrections" section warn about. The correction verified every
"already there" claim with `git show origin/main:<path>` rather than a working-tree read.

**This PR therefore bundles the *complete* 2.1.202 adoption**: the `latest_known` bump +
`otel-fields.md` field table + gaps clear (the in-session `/hq-ext:auto` work), **plus** the six
doc-surface adoptions below. The in-session bump had left one drift — it advanced
`shared/cc-support.json` but not the stamped `LATEST_KNOWN_CC` constant — so `scripts/stamp-cc-support.mjs`
was re-run to propagate `2.1.202` into `src/hooks/src/lib/cc-version-matrix.ts`.

### Critic correction — one genuine miss (bullet 13)

The initial triage called bullet 13 (resume-by-name / resume picker slow + high memory in repos with
**many git worktrees**) a no-op. The critic flagged it as the one real miss: ork's operating model is
worktree-heavy (agents declare `isolation: worktree`, `/ork:implement` and `/ork:dev` spawn
branch-named worktrees, `hq-ext:start-issue` creates them), and the doctor version-compat matrix
already tracks a worktree-resume series (2.1.72/76/77/81/94) plus a `/resume` picker-fix row (2.1.97).
A 2.1.202 row is the natural, relevant continuation. Adopted in this PR.

## Per-bullet verdicts (all 18)

| # | Feature | Verdict | ork surface / evidence |
|---|---------|---------|------------------------|
| 1 | "Dynamic workflow size" `/config` setting | **ADOPT (this PR)** | `swarm-migrate` "vs CC /workflows" callout — the only src/ spot discussing CC `/workflows` agent counts. Noted as advisory ("hint, not an enforced cap"). |
| 2 | `workflow.run_id`/`workflow.name` OTel attrs | **ADOPT (this PR)** | `analytics/references/otel-fields.md` gains the "From 2.1.202" field table (in-session `/hq-ext:auto` work); `telemetry-inspect` gains the reconstruct-a-run bullet cross-linking it. |
| 3 | Ctrl+R history-search crash fix | no-op | Inline TUI history search; no ork surface. |
| 4 | `/rename` on bg sessions revert fix | no-op | `ci-sentinel` addresses sessions via `/resume` + ledger, never `/rename`. |
| 5 | mTLS handshake fix during cert rotation | no-op | ork has no mTLS/auth surface. |
| 6 | Remote Control "Unknown command" fix | no-op | Mobile/web command routing; no ork surface. |
| 7 | Remote Control image/caption drop fix | no-op | Remote Control media handling; no ork surface. |
| 8 | SSH sign-in URL clickability fix | no-op | `claude auth login` / `mcp login`; no ork surface. |
| 9 | `claude agents` chat crash/respawn fix | no-op | Harness crash fix; `ci-sentinel` already documents pin/resume, nothing to relax. |
| 10 | Workflow unicode-quote parse fix + line-accurate parse errors | **ADOPT (this PR)** | `chain-patterns/references/dynamic-workflow-patterns.md` "when it keeps parse-failing" — the `(line:col)` is now trustworthy; the TS-blame default (trap #3) is gone. |
| 11 | Voice dictation retry-loop fix | no-op | Voice; no ork surface. |
| 12 | `/remote-control` permission-mode display fix | no-op | Mobile/web DISPLAY bug; ork permission-mode config semantics unaffected. |
| 13 | Resume slow/high-memory in many-worktree repos | **ADOPT (this PR ⭐ critic catch)** | `doctor/references/version-compatibility.md` — continues the worktree-resume series; degradation = multi-minute/high-memory resume in ork's normal worktree-heavy condition. |
| 14 | Installer/updater "aborted" retry | no-op | CC binary installer; ork tracks plugin auto-update (2.1.116), not the binary installer. |
| 15 | Re-invoking a loaded skill no longer duplicates instructions | no-op | No stale "re-invoke duplicates context" warning exists in `src/` to relax (case-insensitive sweep clean). The behavior is a harness/Skill-tool property, not editable in ork source. No edit invented. |
| 16 | `/workflows` agent-list layout polish | no-op | Cosmetic; no ork doc pins that layout. Agent-count claim already covered by bullet 1. |
| 17 | MCP `url`-without-`type` clearer error | **ADOPT (this PR)** | `doctor/references/version-compatibility.md` — new row so the doctor runbook mirrors the "add `\"type\": \"http\"`" suggestion instead of the old `command: expected string`. |
| 18 | `/review` reverted to single-pass; `/code-review <level> <pr#>` for multi-agent | **ADOPT (this PR)** | `review-pr/SKILL.md` — two comparison blocks mislabeled built-in `/code-review` as single-pass; corrected to `/review` = single-pass, `/code-review <level> <pr#>` = multi-agent. |

**Actionable:** 6 bullets (1, 2, 10, 13, 17, 18). **No-op:** 12 bullets. **Already merged pre-this-PR:**
the `latest_known` bump + `otel-fields.md` field table.

## Adopted / shipped in this PR

0. **Version bump** — `shared/cc-support.json` `latest_known` 2.1.201 → 2.1.202 (floor/latest frozen
   at 2.1.183 per the manual override), stamped into `LATEST_KNOWN_CC`; `cc-adoption-gaps.json` 2.1.202
   entry cleared (`parse_failed: false` + `manual_resolution`) so the next cc-watch run prunes it.
   **`analytics/references/otel-fields.md`** — the "From 2.1.202" `workflow.run_id`/`workflow.name`
   field table with the HQ #6631 Langfuse-bridge note.
1. **`telemetry-inspect/SKILL.md`** — CC 2.1.202+ bullet: reconstruct a whole `/workflows` run from
   OTel via `workflow.run_id` (+ `select(... != null)` grouping gotcha), cross-linking the field table.
2. **`swarm-migrate/SKILL.md`** — the "Dynamic workflow size" `/config` advisory knob, flagged as a
   hint (not an enforced cap) so users don't redundantly hand-cap fan-out.
3. **`chain-patterns/references/dynamic-workflow-patterns.md`** — unicode-quote parse fix + the
   `(line:col)` pointer is now trustworthy and a "TypeScript" mention is now a real signal.
4. **`doctor/references/version-compatibility.md`** — two rows: (a) worktree-resume speed (bullet 13,
   the critic catch), (b) MCP `url`-without-`type` error message (bullet 17).
5. **`review-pr/SKILL.md`** — two blocks re-stating built-in `/review` (single-pass) vs
   `/code-review <level> <pr#>` (multi-agent) vs `/ork:review-pr` (project-aware audit).
6. **Playground** — `docs/chore--cc-2.1.202-adoption/decision-router-board.html` (the triage as a
   drag-to-prioritize + route-to-execution board).

## Non-goals

- **Floor bump**: `supported_floor`/`latest` stay 2.1.183 under the 2026-06-20 manual override
  (expires 2026-09-20). The `cc-support.json` reason already carries the dated 2.1.202 note.
- **skilldedup "relax stale warning"**: refuted — no such stale warning exists in `src/`. Adding an
  additive "dedup-safe" note would be new authored guidance, out of scope.

## Pipeline observation (for the next audit, not this PR)

The workflow's adversarial-verify phase paid for itself: it caught the already-merged bump before it
was re-shipped as a no-op, and the critic recovered a genuinely missed bullet (13). Both are the
classic failure classes — stale-tree no-op and silent-drop — that a single extract-then-file pass
keeps reproducing. The recon→verify→critic shape is a reusable template for the next adoption wave.
