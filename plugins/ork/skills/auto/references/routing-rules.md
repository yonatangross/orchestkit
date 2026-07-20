# Routing Rules

Per-category parameter extraction + edge cases. Read during the Classify step to configure the target skill correctly.

## fix → /ork:fix-issue

- **Extract:** bug description (full goal), target files if named, ticket/issue `#N`, quoted error message.
- **Invoke:** `/ork:fix-issue {description or #N}`
- **Edges:** "fix the tests" is `fix` (repair broken tests), not `cover` (add new tests). "fix performance" is ambiguous → ask: debug a specific issue, or optimize a metric?

## diagnose → /ork:fix-issue (investigation-first)

- A "why…" question is a gentler entry than a fix command. Frame the plan as **observe → hypothesize → propose**, then offer to apply the fix.
- **A "why…" question is ALWAYS `diagnose`, even when it names a failure** ("why isn't the build green", "why does the API return 500", "why can't users log in"). The **question form** is what makes it `diagnose` — without one, a statement of breakage or a repair imperative is `fix` ("there's a regression in checkout", "resolve the 500 errors on /api/users").
- **Invoke:** `/ork:fix-issue {question}` with an investigation framing. ("I'll investigate first, then propose a fix — ok?")

## optimize → /goal loop (no dedicated skill)

- **Extract:** metric (latency/throughput/bundle/memory), direction (minimize for size/time/cost; maximize for score/rate), goal value + unit, target files.
- **Invoke:** compose a `/goal` loop via `/ork:prd-to-goal` → `references/recipe-library.md`. Be explicit that this is a `/goal`-driven loop, not a `/ork:experiment` skill (which doesn't exist).
- **Edges:** "make it faster" with no metric → ask what to measure (response time? build time? bundle?). Multiple metrics → pick the emphasized one, note the rest as constraints.

## cover → /ork:cover

- **Extract:** target % ("90%" → 90, "above 85" → 85), scope ("the auth module" → `src/auth/`).
- **Invoke:** `/ork:cover --target {N}`
- **Edges:** "write more tests" with no target → ask the target %. "test the new feature" is `build`/`verify` (functional tests), not `cover` (coverage %). A surface called out as **"untested"** is `cover` even with no % target ("the payments service is untested, fix that") — the "fix" there repairs a coverage gap, not a bug; ask the target % at invoke time.

## design → /ork:brainstorm

- **Extract:** topic (full goal). Deep mode if the goal says "thorough/comprehensive/deep dive" or spans multiple systems.
- **Invoke:** `/ork:brainstorm {topic}`
- **Edges:** "how should we…" is `design`, not `build`. "Design AND build…" → start `design`, offer `build` after.

## build → /ork:implement

- **Extract:** feature description, ticket ID, mode (greenfield/brownfield/refactor/bugfix).
- **Invoke:** `/ork:implement {description}`
- **Edges:** "implement the design from the brainstorm" → check for recent brainstorm state first.

## review → /ork:review-pr

- **Extract:** PR/MR number (`#123` → 123), scope filter if named.
- **Invoke:** `/ork:review-pr {number or branch}`
- **Edges:** "review my code" with no PR → ask which PR/branch. "review the design" is `design`, not `review`.

## verify → /ork:verify

- **Extract:** checks (tests/lint/typecheck/all), scope.
- **Invoke:** `/ork:verify`
- **Edges:** "make sure it works" → all checks. "check tests pass" → tests-focused.

## improve-skill → skill-evolution / holdout gate

- **Extract:** which `SKILL.md`, quality metric (else task-completion against test cases).
- **Invoke:** the champion/challenger **holdout-promotion gate** (`/ork:assess` evals + `evolution-engine`). Requires a benchmark + holdout set to exist first — if missing, help the user define 5–10 cases before looping.
- **Edges:** "optimize my prompt" (not a skill file) → route to `optimize` with the prompt as the target. **When the improvement target IS a skill or agent** — a SKILL.md, a named skill, an agent prompt — it is `improve-skill` regardless of the verb: "optimize the prompt for the security-auditor skill" and "make the brainstorm SKILL.md produce better ideas" are both `improve-skill`, not `optimize`/`design`.

## Model weight (second, orthogonal dimension)

Intent answers **who does the work**. Weight answers **how expensive that worker should be**. Both are decided in the same Classify pass. Weight never changes the intent, and intent never fixes the weight: a route is `{intent} @ {weight}`.

The tiers are the ones already declared in `src/agents/*.md` frontmatter. There is no separate router taxonomy and no new vocabulary to learn (36 agents):

| tier | count | representative agents |
|---|---|---|
| `haiku` | 7 | git-operations-engineer, release-engineer, deployment-manager, monitoring-engineer, eval-runner, data-pipeline-engineer, market-intelligence |
| `sonnet` | 10 | debug-investigator, database-engineer, frontend-performance-engineer, accessibility-specialist, web-research-analyst, llm-integrator |
| `opus` | 6 | security-auditor, security-layer-auditor, ai-safety-auditor, system-design-reviewer, event-driven-architect, workflow-architect |
| `inherit` | 13 | test-generator, code-quality-reviewer, backend-system-architect, ci-cd-engineer, infrastructure-architect (these adopt the caller's model) |

### The rubric (one pass, decidable)

Read the goal once against both signal columns:

| dimension | light signal | heavy signal |
|---|---|---|
| output shape | deterministic, checkable by a command | judgment call, no single correct answer |
| blast radius | one file or one service | cross-cutting, multi-module, public API or schema |
| adversary | none modelled | an attacker, a race, or a hostile reviewer is modelled |
| specification | fully specified in the goal itself | ambiguous, needs interpretation |
| work type | mechanical or IO-bound (fetch, run, format, move, tag, publish) | architecture, security, safety, protocol or contract design |
| reversibility | trivially revertible | migration, data loss, or prod-facing |

**Resolution is asymmetric on purpose:**

1. **ANY** heavy signal makes it **Heavy** (`opus` tier).
2. **Light** requires **ALL** light signals (`haiku` tier).
3. Everything else is **Standard** (`sonnet` tier). This is the default, and the correct answer for most work.

The asymmetry is not laziness. Under-powering a security review or a schema migration produces a confident wrong answer that nobody catches; over-powering a file rename only wastes money. Bias the rare direction toward the recoverable failure.

### Weight is per leg, not per route

A single route often fans out into legs of different weight. Classify the legs, not the headline. `/ork:review-pr` on a PR touching auth is a Heavy security leg (`security-auditor`, opus) plus a Standard quality leg plus a Light lint leg. Do not promote the whole route to Heavy because one leg is.

### Default weight per intent

Defaults, not verdicts. The rubric overrides any row here when the goal carries a heavy signal.

| intent | default | promote to Heavy when | demote to Light when |
|---|---|---|---|
| fix | Standard | the bug is a security or data-integrity defect | a one-line, single-file, already-diagnosed repair |
| diagnose | Standard | root cause spans services or is adversarial | reading a log or reproducing a named error |
| optimize | Standard | the optimization changes architecture | tuning one measured constant |
| cover | Standard | tests must model an attacker or a race | mechanical test scaffolding for existing pure functions |
| design | Standard | architecture, protocol, or cross-cutting design | never (design is judgment by definition) |
| build | Standard | new public API, schema, or auth surface | single-file change fully specified in the goal |
| review | Standard | security, auth, crypto, or safety in scope | style or formatting only |
| verify | Standard | verifying a security-critical claim | running the existing checks and reporting the result |
| improve-skill | Standard | rewriting the evaluation contract itself | executing an existing benchmark (`eval-runner`, haiku) |

### Premium spend needs explicit consent

Routing **down** is silent. Spending less is never a decision the user has to approve.

Routing **up to Heavy** is premium spend (`opus` / `fable`) and MUST be surfaced in the confirm line, naming the heavy signal that triggered it. Never upgrade silently, never mid-handoff, never inside a spawned agent that the user did not see. If the user declines the upgrade, run Standard and state plainly which check is being weakened.

### Composition with the spend cap (they are different mechanisms)

```
routing        (ex ante,  per leg)     -> SELECTS the tier
team-size-gate (ex post,  per session) -> COUNTS what was selected, caps it
```

`src/hooks/src/pretool/task/team-size-gate.ts` is a **backstop, not a selector**. It reads `toolInput.model` exactly once, read-only, to classify premium vs non-premium, then increments a session ledger and warns or denies past `ORK_TEAM_OPUS_MAX` (default 8). It has no model-override surface and is ADVISORY by default, so its "Use sonnet/haiku" message is advice to a human that it cannot itself enact. Routing is what enacts it.

Rules that keep the two composed rather than duplicated:

- The router never reads, sets, or suggests raising `ORK_TEAM_OPUS_MAX`. The cap is the user's budget, not a router variable.
- A gate denial is **not** a re-route trigger. Do not relabel a Heavy leg as Standard to slip under the cap. Report the denial and let the user choose.
- The router does not re-implement counting. It has no session ledger and makes no claim about remaining budget.

### Honest limits of this dimension

Tier is bound **statically to agent identity** in each agent's frontmatter, and the spawn happens downstream in whichever skill the router handed off to. The router therefore has exactly two levers, and neither is a model override:

1. **Selection**: which skill and which agent gets the work (choosing `eval-runner` over a sonnet agent is a real tier decision).
2. **The caller's model**: the 13 `inherit` agents (36% of the catalog) adopt it, so the weight the router hands off at propagates to that bloc.

Everything else is a documented hint carried into the handoff. Per the no-bypass guardrail, the router does not override a target skill's own agent selection.

## Disambiguation (when multiple categories match)

1. Explicit verb wins. "Fix the slow query" → `fix`.
2. Metric + direction → `optimize`.
3. Percentage in a test context → `cover`.
4. Question form → `design` ("how should") or `diagnose` ("why") — and this beats symptom words: "why isn't the build green" is `diagnose`, not `fix`.
5. PR/MR/`#N` → `review`.
6. Ticket reference → `build`.
7. Truly ambiguous → ask ONE question naming the two candidate routes. **Do not guess when two DIFFERENT skills are plausible and the goal names no artifact, metric, or number.** Canonical fallbacks: "fix performance on the dashboard" (fix vs optimize), "review my code" with no PR/branch named (review vs verify), "test the new feature" (cover vs verify vs build), "the queries are slow and maybe vulnerable to injection" (optimize vs review).
