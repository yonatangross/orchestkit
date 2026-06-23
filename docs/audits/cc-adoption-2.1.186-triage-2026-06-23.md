# CC 2.1.186 adoption backlog — adversarial-refute triage

**Date:** 2026-06-23
**Author:** dogfood pass (brainstorm: "properly integrate the latest CC release notes")
**Precedent:** `docs/audits/cc-adoption-2.1.178-179-backlog-triage-2026-06-18.md`
**Scope:** the 11 `cc-adoption` issues auto-filed for CC 2.1.186 (#2611–#2621), filed `2026-06-23T04:25:44Z`.

## Why this exists

The CC release pipeline (`claude-release-watch.yml` → `cc-release-watch.mjs` → `cc-triage.mjs` →
`cc-file-adoption-issues.sh`) ran end-to-end for 2.1.186 and worked mechanically:
snapshot (#2622) → 17 features extracted → 11 issues filed (gap_score ≥ 10 gate).

The problem is **precision, not plumbing.** `cc-triage` tagged **8 of 11** filed issues
`category: breaking` with `gap_score: 20` (the maximum). On adversarial-refute review, the
honest count is:

- **0** actual breaking changes for ork (the one genuine plugin-relevant "breaking" item is a
  verified no-op — see #2611).
- **1** genuine adoption opportunity (#2619).
- **6** false-positives / no-ops to close.
- **4** minor doc considerations (keep open, re-scoped low).

That is a ~91% over-score rate on the `breaking` label for this release — the same
"~60% false-positive on code-only audits" pattern recorded in project memory. The missing
pipeline layer is a **verify gate** between extract and file.

## Per-issue verdicts

| Issue | Feature | Triage | Refute verdict | Evidence / ork surface |
|-------|---------|--------|----------------|------------------------|
| #2611 | agent_deny_rules_enforcement | breaking/20 | **CLOSE — verified no-op** | All 16 `Agent()` grants (9 distinct targets) across 11 agents already match their body delegation tables; `ork:`-prefixed single-arg ALLOW syntax (zero deny rules, zero multi-arg `Agent(x,y)` restrictions); CI guard `tests/agents/test-agent-delegation-docs.sh` already enforces it. ork was authored as if the grant were enforced. |
| #2612 | tools_flag_cold_launch_gate | breaking/20 | **CLOSE — false-positive** | CC-internal `--tools` flag-load fix at cold launch. No ork surface; ork does not gate tools this way. |
| #2613 | chrome_tab_group_isolation | breaking/20 | **CLOSE — false-positive** | Pure end-user CC browser bug fix. ork does not configure CC's Chrome tab-group isolation. |
| #2616 | review_pr_engine_unified | breaking/20 | **CLOSE — false-positive** | CC built-in `/review` now uses `code-review medium`. ork ships its own `review-pr` skill; no behavior ork must change. |
| #2617 | max_retries_cap_15 | breaking/20 | **CLOSE — false-positive** | ork references `CLAUDE_CODE_MAX_RETRIES` **nowhere** (grep: only in the triage artifacts themselves). End-user env cap. |
| #2621 | aws_refresh_credentials_login | new_command/15 | **CLOSE — niche, no surface** | `/login` AWS Bedrock refresh option. No ork surface; niche to AWS-auth users. |
| #2619 | mcp_login_logout | new_command/15 | **KEEP — genuine adoption** | `claude mcp login/logout <name>` (+ `--no-browser` SSH). ork ships MCP servers; document the non-interactive auth path in `configure` (the CLI-usage skill); `mcp-patterns` gets a one-line cross-ref only (it is server-building, not CLI auth). Relevant to the 1Password/interactive-auth constraint. |
| #2614 | respond_to_bash_commands_default | breaking/20 | **DOWNSCORE — optional doc** | CC default change for `!` bash. ork does not set `respondToBashCommands` (grep clean). Not breaking; optional mention in `update-config`/`configure`. |
| #2615 | background_subagent_perm_prompts | breaking/20 | **DOWNSCORE — opportunity** | Background subagents now surface perm prompts instead of auto-deny. An *improvement* for ork's background agents, not breaking. Low-pri note in `agent-orchestration`. |
| #2618 | workflow_schema_validation_abort | breaking/20 | **DOWNSCORE — awareness** | `Workflow agent({schema})` aborts after 5 validation failures (was: loop forever). Robustness, not breaking. Awareness note for Workflow-using skills. |
| #2620 | workflows_status_filter | new_command/15 | **DOWNSCORE — optional doc** | `/workflows` detail view `f`-to-filter. End-user UX; optional mention only. |

## Disposition summary

```
CLOSE (false-positive / verified no-op):  #2611 #2612 #2613 #2616 #2617 #2621   (6)
KEEP  (genuine adoption):                 #2619                                  (1)
DOWNSCORE (minor / optional doc, open):   #2614 #2615 #2618 #2620                (4)
```

## Root cause + durable fix

`cc-triage.mjs` extracts and gap-scores changelog bullets but has **no plugin-relevance
discriminator** — it defaults end-user bug-fixes to `breaking/20`. The recurring manual
adversarial-refute pass (this doc, and the 2.1.178/179 precedent) should become a pipeline
stage:

1. **Token-free plugin-relevance prefilter** before scoring — match bullets against ork's
   actual surfaces (hooks events, skill/agent frontmatter, settings keys, MCP, Agent()
   syntax). End-user-only categories (UI polish, stream fixes, browser isolation) cap at a
   low score and are never filed as `breaking`.
2. **OR an adversarial-refute verify step** that down-scores items no ork surface can act on.

Either makes the next release file ~2 issues instead of 11.

## Note on `latest_known`

`shared/cc-support.json` keeps `latest_known: 2.1.183` by a **deliberate** `manual_override`
(strict bump, expires 2026-09-20) — this is policy, not lag. Detection correctly runs ahead
of it (snapshots 2.1.185/186 exist). When the override expires, the floor-bump cascade
resumes and `latest_known` advances to cover 2.1.186.
