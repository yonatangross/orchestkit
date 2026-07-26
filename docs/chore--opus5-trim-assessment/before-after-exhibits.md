# BEFORE / AFTER Exhibit Set — OrchestKit Trim Proposal

All BEFORE text is verbatim from HEAD at `/Users/yonatangross/coding/yonatangross/orchestkit`. Char counts measured with `python3 len()` over the exact cited line range (trailing newline stripped).

```
#  SURFACE                                   BEFORE   AFTER    CUT     LOADED
─────────────────────────────────────────────────────────────────────────────
1  CLAUDE.md:62-72        rule                 499     375   -24.8%   every session
2  assess/SKILL.md:163-199 skill section      1,813     252   -86.1%   on invoke (#1 skill)
3  monitoring-engineer.md:60-87 agent        1,616     348   -78.5%   on spawn
4  cover/SKILL.md:5       description           596     309   -48.2%   every session
5  doctor/SKILL.md:166-185 anachronism       1,112     796   -28.4%   on invoke
6  design-ship -> design-import  merge      1,519+   398+    -73.8%   every session
                                            10,395    857    -91.8%   on invoke
```

---

## 1. Hobbling RULE rewritten from ban-voice to judgement-voice

**File:** `/Users/yonatangross/coding/yonatangross/orchestkit/CLAUDE.md:62-72`
**499 chars -> 375 chars (-24.8%)**

### BEFORE (verbatim)
```markdown
## Critical Rules

**DO**: Edit `src/`, run `npm run build`, commit to feature branches, use TaskCreate for 3+ step work.

**DON'T**: Edit `plugins/`, commit to `main`/`dev` directly, skip security tests, bypass hooks with `--no-verify`, commit secrets.

**Before committing**:
1. `npm test` — all suites must pass
2. `npm run test:security` — MUST pass (blocks push)
3. `npm run typecheck` — if hooks were changed
4. `git diff` — verify changes are real, not no-ops or stale from a previous session
```

### AFTER
```markdown
## Before committing

`npm test`, plus `npm run typecheck` if you touched `src/hooks/`. `main`/`dev` are
protected, so work on a branch. `bin/git-hooks/pre-push:322` runs
`tests/security/run-security-tests.sh` and rejects the push, so `--no-verify` only
relocates the failure to CI. Nothing enforces TaskCreate any more; use it when the
operator gains from watching progress.
```

**PRESERVED**
- `npm test` and the typecheck-only-if-hooks-changed condition.
- `main`/`dev` are protected branches.
- **New information the ban never carried:** *why* `--no-verify` is futile. Verified at `bin/git-hooks/pre-push:322-325` (`./tests/security/run-security-tests.sh`), symlinked live as `.git/hooks/pre-push`. The old text asserted "MUST pass (blocks push)" without saying where the gate lives.
- TaskCreate kept as a judgement call rather than silently dropped. Deleting it outright would remove the only surviving control: the todo-enforcer hook is gone (`src/hooks/src/entries/prompt.ts:29` is now a stale comment).

**CUT and why**
- `Edit src/` / `Edit plugins/` — already stated 26 lines earlier at `CLAUDE.md:36` (`**Key rule**: Edit \`src/\` and \`manifests/\`, NEVER edit \`plugins/\`.`).
- `commit secrets` — gitleaks runs in `.github/workflows/ci.yml:162` and `tests/security/test-secret-scanning.sh` runs in the pre-push suite. Prohibiting it in prose adds nothing.
- `skip security tests` — same gate as above.
- `git diff — verify changes are real` — general practice, no repo-specific content.

**Operational note:** `CLAUDE.md` is a release-please whole-file governed path (`.claude/rules/count-sync.md:33-35`). This edit needs the `release-please-override` label or File Guard blocks it. Budget headroom is tight: `tests/performance/test-token-overhead.sh:77` sets `CLAUDE_MD_MAX_BYTES=4800` and the file is at 4,621 (96%, already inside the 90% warn band), so this cut buys 124 bytes of runway.

---

## 2. Bloated SKILL section (from the #1 most-invoked skill)

**File:** `/Users/yonatangross/coding/yonatangross/orchestkit/src/skills/assess/SKILL.md:163-199`
`assess` = 64 telemetry invocations, the most-used ork skill.
**1,813 chars -> 252 chars (-86.1%)**

### BEFORE (verbatim)
````markdown
## 🚨 Task Management (CC 2.1.16)

```python
# 1. Create main task IMMEDIATELY
TaskCreate(
  subject="Assess: {target}",
  description="Comprehensive evaluation with quality scores and recommendations",
  activeForm="Assessing {target}"
)

# 2. Create subtasks for each assessment phase
TaskCreate(subject="Understand target and gather context", activeForm="Understanding target")   # id=2
TaskCreate(subject="Discover scope and build file list", activeForm="Discovering scope")        # id=3
TaskCreate(subject="Rate quality across 6 dimensions", activeForm="Rating quality")             # id=4
TaskCreate(subject="Analyze pros and cons", activeForm="Analyzing pros/cons")                   # id=5
TaskCreate(subject="Compare alternatives", activeForm="Comparing alternatives")                 # id=6
TaskCreate(subject="Generate improvement suggestions", activeForm="Generating suggestions")     # id=7
TaskCreate(subject="Compile assessment report", activeForm="Compiling report")                  # id=8

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Scope needs target understanding
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Rating needs scoped file list
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Pros/cons needs quality scores
TaskUpdate(taskId="6", addBlockedBy=["4"])  # Alternatives need quality scores
TaskUpdate(taskId="7", addBlockedBy=["5", "6"])  # Suggestions need analysis
TaskUpdate(taskId="8", addBlockedBy=["7"])  # Report needs suggestions

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```
````

### AFTER
```markdown
## Task tracking

Track the phases below as tasks. Phase 1 to 1.5 to 2 is genuinely sequential (each
consumes the previous phase's output), but Phases 3-7 all fan out from the Phase 2
scores, so do not chain those with `addBlockedBy` just to look tidy.
```

**PRESERVED**
- The only non-derivable content in the block: its **dependency shape**. Lines 185-186 encode that tasks 5 and 6 *both* depend on 4 (a fan-out, not a chain). The AFTER states that structure against the real phase headings, so it cannot drift.

**CUT and why**
- The 7 `TaskCreate` subject strings are byte-duplicates of headings already in the same file: `## Phase 1: Target Understanding` (:227), `## Phase 1.5: Scope Discovery` (:240), `## Phase 2: Quality Rating (6 Dimensions)` (:259), `## Phases 3-7: Analysis, Comparison & Report` (:292). Two copies of one list, 40 lines apart.
- **`TaskGet(taskId="2")` at :191 is a bug, not padding.** `src/skills/assess/SKILL.md:11` declares `allowed-tools: [AskUserQuestion, Read, Grep, Glob, Agent, TaskCreate, TaskUpdate, TaskList, ToolSearch, mcp__memory__search_nodes, Bash]` with no `TaskGet`. The skill instructs a tool it is not permitted to call. The byte-identical line exists in 23 SKILL.md files.
- `# 5. Update status as you progress` with `status="in_progress"` / `"completed"` is a transcription of the TaskUpdate JSONSchema the harness already ships on every call.
- `(CC 2.1.16)` in the heading: the repo floor is `>= 2.1.220`, 204 releases later.

---

## 3. AGENT persona padding cut to a lean Opus-5-era agent

**File:** `/Users/yonatangross/coding/yonatangross/orchestkit/src/agents/monitoring-engineer.md:60-87`
**1,616 chars -> 348 chars (-78.5%)**

### BEFORE (verbatim)
```markdown
## Directive

Consult project memory for past decisions and patterns before starting. Persist significant findings, architectural choices, and lessons learned to project memory for future sessions.
You are a Monitoring Engineer specializing in observability infrastructure. Your goal is to ensure systems are properly instrumented with metrics, logs, and traces, and that alerting is configured to catch issues before they impact users.

## Task Management
For multi-step work (3+ distinct steps), use CC 2.1.16 task tracking:
1. `TaskCreate` for each major step with descriptive `activeForm`
2. `TaskGet` to verify `blockedBy` is empty before starting
3. Set status to `in_progress` when starting a step
4. Use `addBlockedBy` for dependencies between steps
5. Mark `completed` only when step is fully verified
6. Check `TaskList` before starting to see pending work

## MCP Tools (Optional — skip if not configured)

- `mcp__context7__*` - Fetch latest Prometheus, Grafana, OpenTelemetry documentation
- **Opus 4.8 adaptive thinking** — Complex alerting rule design and threshold analysis. Native feature for multi-step reasoning — no MCP calls needed. Replaces sequential-thinking MCP tool for complex analysis
- `mcp__memory__*` - Knowledge graph for monitoring patterns and alert decisions

## Concrete Objectives

1. Design and implement Prometheus metrics instrumentation
2. Create Grafana dashboards for service visibility
3. Configure alerting rules with appropriate thresholds
4. Set up distributed tracing with OpenTelemetry
5. Implement log aggregation and structured logging
6. Define and track SLOs/SLIs
```

### AFTER
```markdown
## Directive

You own observability here: instrumentation (metrics, logs, traces) and the alerting
that has to fire before a user notices. You are pinned to `haiku` at `effort: low`, so
do not recall version-specific Prometheus / Grafana / OpenTelemetry API surface, look it
up. This agent's `mcpServers` is `[tavily]`; context7 is not wired to it.
```

**PRESERVED**
- The scope statement (what this agent owns), compressed from the persona opener.
- **The grounding instruction, but only because it is justified here.** This agent really is `model: haiku` + `effort: low` (`:5`, `:7`). The same "ground before answering" block appears on 7 `model: inherit` agents where its own cited evidence says the gain is zero on Opus, which is where it is hobbling. On a haiku-pinned agent it is informative.
- **Corrected a live defect:** line 76 tells the agent to use `mcp__context7__*`, but `:43` declares `mcpServers: [tavily]`. context7 is not available to this agent. The BEFORE instructs an unreachable tool; the AFTER says so.

**CUT and why**
- The memory paragraph appears verbatim in 20 agents. It names no tool, no path, no trigger, and no threshold for "significant". This agent already carries `memory: project` at `:10`. Pure "be diligent".
- `## Task Management` is the CC 2.1.16 tutorial present in 32 of 37 agents, restating the TaskCreate/TaskGet/TaskUpdate/TaskList schemas the harness supplies on every call.
- `**Opus 4.8 adaptive thinking**` is a capability claim about a model generation this agent is not running.
- `## Concrete Objectives` re-lists the `description:` at `:3` and the seven `keywords:` at `:47-54`, both already in the agent's own frontmatter.

**Frontmatter (`:1-58`) is untouched.** `tools`, `skills`, `hooks`, `mcpServers`, `taskTypes`, `keywords`, `examplePrompts` are all required by `tests/agents/test-agent-frontmatter.sh` and are the one genuinely non-derivable layer: enforcement, not information.

---

## 4. Bloated frontmatter DESCRIPTION tightened, routing accuracy kept

**File:** `/Users/yonatangross/coding/yonatangross/orchestkit/src/skills/cover/SKILL.md:5`
This is always-loaded index text (`cover` has `disable-model-invocation` unset, so it occupies a per-session index slot).
**596 chars -> 309 chars (-48.2%)**

### BEFORE (verbatim)
```yaml
description: "Generate tests that do not exist yet. Analyzes coverage gaps, then writes and runs new test files across three tiers (unit, integration against real services via testcontainers/docker-compose, and Playwright E2E), spawning one test-generator agent per tier and healing failures for up to 3 iterations. Use when code has no tests, when raising coverage after implementation, or when building a suite from scratch. Chains naturally after /ork:implement. Do NOT use to grade or score tests that already exist (use /ork:verify), or to run a suite without writing anything new (use npm test directly)."
```

### AFTER
```yaml
description: "Writes tests that do not exist yet: unit, integration against real services (testcontainers/docker-compose), and Playwright E2E, then runs them. Use when code has no tests or coverage needs raising. Do NOT use to grade tests that already exist (that is /ork:verify), or just to run a suite (that is npm test)."
```

**PRESERVED (all three boundary clauses, verbatim in meaning)**
- The positive identity: writes tests that **do not exist yet**.
- Negative clause 1: not for grading existing tests, redirect to `/ork:verify`.
- Negative clause 2: not for merely running a suite, redirect to `npm test`.
- The three tiers, including `testcontainers/docker-compose` (a house convention, not a default a router would infer).

These matter because `cover` and `verify` are a measured router collision (TF-IDF cosine 0.202, sharing `grade`, `unit`, `integration`, `e2e`, `coverage`). The negative clauses are the only thing separating them, and they survive intact.

**CUT and why**
- `spawning one test-generator agent per tier and healing failures for up to 3 iterations` is implementation detail. It belongs in the body, which loads only on invoke. It cannot change which skill a router picks.
- `when raising coverage after implementation, or when building a suite from scratch` is a verb-conjugation of the first sentence. It adds lexical overlap without adding a distinguishing signal.
- `Chains naturally after /ork:implement` is what the model does unprompted after writing code with no tests.

---

## 5. Pre-Opus-5 anachronism removed

**File:** `/Users/yonatangross/coding/yonatangross/orchestkit/src/skills/doctor/SKILL.md:166-185`
**1,112 chars -> 796 chars (-28.4%)**

Note on category: a tree-wide grep for `YOU MUST` across `src/skills/` and `src/agents/` returns **0 hits**, and CoT incantations ("think step by step", "take a deep breath") return 5 hits, all of which are documentation *about* prompting, not instructions *to* the model. The CoT/YOU-MUST inflation thesis does not hold in this repo. The anachronism that *is* real is model-generation pinning, and this is its worst instance: a check that fires a **false failure on Opus 5 and prescribes a downgrade**.

### BEFORE (verbatim)
````markdown
### Category 14: Effort/Model Compatibility (CC 2.1.111+)

CC 2.1.111 added `xhigh` effort (Opus 4.8; since CC 2.1.154 it defaults to `high` and takes `xhigh` for the hardest tasks). Using it with a model that doesn't support it silently falls back to `high` — producing no error but losing the extra deepening pass documented in the affected skills.

**Detection**:
- If the active model does NOT support `xhigh` (i.e. not Opus 4.8), check whether `/effort` is set to `xhigh`:
  - Read `.claude/settings.json` → `effort` field
  - Read `$ORCHESTKIT_EFFORT` env var (populated by the effort-detector hook)
- Check for any skill invocation under `.claude/chain/*.json` that explicitly set `effort: xhigh` with a non-Opus-4.8 model in scope

**Warning format**:
```
WARNING: xhigh effort requires Opus 4.8.
  Current model: <model-id>
  Configured effort: xhigh
  Impact: Skills fall back to high — xhigh's extra deepening pass is lost silently.
  Fix: Either switch to Opus 4.8 (`claude --model opus-4-8`) or lower effort to `high`.
```

**Exit code**: Non-zero in `--json` mode; soft warning in interactive mode.
````

### AFTER
```markdown
### Category 14: Effort/Model Compatibility

`xhigh` effort degrades to `high` on a model that does not implement it: no error, no
log line, the skill just silently loses its extra deepening pass. That silence is the
only reason this check has to exist.

**Detection**:
- Read `.claude/settings.json` -> `effort`, and `$ORCHESTKIT_EFFORT` (populated by the
  effort-detector hook)
- Check `.claude/chain/*.json` for any invocation that pinned `effort: xhigh`
- If it resolves to `xhigh`, report the active model id and let the operator judge. Do
  NOT name a required model: `models.vocab.json` has no effort-capability field to check
  against, and every model name hardcoded here has already gone stale once.

**Exit code**: warn, never fail. A model without `xhigh` still produces a valid run.
```

**PRESERVED**
- The entire mechanism, which is the informative part: `xhigh` **silently** falls back, so the failure is invisible and needs a checker.
- Both detection sources, exactly: `.claude/settings.json` -> `effort`, and `$ORCHESTKIT_EFFORT` populated by the effort-detector hook (`src/hooks/src/*/effort-detector.ts`, confirmed to exist).
- The `.claude/chain/*.json` scan.

**CUT and why**
- Every `Opus 4.8` literal. Running model is `claude-opus-5[1m]`. The BEFORE emits `Fix: Either switch to Opus 4.8 (\`claude --model opus-4-8\`)`, telling an Opus 5 user to downgrade. This is the one artifact in the audited tree that is actively harmful rather than merely dead.
- The `(CC 2.1.111+)` stamp: the floor is `>= 2.1.220`, so the gate is unconditional.
- Non-zero exit demoted to warn, because the underlying condition is not a failure.

**Deliberately NOT done:** the obvious fix (resolve capability from `src/hooks/src/lib/models.vocab.json`) is unimplementable at HEAD. `grep -c xhigh src/hooks/src/lib/models.vocab.json` returns **0**; that file has only `shortNames` / `aliases` / `fullIds` / `historicalIds` / `pricing`. The AFTER says so explicitly so the next author does not try it.

**Two dangling references must land in the same commit:**
- `src/skills/doctor/SKILL.md:163` (the category table row): `| **14. Effort/Model** | Detects \`xhigh\` effort configured without Opus 4.8 — see below | inline |`
- `src/skills/assess/SKILL.md:54,56`, which point *into* this behaviour: `| \`xhigh\` (Opus 4.8) | ...` and `> \`xhigh\` silently falls back to \`high\` on models that don't support it (Opus 4.8 does). \`/ork:doctor\` warns when \`xhigh\` is used without Opus 4.8.`
- The repo already self-contradicts on this: `src/skills/upgrade-assessment/rules/knowledge-compatibility.md:27` states Sonnet 5 has `xhigh` effort, which alone refutes "xhigh requires Opus 4.8".

---

## 6. MERGE: two overlapping skills collapsed into one

**Files:** `src/skills/design-ship/SKILL.md` (10,395 bytes) merged into `src/skills/design-import/SKILL.md` (12,769 bytes)
**Index descriptions: 768 + 751 = 1,519 chars -> 398 chars (-73.8%)**
**Body: 10,395 bytes -> 857 chars (-91.8%)**

These are the two longest descriptions in the entire visible index, and each spends its final third explaining when *not* to use the other. That is the signature of a bad split.

### BEFORE (verbatim, `src/skills/design-import/SKILL.md:5`)
```yaml
description: "Scaffolds React components out of an exported Claude Design handoff bundle and stops at files on disk: no stories, no tests, no pull request. Takes a claude.ai/design URL or a local bundle file, validates the tarball layout, reconciles the bundle's design tokens against the project's, deduplicates every proposed component against the existing codebase via component-search, pipes the survivors through the design-to-code pipeline, and records provenance so a later re-export can be diffed for drift. This is the import step by itself. Use it when you want the scaffolded code sitting in the working tree to inspect or edit yourself; when that same scaffold should carry on through test generation, browser verification and an opened PR, run /ork:design-ship instead."
```

### BEFORE (verbatim, `src/skills/design-ship/SKILL.md:5`)
```yaml
description: "One-shot pipeline that turns a claude.ai/design link into a reviewable pull request, four stages chained end to end: scaffold the components (delegated to /ork:design-import), generate Storybook stories and Playwright specs via /ork:cover, run diff-aware browser verification via /ork:expect, then open a PR whose body carries the design link, before/after screenshots, the component decision table and the coverage delta. Guards the run with a pre-flight check for a dirty tree or a protected branch, and patches the opened PR number back into the provenance record. Use it when a designer or PM hands you a design link and wants a PR back with no intermediate steps; if all you need is the components written to disk, run /ork:design-import instead."
```

### AFTER (survivor: `src/skills/design-import/SKILL.md:5`, `design-ship/` deleted)
```yaml
description: "Turns an exported Claude Design handoff into React components on disk: validates the bundle, reconciles its tokens against the project, dedupes each component against the existing codebase, and records provenance for later drift diffs. Takes a claude.ai/design URL or a local bundle file. Stops at files in the working tree; pass --ship to continue through /ork:cover, /ork:expect and an opened PR."
```

### AFTER (survivor body: the section that replaces `design-ship/SKILL.md:140-196`)
```markdown
## `--ship`

Without `--ship` the skill stops at files in the working tree. With it, continue:

1. `/ork:cover` on the components this run wrote (exclude any marked `decision: reuse`).
   Storybook stories always, Playwright only if a new route was registered, unit tests
   only where the component carries non-trivial logic.
2. `/ork:expect` on the diff, saving before/after shots to
   `.claude/design-handoffs/{bundle_id}/screenshots/`. Verification failures are
   reported, not fatal; they surface in review.
3. `/ork:create-pr`, body carrying the design link, those screenshots, the component
   decision table and the coverage delta. Patch the PR number back into the provenance
   record.

Pre-flight before any of this: a dirty tree or a protected branch aborts. A failed
import aborts too. Never generate tests against half-scaffolded components.
```

**PRESERVED (every non-derivable fact from both skills)**
- Input shapes: `claude.ai/design` URL or a local bundle file.
- The default stop point (files on disk, nothing else), which was `design-import`'s whole identity.
- Provenance recording + the drift-diff purpose.
- Component dedupe against the existing codebase.
- The exact screenshot path `.claude/design-handoffs/{bundle_id}/screenshots/` (from `design-ship/SKILL.md:176`).
- The `decision: reuse` exclusion when scoping cover (from `design-ship/SKILL.md:150`).
- The three tier-selection rules: stories always, Playwright only on a new route, unit tests only for non-trivial logic (from `design-ship/SKILL.md:158-161`).
- Both failure policies, which are opposite and therefore non-derivable: import failure is **fatal** (`design-ship/SKILL.md:144`, "If import fails, **stop**"), verification failure is **not** (`design-ship/SKILL.md:182`, "do not block").
- Pre-flight abort on dirty tree / protected branch.
- PR body contents: design link, screenshots, decision table, coverage delta; PR number patched back into provenance.

**CUT and why**
- Two index slots collapse to one. The disambiguation prose in *both* descriptions ("run /ork:design-ship instead" / "run /ork:design-import instead") disappears because there is no longer a sibling to disambiguate from.
- The three verbatim `Agent(subagent_type=..., prompt=f"""...""")` blocks in `design-ship/SKILL.md:148-186`. Their prompt bodies are the tier rules restated as English inside an f-string; the AFTER keeps the rules and drops the scaffolding.
- `design-ship`'s `## Composition` / `## NOT this skill's job` / `## Limitations` sections exist only to fence it off from `design-import`. With one skill they have no referent.

**Wiring the merge must repair (checked, not assumed):**
- `src/skills/design-ship/SKILL.md:16` declares `agent: claude-design-orchestrator`. That agent has never been spawned per telemetry, but `src/skills/design-import` and `src/skills/design-import`'s pipeline still reference it. Verify the binding survives on the merged skill before deleting.
- `plugins/ork/commands/design-ship.md` is generated. `npm run build` must run and `plugins/` must be staged, or every marketplace install keeps the deleted slash command.

---

## Honest scope note

These six cut a combined 17,132 chars of source. Only two of them (exhibits 1 and 4, plus the description half of exhibit 6) touch the **recurring per-session tax**, and that portion is roughly 1,530 chars (~380 tokens). The rest is on-invoke or on-spawn body text: it buys review speed and stops rot, not baseline tokens.

The measured always-loaded index is **23,764 chars across 59 skills**, not the 121,718 bytes in the brief. That figure sums all frontmatter keys (`tags`, `license`, `compatibility`, `allowed-tools`, `metadata`) across all 114 skills, and none of those reach the model. Verified by direct comparison: `grep -L 'disable-model-invocation: true' src/skills/*/SKILL.md` returns exactly the 59 names present in this session's own skill listing, with zero symmetric difference. Any proposal that trims `tags:` for token savings is theater.