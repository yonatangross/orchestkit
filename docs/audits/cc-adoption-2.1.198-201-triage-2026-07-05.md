# CC 2.1.198–2.1.201 adoption audit — cross-verified triage

**Date:** 2026-07-05
**Author:** audit session (routed via `/ork:auto` → `/ork:brainstorm` → `/ork:visualize-plan`)
**Precedent:** `docs/audits/cc-adoption-2.1.186-triage-2026-06-23.md`
**Scope:** all 19 open `cc-adoption` items for CC 2.1.198–2.1.201 — the 2.1.198 wave (#2721–#2729),
the 2.1.199 wave (#2739–#2742), the 2.1.200/201 wave (#2744–#2748), and the adoption-lag alarm
(#2749). npm latest at audit time: 2.1.201; `latest_known` before this PR: 2.1.197.

## Method

Two independent passes, cross-confirmed before any verdict:

1. **Docs research** (claude-code-guide agent): verified semantics of every enumerated change against
   code.claude.com docs and the upstream CHANGELOG, with per-item confidence.
2. **Surface sweep** (Explore agent): file:line evidence for every potentially affected ork surface
   across `src/`, `manifests/`, `shared/`, `scripts/`, `tests/`, `docs/`.

Verdicts required agreement from both passes — the "verify gate between extract and file" the
2.1.186 triage called for, run manually here.

### Audit corrections (what the verify pass caught in our own audit)

Two of the audit's own initial findings were **refuted by evidence** mid-session and are recorded
here so the next audit doesn't repeat them:

- **"cc-watch missed 2.1.199/2.1.200" — false.** The watcher backfills every version absent from
  `shared/cc-snapshots/` on each run (`scripts/cc-release-watch.mjs:226-240` — snapshot presence on
  disk is the single source of truth). All four snapshots were already merged to origin/main
  (#2743, #2750, #2752). The illusion came from auditing a **stale local checkout** (days behind
  origin) plus an **alphabetical `ls` trap**: `2.1.199` sorts before `2.1.87`, so `ls | tail` shows
  only `2.1.8x/9x` files and "snapshots end at 2.1.198" looks true. Two independent agents fell for
  it. Rule reinforced: fetch origin and read state at origin/HEAD before auditing pipeline output.
- **Planned "cc-watch backfill-all-versions" workflow change — dropped as no-op.** The capability
  already exists (same lines); there was nothing to build.

## Per-issue verdicts — 2.1.198 wave (#2721–#2729)

| Issue | Feature | Triage | Verdict | Evidence / ork surface |
|-------|---------|--------|---------|------------------------|
| #2727 | notification_hook_agent_events | new_event/10 | **ADOPTED (this PR)** | Real gap: `notification/desktop.ts:167` gated to `permission_prompt`/`idle_prompt`; `sound.ts` SOUND_MAP lacked both new types → events silently dropped (webhook-forwarder unaffected — it forwards ALL events). Fixed: needs-input → banner + Ping, completed → Glass sound-only. Tests added (162 pass). |
| #2726 | dataviz_skill | new_command/15 | **CLOSE — already adopted** | `visualize-plan` rents `/dataviz` for validated chart marks since PR #2732 (merged 2026-07-02); `chart-encoding-standard.md` documents the layer split. Issue stayed open only because #2732 lacked a `Closes` line. |
| #2721 | bg_agents_auto_commit_push_pr | breaking/20 | **CLOSE — no-op** | `claude agents` VIEW behavior (agents launched there auto-open draft PRs), distinct from the in-session Agent tool ork orchestrates. No ork skill drives `claude agents` worktree completion flows. |
| #2722 | explore_agent_inherits_model | breaking/20 | **CLOSE — doc row added** | No src/ surface hardcodes Explore=haiku (stale claims only in frozen playground history under `docs/`). Cost implication documented in version-compatibility.md + `explore` SKILL.md: premium-model sessions bill Explore at Opus. |
| #2723 | subagent_inherits_extended_thinking | breaking/20 | **CLOSE — no-op** | Automatic inheritance, no frontmatter knob exists; no ork workaround to remove (grep clean). Doc row added. |
| #2724 | bg_print_flags_rejected | breaking/20 | **CLOSE — no-op** | `--bg` documented in `ci-sentinel` (SKILL.md:86,90) and `dev` (SKILL.md:44,46) — never combined with `-p`/`--print`; `bare-eval` uses `claude -p --bare` without `--bg`. Nothing hits the rejected combo. |
| #2725 | subagent_parent_msg_task_direction | breaking/20 | **CLOSE — no-op** | Behavioral improvement in CC (launcher messages = task direction, never approval). ork's SendMessage patterns already assume exactly this. |
| #2728 | gateway_anthropic_aws_provider | new_field/10 | **CLOSE — no surface** | Gateway upstream-provider config (`anthropicAws`) is a CC gateway deployment concern; ork ships no gateway config surface. |
| #2729 | manual triage 2.1.198 + 2.1.197 | — | **CLOSE — satisfied by this audit** | 2.1.198 fully dispositioned above; 2.1.197 below. |

## Per-issue verdicts — 2.1.199/2.1.200/2.1.201 waves (#2739–#2749)

| Issue | Feature | Triage | Verdict | Evidence / ork surface |
|-------|---------|--------|---------|------------------------|
| #2739 | stacked_slash_skill_invocations | breaking/20 | **CLOSE — doc added** | Not breaking: additive loader change (≤5 leading skills load, args to the whole stack). No ork doc claimed "first-only". Documented in `auto` SKILL.md ("Stacked invocation"). |
| #2740 | dangerous_skip_perms_daemon_fix | breaking/20 | **CLOSE — no surface** | CLI arg-parsing fix for `claude --dangerously-skip-permissions daemon <cmd>`. ork never invokes `claude daemon`. |
| #2741 | plan_mode_browser_state_prompt | breaking/20 | **CLOSE — no surface** | Plan-mode gating of CC's built-in browser tools. ork's `expect`/`browser-tools` drive the external `agent-browser` CLI via Bash, not CC browser tool calls; no plan-mode permission assumption anywhere. |
| #2742 | manual triage 2.1.199 + 2.1.197 | — | **CLOSE — satisfied by this audit** | Full 2.1.199 sweep below; 2.1.197 below. |
| #2744 | askuserquestion_no_autocontinue | breaking/20 | **CLOSE — no-op, doc added** | ork uses AUQ as blocking intent gates (explore:74, verify:92, brainstorm:111, configure:45,188, cover:116, expect:233); nothing relied on auto-continue; `ORK_ASK_FALLBACK=text` path unaffected. `configure/references/cc-version-settings.md` §2.1.200 added. |
| #2745 | default_permission_mode_manual | breaking/20 | **CLOSE — no-op, doc added** | Display rename + accepted aliases; `default` stays valid. ork settings define no `defaultMode`/`permissionMode` keys; skill flags use explicit mode VALUES (`acceptEdits`/`dontAsk`/`plan`). |
| #2746 | daemon_handover_build_timestamp | breaking/20 | **CLOSE — CC-internal** | Background-agent daemon handover mechanics; no ork surface. |
| #2747 | background_agent_socket_auth_tokens | breaking/20 | **CLOSE — CC-internal** | Daemon roster/socket-auth fix; no ork surface. |
| #2748 | manual triage 2.1.200 + 2.1.201 + 2.1.197 | — | **CLOSE — satisfied by this audit** | 2.1.200 dispositioned above (+ worktree plugin-loading fix and `disabledMcpServers` crash fix: no-op, matrix rows added). 2.1.201's single bullet (Sonnet 5 harness-reminder delivery) is CC-internal; hook `additionalContext` unchanged. |
| #2749 | adoption lag: 2.1.201 vs latest_known 2.1.197 | alarm | **CLOSE — fixed by this PR** | `latest_known` advanced 2.1.197 → 2.1.201 via `scripts/stamp-cc-support.mjs`; floor/ceiling/matrix tests green post-stamp. |

Over-score check (2.1.186 pattern): 12 of 16 feature issues filed as `breaking/20`; honest count is
**0 breaking**. One real adoption gap across four releases (#2727, correctly filed as `new_event`).
The `breaking` over-score rate stays ~100% — third consecutive release proving the missing
verify-gate between extract and file.

## The stuck 2.1.197 gaps entry

`cc-triage` repeatedly `parse_failed` on 2.1.197 (single-bullet Sonnet 5 GA release), so the entry
sat in `shared/cc-adoption-gaps.json` as stuck and every subsequent watch run re-listed it in a new
manual-triage issue (#2729 → #2742 → #2748). 2.1.197 was already adopted 2026-06-30 (Sonnet 5 in
`models.vocab.json`, per the cc-support.json override note). This PR clears the entry
(`parse_failed: false` + `issues_filed_at` stamped + `manual_resolution` note) so the next watch run
prunes it and the manual-triage churn stops.

## Adopted / shipped in this PR

1. **Notification agent events** (#2727): `sound.ts` + `desktop.ts` + tests — the single real code
   gap in four releases. `ORK_SOUND_AGENT_NEEDS_INPUT` / `ORK_SOUND_AGENT_COMPLETED` env overrides
   work via the existing `ORK_SOUND_<TYPE>` convention.
2. **latest_known 2.1.197 → 2.1.201** via `scripts/stamp-cc-support.mjs` (floor/latest stay frozen
   at 2.1.183 per the manual override, expires 2026-09-20). Closes the #2749 lag alarm and the
   per-session adoption-lag nudge.
3. **version-compatibility.md**: 14 new matrix rows (2.1.198–2.1.201).
4. **Skill docs ×5**: `chain-patterns` (background-by-default await note), `explore` (Explore ≤Opus
   cost), `auto` (stacked slash-skills), `configure` (2.1.200 settings section), `bare-eval`
   (`CLAUDE_CODE_RETRY_WATCHDOG` for long harness runs).
5. **Stuck 2.1.197 gaps entry cleared** (above).

## Non-goals

- **Floor bump**: `supported_floor`/`latest` stay 2.1.183 under the 2026-06-20 manual override.
- **cc-watch backfill change**: refuted — capability already exists (see Audit corrections).
- **"agent-notify" preference skill**: discarded at the brainstorm keep/discard gate (YAGNI —
  `ORK_SOUND_*` env overrides already cover per-type customization).

## Pipeline observation (for the next audit, not this PR)

`cc-triage` `parse_failed` twice on single-bullet releases (2.1.197 here, empty-array overload
before — see memory `cc triage empty array overload`). A guard for trivially-small changelogs
(≤2 bullets → skip LLM, emit features:[] with a low-confidence marker) would kill the recurring
manual-triage churn class. Candidate for the next cc-watch hardening bundle, not this adoption PR.
