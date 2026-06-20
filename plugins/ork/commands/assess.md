---
description: "Assesses and rates quality 0-10 across multiple dimensions (correctness, maintainability, security, performance, testability, simplicity) with pros/cons analysis. Compares against project conventions and prior decisions from memory. Produces structured evaluation reports with actionable improvement suggestions. Use when evaluating code, designs, architectures, or comparing alternative approaches."
allowed-tools: [AskUserQuestion, Read, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, ToolSearch, mcp__memory__search_nodes, Bash]
---

# Auto-generated from skills/assess/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Assess

Comprehensive assessment skill for answering "is this good?" with structured evaluation, scoring, and actionable recommendations.

## 🎯 Quick Start

```bash
/ork:assess backend/app/services/auth.py
/ork:assess our caching strategy
/ork:assess --model=opus the current database schema
/ork:assess frontend/src/components/Dashboard
```

### Effort levels (CC 2.1.111+ adds `xhigh`)

| Effort | Behavior |
|---|---|
| `low` / `medium` | Subset of dimensions, faster turnaround |
| `high` (default) | All six dimensions with pros/cons |
| `xhigh` (Opus 4.8) | All six dimensions + one additional assessor pass focused on uncertainty/caveats; emits `confidence` per dimension |

> `xhigh` silently falls back to `high` on models that don't support it (Opus 4.8 does). `/ork:doctor` warns when `xhigh` is used without Opus 4.8.


## Argument Resolution

```python
TARGET = "$ARGUMENTS"  # Full argument string, e.g., "backend/app/services/auth.py"
# $ARGUMENTS[0] is the first token (CC 2.1.59 indexed access)

# Model override detection (CC 2.1.72)
MODEL_OVERRIDE = None
for token in "$ARGUMENTS".split():
    if token.startswith("--model="):
        MODEL_OVERRIDE = token.split("=", 1)[1]  # "opus", "sonnet", "haiku"
        TARGET = TARGET.replace(token, "").strip()
```

Pass `MODEL_OVERRIDE` to all Agent() calls via `model=MODEL_OVERRIDE` when set. Accepts symbolic names (`opus`, `sonnet`, `haiku`) or full IDs (`claude-opus-4-8`) per CC 2.1.74.

> **Switching to Opus via `/model` (CC 2.1.144+):** `/model` now changes the model for the current session only, so picking Opus for an assess run no longer persists past it. Press `d` in the picker only to set a default for new sessions.

### Effort detection (CC 2.1.120+)

`${CLAUDE_EFFORT}` is the primary signal. CC 2.1.120 sets this env var from `/effort` or the model picker. `--effort=` token in `$ARGUMENTS` is the explicit override fallback (also covers older CC).

```python
# Read env first (CC 2.1.120+), then check explicit override
EFFORT = os.environ.get("CLAUDE_EFFORT")  # "low" | "medium" | "high" | "xhigh" | None
for token in "$ARGUMENTS".split():
    if token.startswith("--effort="):
        EFFORT = token.split("=", 1)[1]   # explicit override wins
        TARGET = TARGET.replace(token, "").strip()
EFFORT = EFFORT or "high"  # default when CC < 2.1.120 and no flag
```

Use `EFFORT` to gate dimension count, agent count, and the optional `xhigh` uncertainty pass — see "Effort levels" table above. On CC < 2.1.120 the env var is unset; the explicit `--effort=` override is the only path. `/ork:doctor` warns when `xhigh` is requested without Opus 4.8.


## STEP -1: MCP Probe + Resume Check

> Load: `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/mcp-detection.md")`

```python
# 1. Probe MCP servers (once at skill start)
# memory is alwaysLoad in .mcp.json (CC 2.1.121+, #1541) — probe below kept as fallback for older CC:
ToolSearch(query="select:mcp__memory__search_nodes")

# 2. Store capabilities
Write(".claude/chain/capabilities.json", {
  "memory": probe_memory.found,
  "skill": "assess",
  "timestamp": now()
})

# 3. Check for resume
state = Read(".claude/chain/state.json")  # may not exist
if state.skill == "assess" and state.status == "in_progress":
    last_handoff = Read(f".claude/chain/{state.last_handoff}")
```

### Phase Handoffs

| Phase | Handoff File | Contents |
|-------|-------------|----------|
| 0 | `00-intent.json` | Dimensions, target, mode |
| 1 | `01-baseline.json` | Initial codebase scan results |
| 2 | `02-evaluation.json` | Per-dimension scores + evidence |
| 3 | `03-report.json` | Final report, grade, recommendations |


## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify assessment dimensions:

```python
AskUserQuestion(
  questions=[{
    "question": "What dimensions to assess?",
    "header": "Dimensions",
    "options": [
      {"label": "Full assessment (Recommended)", "description": "All dimensions: quality, maintainability, security, performance"},
      {"label": "Code quality only", "description": "Readability, complexity, best practices"},
      {"label": "Security focus", "description": "Vulnerabilities, attack surface, compliance"},
      {"label": "Quick score", "description": "Just give me a 0-10 score with brief notes"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Full assessment**: All 7 phases, parallel agents
- **Code quality only**: Skip security and performance phases
- **Security focus**: Prioritize security-auditor agent
- **Quick score**: Single pass, brief output


## STEP 0b: Select Orchestration Mode

Load details: `Read("${CLAUDE_SKILL_DIR}/references/orchestration-mode.md")` for env var check logic, Agent Teams vs Task Tool comparison, and mode selection rules.


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


## What This Skill Answers

| Question | How It's Answered |
|----------|-------------------|
| "Is this good?" | Quality score 0-10 with reasoning |
| "What are the trade-offs?" | Structured pros/cons list |
| "Should we change this?" | Improvement suggestions with effort |
| "What are the alternatives?" | Comparison with scores |
| "Where should we focus?" | Prioritized recommendations |


## 🔄 Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Target Understanding** | Read code/design, identify scope | Context summary |
| **1.5. Scope Discovery** | Build bounded file list | Scoped file list |
| **2. Quality Rating** | 6-dimension scoring (0-10) | Scores with reasoning |
| **3. Pros/Cons Analysis** | Strengths and weaknesses | Balanced evaluation |
| **4. Alternative Comparison** | Score alternatives | Comparison matrix |
| **5. Improvement Suggestions** | Actionable recommendations | Prioritized list |
| **6. Effort Estimation** | Time and complexity estimates | Effort breakdown |
| **7. Assessment Report** | Compile findings | Final report |


## Phase 1: Target Understanding

Identify what's being assessed and gather context:

```python
# PARALLEL - Gather context
Read(file_path="$ARGUMENTS[0]")  # If file path
Grep(pattern="$ARGUMENTS[0]", output_mode="files_with_matches")
mcp__memory__search_nodes(query="$ARGUMENTS[0]")  # Past decisions
```


## Phase 1.5: Scope Discovery

Load `Read("${CLAUDE_SKILL_DIR}/references/scope-discovery.md")` for the full file discovery, limit application (MAX 30 files), and sampling priority logic. **Always include the scoped file list** in every agent prompt.

### Progressive Output (CC 2.1.76)

Output results **incrementally** as each evaluation phase completes:

| After Phase | Show User |
|-------------|-----------|
| 1. Target Understanding | Scope summary, file list, context |
| 1.5. Scope Discovery | Bounded file list (max 30 files) |
| 2. Quality Rating | Each dimension's score as the evaluating agent returns |
| 3. Pros/Cons | Balanced evaluation summary |

For Phase 2 parallel agents, show each dimension's score **as soon as the evaluating agent returns** — don't wait for all 4 agents. If any dimension scores below 4/10, flag it immediately as a priority concern requiring user attention.


## Phase 2: Quality Rating (6 Dimensions)

Rate each dimension 0-10 with weighted composite score. Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/quality-gates/references/unified-scoring-framework.md")` for dimensions, weights, grade interpretation, and per-dimension criteria. Load `Read("${CLAUDE_SKILL_DIR}/references/quality-model.md")` for assess-specific overrides.

Load `Read("${CLAUDE_SKILL_DIR}/references/agent-spawn-definitions.md")` for Task Tool mode spawn patterns and Agent Teams alternative.

**Composite Score:** Weighted average of all 6 dimensions (see quality-model.md).


## Phase 2.5: Adversarial Refutation (effort-gated)

The assessor that scores a dimension is also its only judge — self-preferential bias.
A separate **blind refuter** verifies decision-bearing scores before they reach the
composite. **Effort gate:** `low`/`medium` skip this phase entirely; `high` runs up-to-4
single refuters (advisory, no auto-swing); `xhigh` runs 3-refuter majority with auto-revise.

Load the protocol + assess bindings: `Read("${CLAUDE_SKILL_DIR}/references/adversarial-refutation.md")`
(which loads the shared engine `${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/adversarial-refutation.md`).

### Cross-model refuter (optional, provenance-labeled, cost-gated)

When `ORK_ALT_MODEL_CMD` is configured and effort is `high`/`xhigh`, one quorum slot per high-weight or boundary-adjacent dimension score can route to a non-Claude model (Codex/GPT) for diverse failure modes. Off by default; substitutes one same-model slot, stamps `refuter_model` for provenance, cannot silently raise the grade (engine §7), owns no credentials/egress (shells out via `ORK_ALT_MODEL_CMD`, matches the egress guard #2533), and degrades to same-model on an absent command. Shares the review-pr operational doc: `Read("${CLAUDE_PLUGIN_ROOT}/skills/review-pr/references/cross-model-refuter.md")`.

Runs after Phase 2 returns, before the composite/grade and Phases 3-7. Refuters are ALWAYS
isolated `Agent(...)` Task spawns (never team members, even in Agent Teams mode) fed only the
serialized claim — no producer score, identity, or prose. Revised scores recompute the
composite; the refutation ledger (`02b-refutation.json`) records survived/killed/downgraded
so wrong scores are auditable. Keep the producer-basis score AND a labeled post-refutation
score — refutation never silently raises the grade.


## Phases 3-7: Analysis, Comparison & Report

Load `Read("${CLAUDE_SKILL_DIR}/references/phase-templates.md")` for output templates for pros/cons, alternatives, improvements, effort, and the final report.

See also: `Read("${CLAUDE_SKILL_DIR}/references/alternative-analysis.md")` | `Read("${CLAUDE_SKILL_DIR}/references/improvement-prioritization.md")`


## Phase 7b: Emit Dashboard Spec (json-render)

Parse `--render=` from `$ARGUMENTS`. Default is `both`.

| Mode | Behavior |
|------|----------|
| `markdown` | Current behavior — markdown assessment report only. No spec emitted. |
| `json-render` | Emit `.claude/chain/assess-dashboard.json` only. Skip markdown report. |
| `both` | Emit spec **and** markdown. Default — human reads the report, downstream skills parse the spec. |

When emitting a spec:

1. Load format and catalog: `Read("${CLAUDE_SKILL_DIR}/references/dashboard-spec.md")`. Example: `references/dashboard-example.json`.
2. Build the spec using only catalog types: `Card`, `StatGrid`, `DataTable`, `StatusBadge`, `BarMeter`, `Markdown`. Top-level fields `composite` (number) and `grade` (string) are required for assess specs.
3. One `BarMeter` per dimension scored. The `verdict` element is a `StatusBadge` with status `success`/`warning`/`error` mapped from grade (A/B → success, C → warning, D/F → error).
4. Write to `.claude/chain/assess-dashboard.json` with compact JSON.
5. Validate before declaring success:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/render-spec.mjs" .claude/chain/assess-dashboard.json --check
```

If validation fails, fall back to markdown-only and surface the error. Never write a partial spec.

6. For `--render=both`, render the markdown view from the spec:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/render-spec.mjs" .claude/chain/assess-dashboard.json
```

This guarantees JSON spec and markdown report stay in sync.

**xhigh effort:** when `effort=xhigh` is active, add a sibling `Markdown` element per dimension containing `confidence` and `caveats` from the uncertainty pass. Reference list it in the `dimensions` Card's children alongside the `BarMeter`. See `references/dashboard-spec.md` for the exact pattern.

**Downstream consumption:** `/ork:implement` reads `.claude/chain/assess-dashboard.json` and pulls the lowest-scoring dimension and high-priority improvements (effort ≤ 2 AND impact ≥ 4) without parsing markdown tables. Measured: assess spec ≈ 830 tokens vs ~3500 token markdown for the same content.


## Phase 7c: Memory Writeback (signal-fired, optional)

When the assessment lands with a composite score, optionally persist scores + summary to the memory MCP knowledge graph as a typed entity. Future `/ork:memory` queries can then surface assessment lineage (which decisions did this codebase score 9/10 on testability? when did security regress below 7.0?).

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/memory_writeback.py "<assessment-dir>"
```

`<assessment-dir>` is the dir containing `assessment.json` (typically the session's `.claude/chain/`). The script writes a `memory-writeback.json` handoff alongside it.

Auto-skip conditions (all exit 0, all WARN-logged):

| Skip reason | Trigger |
|-------------|---------|
| `no composite score` | `assessment.json` has no top-level `composite` numeric field |
| `yg-mcp-core not importable` | `yg-mcp-core>=0.3.0` not installed (orchestkit is public; yg-mcp-core lives on private `pypi.yonyon.ai` — HQ-only) |
| `memory MCP unreachable` | memory MCP server down OR `.mcp.json` doesn't define `memory` |

The created entity has:
- `name`: `<slug-or-dir>@<timestamp>` (stable across re-runs — re-runs create new entities)
- `entityType`: `assessment` (override with `--entity-type <type>`)
- `observations`: `composite=X.XX`, one `<dim>=X.XX` per scored dimension, optional `summary: ...` and `topic: ...`

Mirrors `Yonatan-HQ/hq-ext-plugin#194` (audio_podcast handler) and orchestkit#1886 (post-synthesis podcast) pattern. Unblocked by `Yonatan-HQ/core#993` (yg-mcp-core 0.3.0).


## Phase 7d: Emit Chain Verdict (stop-gating)

After the composite and grade are final (post-refutation, Phase 2.5), ALWAYS write the machine-readable verdict — this is the stop-gate `/ork:implement` reads before Phase 1. Mirror the Phase 7b spec-emit pattern: build, write compact JSON, never write a partial file.

```json
// .claude/chain/assess-verdict.json
{
  "rubric": "ork-rubric/1.0",
  "skill": "assess",
  "verdict": "fail",
  "composite": 5.1,
  "dimension_scores": {"correctness": 7.0, "maintainability": 6.5, "performance": 5.5, "security": 3.2, "scalability": 6.0, "testability": 4.8, "compliance": 6.2},
  "blockers": [
    {"dimension": "security", "score": 3.2, "reason": "Unparameterized SQL in auth path (src/api/auth.ts:42)"}
  ],
  "feature": "<assessment topic, e.g. first non-flag token of $ARGUMENTS>"
}
```

Verdict rules — thresholds come from `${CLAUDE_SKILL_DIR}/rubric.json` (schema: `${CLAUDE_PLUGIN_ROOT}/skills/shared/rubric.schema.json`):

- `verdict = "fail"` when `composite < min_pass` (5.5) **OR** any dimension scores below its `min_blocker`. Otherwise `"pass"`.
- Every dimension below its `min_blocker` gets a `blockers[]` entry — dimension, score, one evidence-backed reason. `blockers` is `[]` on pass.
- Scores are the post-refutation numbers — the same ones in the report. Refutation never silently flips a fail to pass.

Consumers: `/ork:implement` Step -0.5 blocks Phase 1 on `verdict == "fail"` (user must fix-first or explicitly override); Phase 7c memory writeback persists the verdict + dimension scores to the memory graph (add a `verdict=pass|fail` observation) for cross-session learning.


## Self-Reported Uncertainty (Opus 4.8, `xhigh` effort)

Opus 4.8 is materially better than older tiers at honestly reporting its own limits. When `xhigh` effort is active, enrich each dimension's rating with a `confidence` level and a list of `caveats` — things the model couldn't verify, assumptions it relied on, or cases it didn't test.

Output schema per dimension (JSON):

```json
{
  "dimension": "security",
  "score": 7.2,
  "confidence": "medium",              // "low" | "medium" | "high"
  "caveats": [
    "Didn't execute the SQL queries against a real DB to confirm parameterization",
    "Assumed NODE_ENV=production in deployment; didn't verify CI config",
    "Reviewed 12 of 15 handlers; remaining 3 deferred by scope filter"
  ],
  "evidence": ["src/api/auth.ts:42", "src/middleware/guard.ts:88"]
}
```

Rules:
- **Do not use `confidence` as an auto-gate.** It's a signal for the human reader, not a pass/fail threshold.
- **`caveats` must be specific.** "Didn't check X" with file paths beats "uncertainty about security".
- **If a caveat is cheap to resolve, resolve it** instead of recording it. Caveats are for things that genuinely can't be verified within the skill's scope (e.g., production runtime behavior, future input patterns).
- **Composite score still computes from `score` only** — not weighted by confidence — to keep the number comparable across runs.


## 💡 Grade Interpretation

Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/quality-gates/references/unified-scoring-framework.md")` for grade thresholds and scoring criteria.


## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 6 dimensions | Comprehensive coverage | All quality aspects without overwhelming |
| 0-10 scale | Industry standard | Easy to understand and compare |
| Parallel assessment | 4 agents (6 dimensions) | Fast, thorough evaluation |
| Effort/Impact scoring | 1-5 scale | Simple prioritization math |


## Rules Quick Reference

| Rule | Impact | What It Covers |
|------|--------|----------------|
| complexity-metrics (load `${CLAUDE_SKILL_DIR}/rules/complexity-metrics.md`) | HIGH | 7-criterion scoring (1-5), complexity levels, thresholds |
| complexity-breakdown (load `${CLAUDE_SKILL_DIR}/rules/complexity-breakdown.md`) | HIGH | Task decomposition strategies, risk assessment |

## 📜 Related Skills

- `ork:verify` - Post-implementation verification
- `ork:code-review-playbook` - Code review patterns
- `ork:quality-gates` - Task complexity assessment, gate patterns


**Version:** 1.8.0 (June 2026) — optional cross-model adversarial refuter lane (provenance + cost gate, #2542)
