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

## Disambiguation (when multiple categories match)

1. Explicit verb wins. "Fix the slow query" → `fix`.
2. Metric + direction → `optimize`.
3. Percentage in a test context → `cover`.
4. Question form → `design` ("how should") or `diagnose` ("why") — and this beats symptom words: "why isn't the build green" is `diagnose`, not `fix`.
5. PR/MR/`#N` → `review`.
6. Ticket reference → `build`.
7. Truly ambiguous → ask ONE question naming the two candidate routes. **Do not guess when two DIFFERENT skills are plausible and the goal names no artifact, metric, or number.** Canonical fallbacks: "fix performance on the dashboard" (fix vs optimize), "review my code" with no PR/branch named (review vs verify), "test the new feature" (cover vs verify vs build), "the queries are slow and maybe vulnerable to injection" (optimize vs review).
