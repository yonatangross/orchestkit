# CC 2.1.178 / 2.1.179 Adoption-Backlog Triage

**Date:** 2026-06-18 · **Against:** `main` @ release 8.49.0 · **Milestone:** CC adoption (#154)

## Why

After adopting CC 2.1.181 (#2523), eight issues remained open under the CC-adoption
milestone — seven for CC 2.1.178/2.1.179 features and one hook-contract issue (#2376).
This triage verified each against the actual codebase rather than assuming, using a
draft → **adversarial-refute** workflow (one investigator + one skeptic per issue, the
skeptic prompted to refute "already-adopted" claims). The repo has been bitten before
by code-only "X is redundant, delete it" audits that ran ~60% false-positive, so every
verdict below is backed by concrete file evidence the refuter independently re-confirmed.

## Verdicts

| Issue | Feature (CC) | Status | Disposition |
|-------|--------------|--------|-------------|
| #2483 | `Tool(param:value)` permission syntax (2.1.178) | **Adopted** | Close |
| #2482 | `disallowedTools` enforced in subagents (2.1.178) | **Adopted** | Close |
| #2480 | Workflow keyword explicit-phrase only (2.1.178) | **Adopted** | Close |
| #2478 | Nested `.claude/skills` closest-wins (2.1.178) | **Adopted** | Close |
| #2479 | Auto-mode subagent classifier (2.1.178) | **Not applicable** | Close |
| #2481 | `/bug` requires a description (2.1.178) | **Not applicable** | Close |
| #2514 | Sandbox-glob Bash-description fix (2.1.179) | **Not applicable** | Close |
| #2376 | SubagentStart payload contract (hooks) | **Not adopted** | **Defer (keep open)** |

## Already adopted — evidence

- **#2483 — `Tool(param:value)`:** documented across `src/skills/configure/references/cc-version-settings.md`
  (syntax + `Agent(model:opus)` example + JSONC deny snippet + the deliberate docs-only decision),
  `src/skills/security-patterns/references/cc-permission-model.md` §6 (syntax, `Agent(model:*)` wildcard,
  static-vs-advisory distinction), and `shared/rules/cc-native-first.md` (adversarially-verified KEEP, 2026-06-17
  subtraction pass, 0 drift removable). Both referenced hooks (`model-cost-advisor.ts`, `fable-spend-consent.ts`)
  are present and orthogonal to the static native gate. Docs-type feature, no committed-settings change by design
  (a distributed plugin must not silently constrain a user's model choice).
- **#2482 — `disallowedTools` in subagents:** `cc-version-settings.md` §"MCP `disallowedTools` Enforced in
  Subagents (2.1.178)" gives the full behavior + `disallowedTools: [mcp__*]` guidance + "no workaround retired"
  note; corroborated in `.claude/rules/agent-authoring.md`. Verified **no ork agent** uses `mcp__*` server-level
  specs in `disallowedTools` (all eight use file-tool denies only), so this pure upstream permission bugfix needs
  no frontmatter change. Gap key already cleared from `shared/cc-adoption-gaps.json`.
- **#2480 — workflow keyword explicit-phrase:** `cc-version-settings.md` §"Workflow Keyword Now Explicit-Phrase
  Only (2.1.178)" documents the narrowing; byte-identical in `plugins/ork/` (no drift). The named skills
  (chain-patterns, agent-orchestration) use "workflow" only as a noun — no trigger language that mis-fires.
- **#2478 — nested closest-wins precedence:** `cc-version-settings.md` §"Nested `.claude/skills` + Closest-Wins
  Precedence (2.1.178)" (added in #2510, mirrored into `plugins/ork/`). ork commits no `.claude/skills/` directory
  and ships skills via the plugin marketplace, so the precedence change is informational only — no packaging
  change, no contradicted resolution-order claim anywhere.

## Not applicable — evidence

- **#2479 — auto-mode subagent classifier:** upstream-only platform-safety hardening (auto-mode evaluates a
  subagent spawn through the classifier *before* launch). ork inherits it with zero code/config/frontmatter
  change; already noted as "a platform safety improvement, no frontmatter change" in `cc-version-settings.md`.
  No stale "subagents bypass the classifier" claim exists anywhere. The "breaking" label is upstream tightening,
  not an ork API break.
- **#2481 — `/bug` requires a description:** a pure upstream UX fix to Anthropic's native `/bug` command. Grep
  across `src/skills`, `src/agents`, `src/hooks`, `shared`, `tests` finds no ork surface that wraps or depends on
  it (ork's own bug-filing path is the independent `/ork:feedback bug`). Inherited, nothing to adopt.
- **#2514 — sandbox-glob Bash-description fix:** a pure upstream Linux bugfix (a `denyRead`/`allowRead` glob over a
  large directory tree was bloating the Bash tool description). ork's sandbox ships only three small literal
  `denyRead` globs (`src/settings/ork.settings.json` — `~/.aws/credentials`, `~/.ssh/*`, `~/.gnupg/*`), never a
  large tree, so it was never affected. `cc-version-settings.md` already records 2.1.179 as bugfix-only with no
  settings.

## Deferred — #2376 (SubagentStart payload contract)

Genuinely **not adopted**, but correctly **deferred** — kept open under #154. The four sub-items
(`input.prompt` dead read, `is_fork` dead read, depth registry not writing, double-fire) are harmless
fail-open dead reads; the owner re-grounded them as not worth a churn PR (2026-06-14).

Re-verification refreshed two facts the original issue predates:

- **Upstream #16424 has since closed — as a *duplicate*, not implemented.** The minimal 3-field proposal
  (`agent_id` / `agent_type` / `agent_transcript_path`, all already read by ork) explicitly deferred hierarchical
  `parent_agent_id` ("can come later if needed"). CC snapshots 2.1.179 and 2.1.181 add **no** `parent_agent_id` to
  the SubagentStart payload, so the activation trigger is **still unmet** through CC 2.1.181.
- **Code correction for the eventual fix:** the depth-registry write path in `spawn-depth.ts` is *unconditional* on
  `agent_id` (proven by `spawn-depth.test.ts:60-65`), so the absence of `agent-depth.json` is **not** a lineage
  gate. If the file is still missing after `parent_agent_id` lands, root-cause `getProjectDir()` resolution inside
  the live hook process instead.
- **Re-scope note:** CC 2.1.181 now natively enforces the 5-level depth cap on foreground subagents (#2520), which
  further lowers the value of ork's prose depth gate — reconsider the `depth>=4` warning when reactivating.

**Re-activation trigger:** CC ships `parent_agent_id` in the SubagentStart hook payload → flip the dormant
`spawn-depth` telemetry on and gate `depth>=4` in `subagent-validator.ts` (logic at ~line 378 already written)
instead of prose.

## Outcome

Seven issues closed via this PR (`closes #N`). #2376 stays open with the refined trigger recorded in a comment.
No production code changed — the 2.1.178 features were already adopted and the not-applicable ones have no ork surface.
