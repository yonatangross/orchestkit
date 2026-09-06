# EPIC C (#3308) state as measured 2026-09-06, CC 2.1.263

Input for brainstorm + assess. Every line is MEASURED (command run this session) unless tagged CLAIMED (read from an issue or page, not re-verified).

## The epic

- Filed 2026-08-08 from the convergence audit (archived at `100668f6f:docs/cc-convergence-audit-2026-08-08/index.html`). Last comment 2026-08-10. CC was 2.1.226 then; it is 2.1.263 now, 37 releases later.
- Rule stated in the body: re-home the opinion FIRST, observe it firing, THEN delete the pipe. Deleting first cost two PRs once (#1797).
- Milestone 164 (v10.0.0): 117 closed, 4 open. #3308 is one of the 4, `priority:high`.
- **Every filed RETIRE child on milestone 164 is CLOSED.** #3312, #3314, #3317, #3322, #3329, #3349, #3393, #3438. Sub-issues: 0. The tracker is open with no open children.

## Per-mechanism verdicts, epic thread (2026-08-10) vs today

| # | mechanism | epic thread said | measured today | evidence |
|---|---|---|---|---|
| 06 | 35 generated `commands/` wrappers | KEEP, blocked upstream (35 vs 0 at 2.1.226) | **RETIRED 2026-08-30** | `plugins/ork/commands/` = 0 files; `npm run verify:cc-commands` on 2.1.263: "wrapper-free plugin, native surfacing works", rc=0; PR #3807 merged 2026-08-30. Upstream anthropics/claude-code#18949 still OPEN (CLAIMED, last updated 2026-08-08) yet the probe passes, so the repo's own tripwire, not the upstream issue, decided it. |
| 09 | `cache-break-detector` fake cost `count x 350` | EXTEND: keep attribution, remove fabricated cost | **DONE** | `src/hooks/src/prompt/cache-break-detector.ts:246-249` now carries a comment documenting the removal; no live `* 350`. Brainstorm cites closure via #3665 (CLAIMED until verified). |
| 10 | keybindings shipped in docs | done, no re-home existed | DONE | #3393 closed 2026-08-10; `src/hooks/src/lib/keybindings.ts` absent. |
| 11 | `ork-elicit` skill | RETIRED, `AskUserQuestion` equivalent | DONE | `src/skills/ork-elicit/SKILL.md` absent. |
| 13 | `sweep-stale-worktrees` | KEEP, disjoint populations | KEEP, narrowed 2026-09-06 (#3353, PR #PRNUM) | file present. Thread's argument stands: CC sweeps registered worktrees; this sweeps unregistered empty dirs. The residue is gone: the sibling `<repo>-*` scanning branch (`sweepStaleSiblings`, the parent-directory walk) was deleted, the hook now touches only `.worktrees/` shells and `worktree-pending` markers inside the project, and a test pins that a stale sibling survives. |
| 05, 07, 08 | never named in any page I read | UNPROBED per thread | **cannot be located by number** | The audit page numbers items 01-31 by move counts, not by label, and says "read it off the milestone". The milestone's RETIRE children (all closed) are the only candidates: #3312 goal abort-if, #3317 goal brake, #3329 handoff loop, #3349 engine field / hand-written validator, #3322 egress guard. So 05/07/08 are most likely among those and therefore closed, but the mapping is inferred, not read. |
| handoff | duplicate across-time handoff loop | DONE | DONE | #3329 closed 2026-08-10. |

## The one live item, and it is OFF the milestone

`network-egress-guard` (#3322 closed COMPLETED 2026-08-30; retirement tracked in #3877, opened 2026-09-02, milestone NONE).

- Wiring today, CORRECTED after /ork:assess refuted my first read: the guard IS live. `src/hooks/hooks.json:15` registers `pretool/bash/sync-bash-dispatcher` for PreToolUse Bash; `sync-bash-dispatcher.ts:23` imports `networkEgressGuard` and `:67` runs it as a phase of every Bash command. `node src/hooks/scripts/validate-registry.mjs` (walks dispatcher fan-out): reachable closure 183 of 183 registered, dead 0, `Result: PASS`, rc=0. MEASURED. My earlier claim that its absence from hooks.json by name made it a silently-dead pipe was wrong: consolidated hooks are registered via their dispatcher, and the entries-map key in `pretool.ts:81` is the testable export every consolidated hook carries, not an orphan.
- `sandbox-posture.ts:13` records the operator decision (2026-08-23): freeze the guard and lean on `sandbox.enabled`.
- #3877 probes (CLAIMED from the issue, dated 2026-09-02, CC 2.1.258): sandbox boundary is real at the CONNECT proxy, covers curl and python alike, closes the #3438 bypass class. Interactive arm confirmed denied host refused without prompt, unlisted host times out, allowed host 200.
- #3877's stated remaining gate (step 3 of its plan): the guard's surviving DENY tier blocks executing fetched bytes (`curl ... | sh`, `eval $(curl ...)`), which no network policy covers when the host is allowed. Steps 1 (doctor override warning, PR #3887) and 2 (interactive probe) are done per the brainstorm (CLAIMED until verified).
- Brainstorm research (2026-09-06, Tavily + upstream CHANGELOG): CC 2.1.257 "Containment Escape" is an auto-mode auto-approval classifier change, not a network-layer block; upstream text does not claim it covers a staged curl to child-process chain. Net: makes "DENY tier now covered by CC" LESS likely, so keep-until-probed. CLAIMED, nobody has run `curl url | sh` under it on 2.1.263.
- Repo-local hazard found in #3877: `orchestkit/.claude/settings.local.json:125` had `sandbox.enabled: false`, silently defeating the user-scope posture. Removed 2026-09-02 14:05 per the last comment (CLAIMED).

## Precedent the brainstorm surfaced

#3835 (the divergence purge #3877 spun out of) was closed with milestone NONE while its one probe-gated tail item lived on as standalone #3877. Closing a tracker while a runtime-gated tail stands alone is how this repo already operates. CLAIMED until verified.

## Brainstorm recommendation (2026-09-06)

Option A: close #3308 now with a closing comment carrying the final 9-mechanism verdict table; #3877 continues standalone; append today's Containment Escape reading to #3877 as the documented starting hypothesis for its step-3 probe ("likely not covered: classifier, not network policy"). Option B (keep open until the probe runs) is defensible but the epic has sat a month on a task nobody scheduled. Option C (declare DENY tier covered from docs alone) is rejected: it repeats mechanism 06's retracted docs-over-implementation mistake.

## Not verified today

- No mechanism was re-probed at runtime except 06 (`verify:cc-commands`). 13 and the egress guard were read, not run.
- #3877's probe tables are the issue author's, dated 2026-09-02 on CC 2.1.258; not repeated on 2.1.263.
- Upstream #18949 state read from the GitHub API, not re-tested against the binary beyond the repo's own probe.
