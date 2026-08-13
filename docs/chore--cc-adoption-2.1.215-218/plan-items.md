# CC 2.1.215-218 adoption + orchestration-model correction

Slug `cc-adoption-2.1.215-218` · created 2026-07-23 · living plan v2.
Composite 4.3 against a target of 8.0.

This is the executable half of the audit: four waves, 16 items, each with a done-when evidence check. Statuses live in the plan file's own JSON state and are flipped in place as work lands; the changelog is append-only and items are never deleted, only moved to dropped.

## W0 — Runtime correctness at CC 2.1.218 (planned, 6 items)

### W0.1 Declare background: on the 39 model-invocable fork skills

- Impact 9.0 · effort 2h · risk med · owner agent · status planned
- **Before:** 78 of 114 skills carry frontmatter context: fork; ZERO declare background:. CC 2.1.218 changed fork skills to run in the background by default.
- **After:** Every fork skill states background: true or false explicitly. Interactive skills (assess, cover, expect, explore, fix-issue, review-pr, verify, design-ship) pin background: false.
- **Why:** Verbatim 2.1.218 changelog: 'Changed skills with context: fork to run in the background by default; opt out per skill with background: false'. Split verified by frontmatter parse, not grep: 39 fork skills are disable-model-invocation:true (slash-only, observed running inline this session) and 39 are still model-invocable. The 39 model-invocable ones are the true risk set. Runtime symptom is NOT yet empirically observed on the slash path, so this is a confirmed config gap with an unconfirmed runtime symptom.
- **How it goes wrong:** Blanket-setting background:false on all 78 defeats the point of fork for genuine report-producers.
- **Containment:** Decide per skill on whether its result is read by a human in-turn. Start with the 39-item model-invocable set.
- **Done when:** for f in src/skills/*/SKILL.md; do awk 'frontmatter has context:fork AND lacks background:' ; done | wc -l  ==  0

### W0.2 Fix stop/security-scan-aggregator: p95 50s against a declared 10s timeout

- Impact 9.0 · effort 3h · risk med · owner agent · status planned
- **Before:** 765 calls, mean 19,149ms, p95 50,122ms, max 159,640ms, 14,649s total = 87% of ALL hook wall time. hooks.json declares timeout: 10 (seconds).
- **After:** Either the handler finishes inside its declared budget, or the budget is raised to the real distribution and the work moves off the Stop path.
- **Why:** Measured from 202,229 parsed records in ~/.claude/analytics/hook-timing.jsonl (207MB), 0 parse failures. Independently reproduced; matches the sweep agent's sample within rounding. This is a 5x-16x overrun of the hook's own declared timeout, on the Stop event, so it is paid at the end of every session.
- **How it goes wrong:** Raising the timeout without reducing work just legitimises a 50-second stall.
- **Containment:** Profile which scanner dominates before touching the budget; the aggregator fans out to several.
- **Done when:** python3 scratchpad/verify_hooks.py shows p95 under the declared timeout for stop/security-scan-aggregator

### W0.3 Reconcile 13 Agent(ork:*) grants with nested-spawn now OFF by default

- Impact 8.0 · effort 2h · risk med · owner agent · status planned
- **Before:** CC 2.1.217: 'Changed subagents to no longer spawn nested subagents by default; set CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH to allow deeper nesting.' ork has 13 Agent(ork:*) grants across 11 agents and ZERO references to that env var anywhere in src/ or manifests/.
- **After:** Either the skills that rely on nested delegation set the depth env var and own the cost, or the grants and the prose that assumes nesting are removed in favour of a flat lead-driven fan-out.
- **Why:** chain-patterns Pattern 9 documents nested delegation up to 3 levels. That capability is now off unless explicitly enabled, so the grants are inert and the documented pattern silently degrades to a no-op.
- **How it goes wrong:** Enabling deep nesting globally reintroduces unbounded fan-out that 2.1.217 capped for a reason (default concurrent-subagent cap is now 20).
- **Containment:** ork already caps its own fan-out at 6-12, below the new ceiling; prefer flat fan-out over raising depth.
- **Done when:** grep -rn CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH src/ returns a deliberate setting, or the Agent(ork:*) grants are gone

### W0.4 Fix two deny rules that can never match

- Impact 7.0 · effort 30min · risk low · owner human · status planned
- **Before:** src/settings/ork.settings.json:40-41 deny Bash(find:*-delete*) and Bash(find:*-fprint*). CC matches the literal command string, and no real invocation begins with 'find:'. So 'find . -name *.tmp -delete' is NOT blocked.
- **After:** Rules match real command shapes, or are removed so the security posture is honest about what it does not cover.
- **Why:** Two more at lines 50-51 are exact-literal-only and near-unmatchable: Bash(> /dev/sd*) depends on redirect position, and the fork-bomb literal misses on any whitespace variant. These are silent no-ops presenting as protection.
- **How it goes wrong:** Rewriting them too broadly starts denying legitimate find invocations.
- **Containment:** These are deny rules on a posture layer, not a containment boundary; ork documents that distinction already.
- **Done when:** a test asserts the deny rule matches a realistic 'find . -delete' command string

### W0.5 Fix the /ork:feedback instruction users cannot follow

- Impact 6.0 · effort 15min · risk low · owner human · status planned
- **Before:** src/hooks/src/lifecycle/analytics-consent-check.ts:109 and :124 tell users to run '/ork:feedback opt-in'. The feedback skill is user-invocable: false AND disable-model-invocation: true, so that command does not exist.
- **After:** Either the skill becomes user-invocable, or the hook text names a real path.
- **Why:** This is user-facing: the consent prompt is shipped, shown, and the remedy it names is unreachable.
- **How it goes wrong:** Flipping user-invocable adds to the per-session token ratchet that PR 3056 was reverted over.
- **Containment:** Changing the hook string costs zero tokens; prefer that unless the skill is genuinely wanted as a command.
- **Done when:** the string in analytics-consent-check.ts names a command that resolves, verified by /ork:help listing it

### W0.6 Advance latest_known 2.1.214 to 2.1.218 with a triage doc

- Impact 6.0 · effort 1h · risk low · owner agent · status planned
- **Before:** shared/cc-support.json latest_known is 2.1.214; the CC actually running is 2.1.218. Four releases untriaged, and the strict floor pin at 2.1.206 expires 2026-09-20.
- **After:** latest_known advanced to 2.1.218 with a per-range triage doc under docs/audits/, matching the established pattern.
- **Why:** Real adoptions in range: 2.1.218 fork-background default (W0.1), 2.1.217 nested-spawn default off and the 20-subagent concurrency cap (W0.3). Cleared as no-ops: agent names with ':' (all 36 ork agents use bare names), user_config exposure (zero), path-scoped permission rules (none).
- **How it goes wrong:** Advancing latest_known without the triage doc breaks the audit trail every prior bump maintained.
- **Containment:** The floor stays pinned at 2.1.206; only latest_known moves.
- **Done when:** docs/audits/cc-adoption-2.1.215-218-triage-2026-07-23.md exists and shared/cc-support.json reads 2.1.218

## W1 — Guardrails that would have caught these (planned, 3 items)

### W1.1 Add a tool-name allowlist validator

- Impact 8.5 · effort 2h · risk low · owner agent · status planned
- **Before:** tests/agents/ has 15 validators and none checks a declared tool name against a known vocabulary. This is why MultiEdit survived: it is granted in 5 agents and codified as real in tool-categories.ts:49, test-agent-model-tool-correlation.sh:75, and static-analysis.sh:201.
- **After:** One validator fails CI on any tools: entry not in a maintained vocabulary, so the next hard-removal is caught the day it lands.
- **Why:** Highest-leverage item in the plan: it converts a recurring class into a one-time fix. Every other dead-tool finding here is a symptom of its absence.
- **How it goes wrong:** A hand-maintained vocabulary drifts and starts failing on newly-added real tools.
- **Containment:** Source the vocabulary from a single file that the CC-adoption sweep already updates each release.
- **Done when:** npm run test:agents fails when a bogus tool name is added to any agent frontmatter

### W1.2 Guard agent-frontmatter hook IDs the way SKILL.md IDs are guarded

- Impact 7.5 · effort 1.5h · risk low · owner agent · status planned
- **Before:** skill-frontmatter-hooks-invariant.test.ts scans SKILL.md only, and only IDs prefixed 'skill/'. tests/agents/test-hook-paths.sh:70-72 verifies run-hook.mjs exists and is executable, never that the id argument resolves to a registered handler. 13 agent-side hook IDs are unguarded.
- **After:** One invariant test covers all three dispatch surfaces: hooks.json, agent frontmatter, skill frontmatter.
- **Why:** The registry is 217 entries across three surfaces (150 + 45 + 22), not just hooks.json. An xref checking only hooks.json against the entries map produces 91 false positives, which is what the sweep agent hit and corrected.
- **How it goes wrong:** A three-surface xref is easy to write in a way that re-introduces those 91 false positives.
- **Containment:** scratchpad/final_xref.py already implements the correct three-surface join; port it.
- **Done when:** the invariant test fails when an agent declares a hook id with no registered handler

### W1.3 Enforce the 500-line SKILL.md limit in CI

- Impact 5.0 · effort 30min · risk low · owner agent · status planned
- **Before:** The rule is honour-system. Three skills drifted past it: implement 517, cover 509, brainstorm 504.
- **After:** A test fails past 500 lines.
- **Why:** All three offenders are also top-5 stale-CC-prose offenders, so W3.1 alone puts each back under the limit. Sequence W3.1 first, then turn the gate on.
- **How it goes wrong:** Turning the gate on before W3.1 lands blocks CI on three known files.
- **Containment:** Land W3.1 first; this item depends on it.
- **Done when:** npm run test:skills fails when a SKILL.md exceeds 500 lines

## W2 — Orchestration-model correction (planned, 3 items)

### W2.1 Effort-tier the five most expensive skills

- Impact 8.0 · effort 4h · risk med · owner agent · status planned
- **Before:** Only 4 of 114 skills read CLAUDE_EFFORT (assess, cover, explore, help). The five heaviest, implement 517L, review-pr 486L, verify 469L, brainstorm 504L, fix-issue 479L, have zero effort scaling and always run full multi-agent cost.
- **After:** Each reads CLAUDE_EFFORT and scales AGENT COUNT, not prose: low runs 1-2 agents, high runs the full panel.
- **Why:** cover already implements this correctly; copy its pattern rather than inventing a second one. The dial exists in CC and ork is not turning it.
- **How it goes wrong:** Scaling the prose instead of the fan-out saves nothing; the cost is in the agents.
- **Containment:** Gate on agent count only; leave the phase structure identical across tiers.
- **Done when:** grep -l CLAUDE_EFFORT across the five skills returns all five, and each gates a spawn count

### W2.2 Give background+Write+worktree agents a merge contract

- Impact 8.0 · effort 3h · risk high · owner human · status planned
- **Before:** 7 agents are background: true AND hold Write/Edit AND isolation: worktree: accessibility-specialist, data-pipeline-engineer, eval-runner, frontend-performance-engineer, monitoring-engineer, python-performance-engineer, release-engineer.
- **After:** No agent both mutates and runs backgrounded in an isolated worktree unless the spawning skill explicitly merges the branch back.
- **Why:** This is precisely the stranding failure mode already written down in .claude/rules/usage-analytics-hardening.md: ExitWorktree(action=keep) preserves the branch but does not merge it. release-engineer is the sharpest case, cutting a release into a worktree the operator never sees.
- **How it goes wrong:** Dropping background: from all 7 serialises work that legitimately runs in parallel.
- **Containment:** Prefer adding the merge step in the spawning skill over removing background from the agent.
- **Done when:** a test asserts no agent has background:true AND write-capable tools AND isolation:worktree without a documented merge-back

### W2.3 Wire the two refuter agents that prose already promises

- Impact 5.5 · effort 1h · risk low · owner agent · status planned
- **Before:** review-pr/references/adversarial-refutation.md:16 names accessibility-specialist and frontend-performance-engineer as refuters, but neither has a concrete subagent_type spawn anywhere.
- **After:** Both are spawned from review-pr's refutation lane, matching the documented behaviour.
- **Why:** Deliberately scoped to 2 of the 16 never-spawned agents. The other 14 are judged on demand, not on utilisation.
- **How it goes wrong:** Treating this as the start of a wire-everything campaign.
- **Containment:** Two agents only; the discard list records why the rest are out.
- **Done when:** grep subagent_type in review-pr returns concrete spawns for both agents

## W3 — Hygiene and token reclaim (planned, 4 items)

### W3.1 Strip 433 below-floor CC version mentions from skill bodies

- Impact 7.0 · effort 4h · risk low · owner agent · status planned
- **Before:** 433 mentions of CC versions below the 2.1.206 floor across 63 of 114 SKILL.md files; 1,566 including references/. Worst: setup 31, implement 29, configure 29, brainstorm 27, help 21.
- **After:** Every 'CC 2.1.NNN+' gate below 206 is deleted and its guidance stated unconditionally.
- **Why:** Every such gate is unconditionally true at the floor, so the conditional prose is pure token cost, concentrated in the largest and most frequently loaded skills. This also drags implement, cover and brainstorm back under the 500-line limit, unblocking W1.3.
- **How it goes wrong:** A blind regex strip removes version notes that are still load-bearing above the floor.
- **Containment:** Only touch mentions strictly below 2.1.206; leave everything at or above the floor alone.
- **Done when:** the below-floor counter script reports 0 mentions under 2.1.206 in SKILL.md bodies

### W3.2 Remove the dead MultiEdit tool from 5 agents and 3 infra files

- Impact 6.0 · effort 45min · risk low · owner agent · status planned
- **Before:** MultiEdit is granted in tools: by backend-system-architect:16, design-system-architect:15, eval-runner:31, frontend-ui-developer:15, python-performance-engineer:15, and treated as real in tool-categories.ts:49, test-agent-model-tool-correlation.sh:75, static-analysis.sh:201. It is in neither the live nor the deferred tool surface.
- **After:** MultiEdit is gone from grants and from infra; Edit with replace_all is the replacement.
- **Why:** The 7 appearances under disallowedTools are harmless (denying a nonexistent tool is a no-op) but should go with the same pass. Do this AFTER W1.1 so the new validator proves the removal is complete.
- **How it goes wrong:** Removing it from tool-categories.ts without checking the hook logic that reads file_edit categories.
- **Containment:** W1.1's validator is the completeness check.
- **Done when:** grep -rn MultiEdit src/ returns nothing outside changelog history

### W3.3 Deduplicate lifecycle/webhook-forwarder, registered 38 times

- Impact 4.5 · effort 1h · risk low · owner agent · status planned
- **Before:** webhook-forwarder appears 38 times in hooks.json, once per matcher group across 29 events, all dispatching the identical handler. 20,705 fires, 511s total.
- **After:** One registration per event that genuinely needs it, or a single wildcard registration.
- **Why:** Second-highest call count in the timing data. Not a correctness bug; a maintenance and cost item.
- **How it goes wrong:** Collapsing to a wildcard changes which events the forwarder actually observes.
- **Containment:** Compare the fired-event distribution before and after.
- **Done when:** hooks.json contains fewer webhook-forwarder entries and the fired-event set is unchanged

### W3.4 Clear doc drift and the one genuinely dead skill

- Impact 3.5 · effort 1h · risk low · owner human · status planned
- **Before:** src/hooks/README.md:32 claims CwdChanged and FileChanged are deliberately unhooked; both are wired today. entries/notification.ts:11,22 carry dangling MessageDisplay comments. src/skills/upgrade-assessment/SKILL.md (168 lines) has no invocation path at all. cc-prompt-cache-guide.md:50 documents a hook id, skill/standards-loader, that does not exist.
- **After:** README matches reality, dangling comments removed, upgrade-assessment either wired or deleted, the stale hook id corrected to skill/implement-standards-loader.
- **Why:** MessageDisplay is worth a re-check rather than a deletion: the observer was built and reverted same-day because claude plugin validate rejects hooks.MessageDisplay as an invalid manifest key. That is a CC-side schema bug, not an ork decision.
- **How it goes wrong:** Deleting upgrade-assessment if it is actually referenced from generated docs.
- **Containment:** Its only inbound references are a generated mdx and an eval fixture list, neither an invocation path.
- **Done when:** README claims match hooks.json, and upgrade-assessment is either deleted or reachable

## Deliberately discarded

- **Set background: false on all 78 fork skills** — 39 are disable-model-invocation:true and were observed running inline this session. Blanket-setting defeats fork for genuine report-producers. Scoped to the 39 model-invocable ones.
- **Fix review-pr and explore having zero agent spawns** — REFUTED on verification. The sweep stopped at references/ and missed rules/. review-pr has 21 subagent_type hits, explore has 22. Not a gap.
- **Wire all 16 never-spawned agents into hot skills** — Utilisation theatre. Dormancy is only a defect if the work exists and goes to a worse agent. Kept only the 2 that prose already promises as refuters.
- **Fix agent names containing ':' for CC 2.1.218** — Zero exposure. All 36 ork agents use bare names like backend-system-architect.
- **Fix the 'Spawn all four in ONE message' instruction in security-auditor** — Downgraded on reading lines 85-92: the four are npm audit, pip-audit and a secrets grep, i.e. parallel Bash calls, not agent spawns.
- **Remove the 142 declared-but-unreferenced agent skills** — Real token cost per spawn but no correctness impact; deferred below the runtime-correctness and guardrail waves.

## Research that shaped the plan

- **2.1.218 changes fork-skill scheduling** — Verbatim: 'Changed skills with context: fork to run in the background by default; opt out per skill with background: false'. Re-fetched independently after the first agent's summary proved incomplete. (source: https://code.claude.com/docs/en/changelog)
- **2.1.217 turns nested subagent spawning off by default** — 'Changed subagents to no longer spawn nested subagents by default; set CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH to allow deeper nesting.' Also adds a 20-subagent concurrency cap. The first triage agent compressed this release to 'multiple internal bug fixes' and missed both. (source: https://code.claude.com/docs/en/changelog)
- **Hook timing is measured, not estimated** — 202,229 records parsed from a 207MB hook-timing.jsonl with 0 parse failures. stop/security-scan-aggregator is 87% of all hook wall time at p95 50,122ms against a declared 10s timeout.
- **The hook registry has three dispatch surfaces** — 150 hooks.json + 45 agent frontmatter + 22 skill frontmatter = 217. An xref checking only hooks.json against the entries map yields 91 false positives. Dead-dispatch came back genuinely clean in both directions once joined correctly.
- **Counts corrected three times during the sweep** — 114 skills (not 116), 36 real agents (not 37; README.md is not an agent), 9 skills lacking allowed-tools (not 11). bin/validate-counts.sh passes and manifests agree.

## Changelog

- 2026-07-23: v1 authored from a 4-agent sweep of agents, skills, hooks and the 2.1.215-218 changelog. Every decision-bearing claim re-verified locally before entering the plan; 2 findings refuted and moved to discards.
