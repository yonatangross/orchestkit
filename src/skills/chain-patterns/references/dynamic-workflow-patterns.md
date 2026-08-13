# Dynamic Workflow Patterns

Reference for CC Dynamic Workflows (the `Workflow` tool / `ultracode`, shipped 2026-05-28).
A workflow is a harness Claude writes on the fly — a JS file that spawns and coordinates
subagents with per-agent isolation, model choice, and isolation level. This maps the **6
patterns** to ork's own flows so the right shape is reached for deliberately, picks the
right model tier per agent (#2233), and resolves the "use directly vs ship-as-template"
question.

> **Not a wrapper.** Per [[feedback_workflows_use_dont_wrap]], ork does NOT wrap workflows
> into skills as a forced fit. This is a *reference* — USE the `Workflow` tool directly for
> ork's bounded audits/sweeps. Grounded in two workflows run on 2026-06-05: the
> drift-register re-audit (caught a 60%-wrong audit) and the adversarial-verify design
> (found all 3 designs unsound on first pass).

## Parse-safety: write it as plain JS (the 3 killers)

The script is a **plain-JS string**, and agent prompts are full of the exact characters JS uses
to delimit/interpolate strings — so prompt content fights the syntax. Almost every "Invalid
workflow script / Unexpected token (L:C)" is one of three collisions; the `(line:col)` in the
error points at the exact character.

```text
1. BACKTICK COLLISION  (the #1 cause)
   BAD   agent(`review the `op inject` command`)   <- 2nd backtick CLOSES the template early
   OK    agent('review the op inject command')     <- single-quote (or .join for multi-line)
   Any inline-code backtick inside a backtick-delimited prompt detonates the parse.

2. ${...} INTERPOLATION
   BAD   agent(`set ${CLAUDE_PROJECT_DIR}/x`)       <- JS evaluates CLAUDE_PROJECT_DIR as a var
   OK    agent('set $CLAUDE_PROJECT_DIR/x')         <- bare $VAR is plain text

3. TYPESCRIPT MUSCLE MEMORY
   BAD   const xs: string[] = []   interface Foo {}   fn<T>()   as const
   OK    const xs = []                              <- no type annotations, ever
```

**The rule that kills all three:** inside any `agent()` / `log()` string — no backticks, no
`${...}`, no TS syntax. For multi-line prompts, concatenate single-quoted lines instead of
reaching for a backtick template:

```js
agent(['Do X.', 'Then Y.', 'Return JSON only.'].join('\n'))   // backtick-free, immune
```

**When it keeps parse-failing:** stop re-sending the whole 180-line blob and guessing. Every
`Workflow` run persists its script to a file — `Write`/`Edit` that `.js` (where a stray backtick
is visible) and re-run with `Workflow({scriptPath})`. Two more parse traps: `meta` must be a
pure literal (no vars/calls/spreads), and `Date.now()` / `Math.random()` / argless `new Date()`
throw at runtime — pass timestamps in via `args`.

> **Fixed in CC 2.1.202.** Two long-standing traps here got fixed: (1) workflow scripts with unicode quote escapes (smart/curly quotes) are no longer corrupted *before* parsing, so a smart quote pasted into a prompt string no longer detonates the parse silently; and (2) parse errors now point at the offending line instead of always blaming TypeScript. Practically: the `(line:col)` is now trustworthy — read that exact line — and a genuine "TypeScript" mention in the error is now a real signal (trap #3 above), not the default scapegoat.

## Fan-out cost and concurrency (CC >= 2.1.229)

Two things a fan-out author has to know, both new in 2.1.229 and neither visible from
the script:

- **Same-prefix siblings are staggered so later ones hit the prompt cache.** In a
  fan-out where every agent shares a long prompt prefix, siblings launched at the same
  instant each re-paid that prefix. CC now staggers them so subsequent agents read the
  cached prefix instead. This is free money for ork's widest fan-outs
  (`audit-full/workflows/audit-full-mapreduce.js`, `skill-fitness`) and needs no script
  change. `CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS=0` disables it.
  Practical consequence: **put the shared context first and the per-item text last** in
  a fan-out prompt, so there is a long common prefix for the stagger to exploit.
- **Concurrency now respects the container's CPU limit.** Before 2.1.229, a workflow
  running inside a CPU-limited container sized its concurrency from the *host* core
  count, over-parallelizing in CI runners and Docker. On >= 2.1.229 the cgroup limit is
  read instead, so a CI fan-out runs narrower (and slower in wall-clock) than the same
  script did before. That is the correct behavior, not a regression.

## The 6 patterns → ork map

> These six are **ork's own taxonomy** for naming multi-agent shapes — not a Claude Code
> standard. CC documents the `Workflow` tool's *mechanics* (`agent()`/`parallel()`/`pipeline()`,
> `opts.model`, isolation levels); the pattern **names and the selection rule** below are ork
> conventions layered on top.

| Pattern | What it is | ork flow that uses it |
|---------|-----------|------------------------|
| **Classify-and-act** | a classifier routes work before doing it | `ci-debug` (10-pattern classifier), `errors` |
| **Fan-out-synthesize** | split → parallel agent per piece → merge (barrier) | `explore`; `audit-full` **scale tier** (committed: `audit-full/workflows/audit-full-mapreduce.js`); the drift re-audit |
| **Adversarial verification** | a separate, blind agent refutes each finding | `assess` Ph 2.5, `review-pr` Ph 4.5, `audit-full` STEP 3.5; `shared/rules/adversarial-refutation.md` |
| **Generate-and-filter** | generate N ideas → filter by rubric/verify → dedup | `brainstorm` (divergent → keep/discard) |
| **Tournament** | pairwise comparison beats absolute scoring | *gap* — `prioritization`/`competitive-analysis` use absolute scores |
| **Loop-until-done** | spawn until a stop condition (K dry rounds) | `cover` (bounded heal); `ci-sentinel` could loop-until-dry |

## Who holds the plan

The official decision table (code.claude.com/docs/en/workflows), condensed:

| | Subagents | Skills | Agent teams | Workflows |
|---|---|---|---|---|
| What it is | a worker Claude spawns | instructions Claude follows | a lead agent supervising peer sessions | a script the runtime executes |
| Who decides what runs next | Claude turn by turn | Claude following the prompt | the lead agent turn by turn | the script |
| Where intermediate results live | context window | context window | a shared task list | script variables |
| What is repeatable | the worker definition | the instructions | the team definition | the orchestration itself |
| Scale | a few delegated tasks per turn | same as subagents | a handful of long-running peers | dozens to hundreds of agents per run |
| Interruption | restarts the turn | restarts the turn | teammates keep running | resumable in the same session |

Two notes on top of the table:

- **Workflow resume is same-session only.** Exiting Claude Code starts the workflow fresh. That is exactly why chain-patterns handoff files (P2/P3) remain the cross-session resume mechanism; workflows do not supersede them.
- The one sentence worth keeping from the 2026 "graph engineering" discourse: **context does not flow between nodes unless you design the edge.** It is the same law behind the handoff-after-phase rule and the two-registry hook bug class (#959).

## Failure mode → pattern (the selection rule)

Pick the pattern that **structurally prevents** the failure your task is hitting:

| Failure mode (single-context) | Pattern that fixes it |
|-------------------------------|------------------------|
| **Goal drift** — loses fidelity to the objective over many turns | Fan-out (each agent one focused goal) |
| **Self-preferential bias** — Claude favors its own work when judging it | Adversarial verification (blind refuter) |
| **Agentic laziness** — declares done after partial progress | Loop-until-done + `/goal` hard completion |
| **Hard-to-score** — taste/ranking quality degrades at scale | Tournament (pairwise) |

## Per-agent model tiers (#2233)

A workflow picks the model per agent. Default to **inheriting the session model**; tier only
when an agent's job is genuinely cheap or expensive:

| Agent job | Tier |
|-----------|------|
| Structural greps, file reads, classification, fan-out exploration | `haiku` |
| Synthesis, adversarial judgment, design, cross-cutting reasoning | `opus` |
| Everything in between / when unsure | inherit (omit `model`) |

In `agent()`, set `opts.model`. Example from the drift re-audit (improved): the 5 structural
refuters → `haiku`, the synthesis → `opus`. Don't over-optimize — a wrong-tier cheap agent
that misses a structural dependency costs more than the tokens it saved (the version-matrix
verdict needed a careful read, not a cheap grep).

## Per-agent types (`agentType`)

Same logic for WHO runs the stage. Telemetry across 424 spawns showed workflow fan-outs were
the single biggest generic bucket (148 spawns, all default workflow subagent) while curated
specialists sat unused. In `agent()`, set `opts.agentType` when a stage has an OBVIOUS
specialist owner — and only then:

| Stage shape | agentType |
|-------------|-----------|
| Security findings: produce or adversarially verify | `ork:security-auditor` |
| Test generation / coverage-gap passes | `ork:test-generator` |
| Code-review dimensions over a diff | `ork:code-quality-reviewer` |
| Web/competitive research fan-out | `ork:web-research-analyst` |
| Cross-domain, mixed, or glue stages | omit — generic IS correct here |

Use the namespaced registry name (`ork:x`) — bare names fail to resolve at dispatch (#2371).
Committed example: `audit-full-mapreduce.js` routes its shard-audit and refute stages to
`ork:security-auditor` when `mode === "security"`, and stays generic for mixed modes.

## Use directly vs ship-as-template

The "don't wrap" memory and the article's "ship workflows as Skills" reconcile cleanly:

```
Bounded foreground task (most ork work) ........ USE the Workflow tool directly. Don't wrap.
Genuinely large-N / adversarial / repeated ..... may ship as a TEMPLATE skill (NOT a verbatim
  flow you'll run again (deep audit, swarm)       script) — prompt Claude to adapt the shape.
```

Decision test: would a regular Claude Code session finish this in five minutes? Then you don't
need a workflow at all (the article's own first warning). Reach for one only for the long,
parallel, structured, or adversarial classes above.

**Committed templates in ork** (run via `Workflow({scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/workflows/<file>"})`):

| Template | Skill | Shape |
|----------|-------|-------|
| `workflows/skill-fitness.js` | `bare-eval` | fan-out one isolated agent per skill → ranked fitness scorecard |
| `workflows/audit-full-mapreduce.js` | `audit-full` | shard → per-shard audit → cross-shard synthesis → adversarial refute (the scale tier for repos that exceed 1M context) |

Both are TEMPLATES — pass `args` (skills / shards) per run; don't treat them as fixed scripts.

### Plugin-shipped workflows MUST be `.js` — `.mjs` is silently dropped

ork ships these three through the plugin `workflows/` directory, so they also resolve by name as
`/ork:skill-fitness`, `/ork:audit-full-mapreduce`, `/ork:heal-loop` (namespaced `${plugin}:${meta.name}`).
That only works because the files end in `.js`.

The plugin workflow scanner filters on `name.endsWith(".js")` and returns `null` for anything else
with **no warning at all**. A `.mjs` file is dropped before its `meta` is ever parsed, so the
workflow simply does not exist: `Workflow({name})` answers `not found`, and nothing anywhere says
why. Verified against the installed CC binary and reproduced live — renaming one shipped `.mjs` to
`.js` and reloading made it resolve immediately.

The sibling user/project loader treats the same mistake very differently: it counts
`/\.(mjs|cjs|ts)$/` as `nearMissExt` and reports it in `workflow_discover` telemetry. So the
extension is a known authoring trap upstream; the plugin path just doesn't tell you.

Two consequences worth remembering:
- Name a new plugin workflow `.js`, never `.mjs`, whatever your editor suggests.
- Absence of an error is not evidence of loading. Confirm a plugin workflow registered by
  calling it by name, not by seeing the file in `plugins/<name>/workflows/`.

## Untrusted input → quarantine

Any workflow/skill that reads untrusted content (GitHub issue bodies, PR descriptions, CI
logs, scraped pages) must **quarantine** it: read-only reader agents with no high-privilege
tools extract structured facts; a separate actor agent — never exposed to the raw text —
acts. See `shared/rules/untrusted-input-quarantine.md` (#2232).

## Cost discipline

Workflows often use 5–10× the tokens. Set an explicit budget in the prompt ("use 10k
tokens"); pair loop patterns with `/goal` for hard completion; keep the bracket/stop-condition
in deterministic loop code, not in an agent's context.
