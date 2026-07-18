# CC Adoption Triage — 2.1.209 through 2.1.214 (2026-07-18)

**Outcome:** `latest_known` advanced 2.1.208 → 2.1.214 (soft). `supported_floor`/`latest`/`drop_after` stay frozen at 2.1.206/2.1.206/2.1.205 by design — the strict `manual_override` pin holds; `latest_known` diverges from `latest` while the floor is frozen. No `.latest` fixture coupling touched. (2.1.213 was never published on npm; the feed jumps 212 → 214.)

**Decision:** Soft adoption-coverage advance, not a floor renewal. Five releases (166 changelog bullets) triaged in one bundled pass after the auto-triage pipeline degraded across the window: extraction failed for 2.1.211 (#2916), silently truncated 12/48 bullets for 2.1.212 (#2950), and filed nothing for 2.1.209. Every bullet — filed or not — was ground-truth verified against the ork codebase by four parallel read-only agents.

**Bottom line: ZERO code adoptions across all five releases.** All changes resolve to no-op, upside, or documentation rows. Of the 49 auto-filed issues, 3 are CONFIRMED-surface (all resolving to doc rows, not code) and 46 are keyword false positives — worse than the historical ~60% rate.

## 2.1.209 (Jul 15) — 1 bullet, nothing filed

Single TUI fix: `/model` and other dialogs unblocked in `claude agents` background sessions (reverts an overly broad guard). No ork surface. The auto-filer's zero-issue output was correct, not a skipped run.

## 2.1.210 (Jul 15) — 33 bullets, 17 issues (#2890–#2906), ALL false-positive

| Change | Classification |
|--------|----------------|
| Worktree subagent git isolation (#2890) | Doc row — 15+ ork agents set `isolation: worktree`; none rely on mutating the main checkout. Aligns with ork's merge-back rule |
| Ultracode human-only trigger + `--effort ultracode` dispatch (#2891, #2896) | No-op — ork invokes the Workflow tool programmatically (already documented, version-compatibility.md) and never calls `claude agents --effort ultracode` |
| Hook timeout no longer reported as user rejection (#2892) | Upside for ork's hooks — no config change |
| Plugin MCP survives resync (#2893) | Upside for `ork-elicit` — no change |
| Path-scoped permission rule warning (#2904) | **Top candidate, disproven** — ork ships only bare tool grants (`src/settings/ork.settings.json`), zero `Tool(path)` rules: `grep '(Write\|Glob\|NotebookEdit)(' settings+manifest+hooks.json` = 0 |
| Positional placeholders preserved (#2895) | No-op — all `$1`/`$2` hits are bash args in `scripts/*.sh` and Postgres params in reference docs; ork ships no `commands/` invocation placeholders |
| Sandbox symlink reconcile (#2898) | No-op — `build-plugins.sh` uses real dirs, no symlinks |
| SDK MCP immediate connect (#2897), sonnet5 auto-mode classifier (#2902), Bedrock/Vertex doctor (#2903), Bash timeout/cd message text (#2905, #2906), plan-approval label (#2894), worktree lock sweep (#2900), Agent-tool injection hardening (#2899), memory-index errors (#2901) | No-op / CC-internal / upside |
| Unfiled bullets: elapsed-time counter, crash telemetry, paste-marker leak, `claude attach`, bigint crash, bg-worker crash-loop, task-tracker drop, pasted-image retention, ghost frames, bundled dataviz OKLab (ork does not vendor dataviz), screen-reader announce, agents-view fixes | All no-op |

## 2.1.211 (Jul 16) — 37 bullets, 6 issues (#2923–#2928), 1 CONFIRMED

| Change | Classification |
|--------|----------------|
| **Auto mode no longer overrides a PreToolUse hook's `ask` (#2924)** | **CONFIRMED surface, CC-side fix** — ork's `network-egress-guard.ts` and `dangerous-command-blocker.ts` emit `permissionDecision:'ask'` from PreToolUse Bash; auto mode previously could override them, now an `ask` floors at a prompt. Ork's egress/danger guards now actually fire under auto mode. No ork change; matrix row |
| "Always allow" saved at repo root (#2927) | Doc row — interactively-granted approvals persist across worktrees/sessions; relevant to ork's worktree-heavy model. Not ork's declared static allow/deny |
| `--forward-subagent-text` / `CLAUDE_CODE_FORWARD_SUBAGENT_TEXT` (#2928) | Doc row — new headless stream-json flag available to bare-eval/ci-sentinel; not consumed today |
| Permission-preview char neutralize (#2923) | No-op — ork renders no permission previews |
| Nested `.claude/rules` source exclusion (#2925) | No-op — the plugin distributes rules via `src/rules/` → build, not project `.claude/rules` settings loading |
| Env-var scientific notation (#2926) | No-op — ork sets only plain-integer env vars (SCRIPT_CAPS, STREAM_IDLE_TIMEOUT_MS, SESSIONEND_HOOKS_TIMEOUT_MS) |
| 31 unfiled bullets (TUI, Chrome-ext, Windows, provider billing, a11y, bg-session fixes) | All no-op; several pure upside (subagent model kept on resume, bg-agent result reporting, memory-index over-limit measurement) |

## 2.1.212 (Jul 17) — 48 bullets, 12 issues (#2934–#2945), 2 CONFIRMED; filer truncated 36/48 (#2950)

The auto-filer captured only 12 of 48 bullets (#2950). The 36 unfiled bullets were triaged with equal rigor — **nothing real was hiding in the truncated range.**

| Change | Classification |
|--------|----------------|
| **Hook `continue:false` halt no longer dropped mid-stream (#2937)** | **CONFIRMED surface, CC-side fix** — ork's blocking hooks (`skill/merge-readiness-checker.ts`, SessionEnd/SubagentStop dispatchers) benefit; hook-infra errors no longer misreported as user rejections. Matrix row |
| **Plan mode no longer auto-runs file-modifying Bash (#2935)** | **CONFIRMED surface, CC-side fix** — makes the "read-only plan mode" claims in implement/brainstorm SKILL.md accurate. Matrix row |
| Worktree symlink escape fix (#2936) | Doc row — worktree-security lineage (2.1.203/2.1.206); ork commits no `.claude/worktrees` symlink |
| `/fork` → background-session copy; in-session subagent renamed `/subtask` (#2941) | Doc row — ork's "fork pattern" is `Agent()` auto-fork, unaffected; stale `/fork→/branch` row in version-compatibility.md updated |
| MCP calls >2min auto-background, `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` (#2934) | Doc row — complements the 2.1.206 `request_timeout_ms` row; ork sets neither |
| ExitWorktree after `--continue`/`--resume` in print/SDK (unfiled) | Doc row — 38 ork agents carry ExitWorktree; relevant headless (bare-eval, ci-sentinel) |
| Session caps: 200 web searches (#2943), 200 subagents (#2944) | No-op — ork's own subagent caps are 6–12, far below the ceiling |
| `agents --json` needs_input status (#2940), transcript reasoning-effort attr (#2945) | No-op — nothing parses `agents --json` status; analytics reads effort from OTEL, not transcripts |
| Force login method (#2938), SDK setModel mid-turn (#2939), auto-mode reset command (#2942) | Correctly-empty — no ork surface |
| ultrareview PR-ref parse / branch fetch / billing-after-clear (unfiled) | One-line note in review-pr's ultrareview-gate reference |
| OTEL HTTP chunked-encoding + OTLP traceId/spanId headless (unfiled) | Not this repo — routed to the HQ Langfuse OTEL bridge track (platform#6631) |
| Remaining unfiled bullets (SIGTERM tree-kill, PS7, TUI, SendMessage token dedup, Task `mode:` param deprecation — ork passes none) | All no-op |

## 2.1.214 (Jul 17) — 47 bullets, 14 issues (#2975–#2988); the ONE real adoption was the unfiled feature

All 14 auto-filed issues are no-op or doc-only. The single real code adoption — `sessionstart_fork_source` — is the one extracted feature that was **never filed as an issue** (gap_score 5, empty `affected_skills`). Classic inverse-of-the-flagger outcome.

| Change | Classification |
|--------|----------------|
| **SessionStart reports `source: "fork"` (unfiled)** | **REAL ADOPTION** — `sync-session-dispatcher.ts` gated light-mode on `compact`/`resume` only; forks previously arrived as `"resume"` (implicitly light) and on 2.1.214 would arrive as `"fork"`, re-materializing antipattern/profile rules and re-running every non-`skipOnResume` SessionStart hook per fork. Fixed: `fork` added to the light-mode gate + source-gating tests added (forks share the original session's project dir, so on-disk rules are current) |
| Permission-analyzer tightenings (#2975–#2979): `dir/**` allow scoping, fd-redirect fail-closed, >10k-char commands prompt, zsh subscripts prompt, `--help`/`man` auto-approve narrowed | No-op — ork's Bash rules are **deny-only** (`ork.settings.json`), its allow-list is bare tool names + MCP wildcards, and `hooks.json` has zero path-glob `if:` conditions. The tightenings cannot fire on any ork rule |
| Hook `if:` single-segment scope (#2982), hook exit-2 block on bad JSON (#2981) | No-op / upside — ork `if:` conditions are `Bash(...)`/`AskUserQuestion(*)` command matchers; ork's exit-2 path is stderr-only with no stdout JSON to collide |
| OTEL `message.uuid` / `client_request_id` / `tool_source` attrs (#2986) | Doc — added to `analytics/references/otel-fields.md` |
| `CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH` (#2987) | Doc — added to `configure/references/cc-version-settings.md` |
| Memory `modified` timestamp (#2985), subagent statusline effort (#2988), docker daemon-redirect perm (#2983), file magic `files-from` perm (#2984), remote prompt ordering (#2980) | No-op — dream parses name/description/type only; ork ships no statusline; no `docker(...)`/`file(...)` allow rules; no remote-UI surface |
| Unfiled bullets: `--settings` plugin-load fix, cost double-count fix, memory frontmatter hash truncation, MCP transient-error `/clear` fix, OTEL async-context trace, ultrareview no-merge-base error, Windows/PowerShell batch, background-daemon plumbing, keepalive pool | All no-op or upside |

## Stamped surface

Only `src/hooks/src/lib/cc-version-matrix.ts` `LATEST_KNOWN_CC` advanced to 2.1.214 (via `scripts/stamp-cc-support.mjs`). Floor-derived declarations (CLAUDE.md, README, `MIN_CC_VERSION`, doctor/troubleshooting docs) are unchanged because `supported_floor` held at 2.1.206.

## Files changed by this triage

| File | Change |
|------|--------|
| `src/hooks/src/lifecycle/sync-session-dispatcher.ts` | `fork` added to the light-mode gate (the one real adoption) |
| `src/hooks/src/__tests__/lifecycle/sync-session-dispatcher.test.ts` | Source-gating tests: light on `compact`/`resume`/`fork`, full on `startup`/`clear` |
| `src/skills/analytics/references/otel-fields.md` | 2.1.214 section: `message.uuid`, `client_request_id`, `tool_source` |
| `src/skills/configure/references/cc-version-settings.md` | 2.1.214 section: `CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH` |
| `src/skills/doctor/references/version-compatibility.md` | 12 matrix rows covering 2.1.210–2.1.214 |
| `src/skills/review-pr/references/ultrareview-gate.md` | 2.1.212 reliability note (PR refs, branch fetch, billing after `/clear`) |
| `shared/cc-support.json` | `latest_known` 2.1.208 → 2.1.214 + reason note |

## Pipeline sentinels closed by this triage

| Issue | Disposition |
|-------|-------------|
| #2916 (manual triage needed for 2.1.211) | ✅ Done — this doc IS that triage |
| #2917 (adoption lag ≥3 releases) | ✅ Cleared — `latest_known` = upstream head 2.1.214 |
| #2951 (no 2.1.212 snapshot) | ✅ Stale — `shared/cc-snapshots/2.1.212.md` exists with all 48 bullets (landed via #2989) |
| #2950 (filer truncated 12/48 bullets) | ⚠️ **Stays OPEN** — the 2.1.212 coverage gap is closed by this doc, but the truncation root cause in the auto-filer is unfixed and will recur on the next large release |
