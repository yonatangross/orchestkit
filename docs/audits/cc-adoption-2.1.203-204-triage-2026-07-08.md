# CC 2.1.203 + 2.1.204 Adoption Triage — 2026-07-08

Manual verification of the 5 auto-filed cc-triage gap issues for 2.1.203 (#2784-#2788)
plus the featureless 2.1.204 release, via 5 parallel Explore agents (one per gap cluster)
with a devil's-advocate synthesis pass. Branch: `chore/cc-2.1.203-204-adoption`.

- 2.1.203: 37 changelog bullets, 5 features auto-extracted by cc-triage
- 2.1.204: 1 bullet, `featureless: true` (no issues filed)
- `latest_known` advanced 2.1.202 → 2.1.204 via `scripts/stamp-cc-support.mjs`;
  floor/latest stay frozen at 2.1.183 per the 2026-06-20 manual_override
- `cc-adoption-gaps.json` needs NO edit: both entries carry `issues_filed_at`,
  so the next cc-watch run auto-prunes them (`cc-release-watch.mjs` carry-forward filter)

## Verdicts

| Gap | Feature | Verdict | Surface |
|---|---|---|---|
| #2785 | worktree_subagent_isolation_fix | ADOPT (accuracy repair) | 3 files, see below |
| #2787 | doctor_status_claude_warnings | ADOPT (narrow) | 2 matrix rows |
| #2786 | subagent_redelegation_reduced | ADVISORY NOTE | 1 para, chain-patterns Pattern 9 |
| #2784 | anthropic_base_url_leak_fix | NO-OP | none |
| #2788 | mcp_roots_list_changed_event | INFO ROW | 1 matrix row |
| — | 2.1.204 SessionStart headless streaming | INFO ROW | 1 matrix row |

## #2785 — the one real adoption (accuracy repair)

The 2.1.203 bullet "Fixed worktree-isolated subagents sometimes running shell commands
in the parent checkout instead of their own worktree" completes a fix ork had recorded
as FULLY closed in 2.1.154. Three files over-claimed:

1. `src/skills/doctor/references/version-compatibility.md:382` — 2.1.154 row implied the
   isolation guard was complete. **Fixed**: cross-reference to the residual leak + new
   2.1.203 row.
2. `src/skills/chain-patterns/references/worktree-agent-pattern.md:73` — "safe for
   parallel spawns … workaround superseded" attributed wholly to 2.1.154. **Fixed**: new
   2.1.203 blockquote documenting the residual leak and the 2.1.183–2.1.202 risk window.
3. `src/skills/implement/references/manual-worktree-pattern.md` — SUPERSEDED banner
   credited 2.1.154 alone; ironically its own "The bug" section (`git checkout` firing on
   the primary tree) is the exact symptom the residual leak preserved. **Fixed**: banner
   now reads "SUPERSEDED — CC 2.1.154, completed in CC 2.1.203" with the partial-fix window.

Because ork's floor (2.1.183) is below 2.1.203, the "safe now" claims were inaccurate for
the entire supported range — this is an accuracy fix, not changelog stamping.

Rest of the worktree cluster (nested-repo rejection, non-git-dir + WorktreeCreate hook,
"argument list too long" with many worktrees): no ork text warns about or works around
any of them — pure upstream fixes, NO-OP.

## #2787 — startup warnings relocation (narrow adopt)

"claude command missing or broken" warnings moved from startup to native `/doctor` +
`/status`. No ork code consumes CC startup warnings; ork's `doctor` skill validates hook
`command:` entries independently. Adopted as 2 feature-matrix rows (warnings relocation +
the LSP-plugin disuse false-positive fix — ork ships no LSP servers, unaffected either way).
The issue's claim that `doctor`/`setup`/`configure` skills are behaviorally affected
overstates: docs-only.

## #2786 — re-delegation reduced (advisory note)

CC tuned subagents to be less likely to re-delegate their ENTIRE task. Ork has no
defensive anti-re-delegation instruction to soften — chain-patterns Pattern 9 *enables*
nested delegation; its ≤3-depth rule is a cost/latency budget, not a whole-task-handoff
guard. The improved behavior is exactly what Pattern 9 already prescribes ("each level
synthesizes, never forwards"). Adopted as a one-paragraph CC-version-trail note after the
2.1.181 note in `src/skills/chain-patterns/SKILL.md`. 3 of the 5 issue-named skills
(agent-orchestration, audit-activation, explore) had zero relevant text.

## #2784 — ANTHROPIC_BASE_URL leak fix (NO-OP)

All 3 issue-named skills were keyword collisions (`401`, gateway, proxy, LiteLLM):
security-patterns hits are app-level JWT/gateway patterns; mcp-patterns hits are MCP
transport proxy/Inspector auth; agent-orchestration hits are third-party SDK docs. The
genuine `ANTHROPIC_BASE_URL` consumers (monitoring-observability dev-agent-lens,
llm-integration, configure) describe a proxy setup ork never documented the buggy drop
for. Same bug class as the 2.1.178 daemon fix (`shared/cc-snapshots/2.1.178.md:18`).
Snapshot for 2.1.203 already captured by cc-watch (#2789). Nothing to correct.

## #2788 — MCP roots/list_changed (info row)

Client-side capability CC now advertises to MCP servers (`roots/list` includes
`--add-dir` directories + `notifications/roots/list_changed`). Ork runs no persistent
MCP server that consumes roots. All 3 issue-named skills were false positives
(chain-patterns "capabilities" is ork's own server-existence probe; mcp-patterns and
mcp-visual-output have zero roots text). Adopted as 1 informational matrix row.

## 2.1.204 — SessionStart headless streaming (info row)

Hook events now stream during SessionStart hooks in headless sessions, so remote workers
are no longer idle-reaped mid-hook. Ork's 4 SessionStart hooks are fast/async
(`timeout: 5`) and never relied on the broken path; the fix passively benefits headless
`claude -p` harnesses (bare-eval, ci-sentinel). Adopted as 1 matrix row.

## Auto-filer precision (for cc-triage tuning)

9 of 14 distinct skill claims across the 5 issues were keyword false positives:

| Issue | Named skills | False | Matched on |
|---|---|---|---|
| #2784 | security-patterns, mcp-patterns, agent-orchestration | 3/3 | `401`, gateway, proxy, LiteLLM |
| #2785 | agent-orchestration, chain-patterns, swarm-migrate, security-patterns | 3/4 | `isolation` (tenant/error isolation) |
| #2786 | agent-orchestration, audit-activation, explore, brainstorm, implement | 3/5 | delegation prose absent |
| #2787 | doctor, setup, configure | 0/3* | right family, impact overstated (docs-only) |
| #2788 | mcp-patterns, mcp-visual-output, chain-patterns | 3/3 | `MCP`, `capabilities` |

*#2787 skills were plausibly named but none needed behavioral changes.

Pattern: cc-triage's `affected_skills` extraction keyword-matches skill names/tags against
changelog nouns without verifying the skill text actually documents the changed behavior.
A verification pass (grep the named skill for the specific claim before filing) would have
cut the filed surface by ~64%.

## Bullet coverage

All 37 bullets of 2.1.203 reviewed: 5 extracted by cc-triage (above); the remaining 32
are CC-internal (background-session daemon/attach fixes, `claude agents` UI, memory/CPU
regressions, PATH/env inheritance, terminal rendering, binary-size, VSCode toggle) with
no ork surface. Notable adjacent-but-no-op: login-expiry warning (auth UX),
manual-permission-mode footer badge (UI), `TaskStop`/`TaskOutput` cross-agent lookup fix
(behavior ork's task patterns already assume), left-arrow → Esc navigation change (UI).
2.1.204's single bullet covered above.
