---
description: "Grade work that already exists and decide whether it can merge. Runs the project's current unit, integration, and E2E suites plus security scanning and type checking, scores every dimension 0-10, and returns a merge verdict with a VERIFIED-vs-CLAIMED evidence manifest. Writes no test files and edits no source. Use when verifying changes are ready to merge. Use /ork:cover instead when the tests still have to be written."
argument-hint: "[feature-or-scope]"
model: sonnet
effort: high
context: fork
user-invocable: true
name: verify
background: false
allowed-tools: [SendMessage, AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Agent, TaskCreate, TaskUpdate, TaskList, TaskStop, mcp__memory__search_nodes, ToolSearch, CronCreate, CronDelete, Monitor, PushNotification]
---

# Auto-generated from skills/verify/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Verify Feature

Comprehensive verification using parallel specialized agents with nuanced grading (0-10 scale) and improvement suggestions.

## Quick Start

```bash
/ork:verify authentication flow
/ork:verify --model=opus user profile feature
/ork:verify --scope=backend database migrations
```

## Argument Resolution

```python
SCOPE = "$ARGUMENTS"       # Full argument string, e.g., "authentication flow"
SCOPE_TOKEN = "$ARGUMENTS[0]"  # First token for flag detection (e.g., "--scope=backend")
# $ARGUMENTS[0], $ARGUMENTS[1] etc. for indexed access (CC 2.1.59)

# Model override detection (CC 2.1.72)
MODEL_OVERRIDE = None
for token in "$ARGUMENTS".split():
    if token.startswith("--model="):
        MODEL_OVERRIDE = token.split("=", 1)[1]  # "opus", "sonnet", "haiku", "fable"
        SCOPE = SCOPE.replace(token, "").strip()

# Streak gate detection (#2540) — consecutive-pass mode
STREAK_TARGET = None
for token in "$ARGUMENTS".split():
    if token.startswith("--streak="):
        STREAK_TARGET = int(token.split("=", 1)[1])  # N consecutive READY verdicts required (N >= 2)
        SCOPE = SCOPE.replace(token, "").strip()
# When set, apply the Streak Gate (see below). Full protocol: references/streak-gate.md
```

Pass `MODEL_OVERRIDE` to all Agent() calls via `model=MODEL_OVERRIDE` when set. Accepts symbolic names (`opus`, `sonnet`, `haiku`, `fable` on harnesses whose Agent tool lists it; note fable is premium API spend after 2026-07-12) or full IDs (`claude-opus-5`) per CC 2.1.74.

> **Opus 5**: Agents use native adaptive thinking (no MCP sequential-thinking needed); defaults to `high` effort (CC 2.1.154+). Extended 128K output supports comprehensive verification reports.


## STEP 0: Effort-Aware Verification Scaling (CC 2.1.76)

Scale verification depth based on `/effort` level:

| Effort Level | Phases Run | Agents | Output |
|-------------|------------|--------|--------|
| **low** | Run tests only → pass/fail | 0 agents | Quick check |
| **medium** | Tests + code quality + security | 3 agents | Score + top issues |
| **high** (default) | All 8 phases + visual capture | 6-7 agents | Full report + grades |
| **xhigh** (Opus 5, CC 2.1.111+) | All 8 phases + additional cross-file pattern sweep + self-verification pass | 6-7 agents | Full report with uncertainty annotations |

> **Override:** Explicit user selection (e.g., "Full verification") overrides `/effort` downscaling.

## STEP 0a: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify verification scope:

```python
AskUserQuestion(
  questions=[{
    "question": "What scope for this verification?",
    "header": "Scope",
    "options": [
      # multiSelect questions do not render previews (single-select only) — kept text-only
      {"label": "Full verification (Recommended)", "description": "All tests + security + code quality + visual + grades"},
      {"label": "Tests only", "description": "Run unit + integration + e2e tests"},
      {"label": "Security & code quality", "description": "Security audit (OWASP/CVE/secrets) + lint/types/complexity"},
      {"label": "Quick check", "description": "Just run tests, skip detailed analysis"}
    ],
    "multiSelect": true
  }]
)
```

**Based on answer, adjust workflow:**
- **Full verification**: All 9 phases (8 + 2.5), 7 parallel agents including visual capture
- **Tests only**: Skip phases 2 (security), 5 (UI/UX analysis)
- **Security & code quality**: Run security-auditor + code-quality-reviewer agents
- **Quick check**: Run tests only, skip grading and suggestions


## STEP 0b: Select Orchestration Mode

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/orchestration-mode.md")` for env var check logic, Agent Teams vs Task Tool comparison, and mode selection rules.

Choose **Agent Teams** (mesh -- verifiers share findings) or **Task tool** (star -- all report to lead) based on the orchestration mode reference.


### MCP Probe + Resume

```python
# memory is alwaysLoad in .mcp.json (CC 2.1.121+, #1541) — probe below kept as fallback for older CC:
ToolSearch(query="select:mcp__memory__search_nodes")
Write(".claude/chain/capabilities.json", { memory, timestamp })

Read(".claude/chain/state.json")  # resume if exists
```

### Handoff File

After verification completes, write results:

```python
Write(".claude/chain/verify-results.json", JSON.stringify({
  "phase": "verify", "skill": "verify",
  "timestamp": now(), "status": "completed",
  "outputs": {
    "tests_passed": N, "tests_failed": N,
    "coverage": "87%", "security_scan": "clean"
  }
}))
```

### Regression Monitor (CC 2.1.71)

Optionally schedule post-verification monitoring:

```python
# Guard: Skip cron in headless/CI (CLAUDE_CODE_DISABLE_CRON)
# if env CLAUDE_CODE_DISABLE_CRON is set, run a single check instead
CronCreate(
  schedule="0 8 * * *",
  prompt="Daily regression check: npm test.
    If 7 consecutive passes → CronDelete.
    If failures → alert with details."
)
```


## Task Management (CC 2.1.16)

```python
# 1. Create main verification task
TaskCreate(
  subject="Verify [feature-name] implementation",
  description="Comprehensive verification with nuanced grading",
  activeForm="Verifying [feature-name] implementation"
)

# 2. Create subtasks for 8-phase process
TaskCreate(subject="Run code quality checks", activeForm="Running quality checks")    # id=2
TaskCreate(subject="Execute security audit", activeForm="Running security audit")     # id=3
TaskCreate(subject="Verify test coverage", activeForm="Verifying test coverage")      # id=4
TaskCreate(subject="Validate API", activeForm="Validating API")                       # id=5
TaskCreate(subject="Check UI/UX", activeForm="Checking UI/UX")                       # id=6
TaskCreate(subject="Calculate grades", activeForm="Calculating grades")               # id=7
TaskCreate(subject="Generate suggestions", activeForm="Generating suggestions")       # id=8
TaskCreate(subject="Compile report", activeForm="Compiling report")                   # id=9

# 3. Set dependencies — phases 2-6 run in parallel, 7-9 are sequential
TaskUpdate(taskId="7", addBlockedBy=["2", "3", "4", "5", "6"])  # Grading needs all checks
TaskUpdate(taskId="8", addBlockedBy=["7"])  # Suggestions need grades
TaskUpdate(taskId="9", addBlockedBy=["8"])  # Report needs suggestions

# 4. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```


## 8-Phase Workflow

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/verification-phases.md")` for complete phase details, agent spawn definitions, Agent Teams alternative, and team teardown.

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Context Gathering** | Git diff, commit history | Changes summary |
| **2. Parallel Agent Dispatch** | 6 agents evaluate | 0-10 scores |
| **2.5 Visual Capture** | Screenshot routes, AI vision eval | Gallery + visual score |
| **3. Test Execution** | Backend + frontend tests | Coverage data |
| **4. Nuanced Grading** | Composite score calculation | Grade (A-F) |
| **5. Improvement Suggestions** | Effort vs impact analysis | Prioritized list |
| **6. Alternative Comparison** | Compare approaches (optional) | Recommendation |
| **7. Metrics Tracking** | Trend analysis | Historical data |
| **8. Report Compilation** | Evidence artifacts + gallery.html | Final report |

### Phase 2 Agents (Quick Reference)

| Agent | Focus | Output |
|-------|-------|--------|
| code-quality-reviewer | Lint, types, patterns | Quality 0-10 |
| security-auditor | OWASP, secrets, CVEs | Security 0-10 |
| test-generator | Coverage, test quality | Coverage 0-10 |
| backend-system-architect | API design, async | API 0-10 |
| frontend-ui-developer | React 19, Zod, a11y | UI 0-10 |
| python-performance-engineer | Latency, resources, scaling | Performance 0-10 |

Launch ALL agents in ONE message with `run_in_background=True` and `max_turns=25`.

### Progressive Output (CC 2.1.76+)

Output each agent's score **as soon as it completes** — don't wait for all 6-7 agents.

> **Focus mode (CC 2.1.101):** In focus mode, include the full composite score, all dimension scores, and the verdict in your final message — the user didn't see the incremental outputs.

```
Security:     8.2/10 — No critical vulnerabilities found
Code Quality: 7.5/10 — 3 complexity hotspots identified
[...remaining agents still running...]
```

This gives users real-time visibility into multi-agent verification. If any dimension scores below the `security_minimum` threshold (default 5.0), flag it as a **blocker immediately** — the user can terminate early without waiting for remaining agents.

### Monitor + Partial Results (CC 2.1.98)

Use `Monitor` for streaming test output. **A `run_in_background` request may not be honoured, so never wait unconditionally on the result.**

```python
task = Bash(command="npm test 2>&1", run_in_background=true)
if not task.id:                 # request ignored → output already returned inline
    use_inline_output(task)     # do NOT wait; there is no task to wait for
else:
    Monitor(pid=task.id)        # bounded: see the contract reference below
    # Still empty AND no live process → the run never happened.
    # Report NO VERDICT as a FAILURE. Never emit a grade from an empty run.
```

Measured (#3263): three backgrounded suites wrote **0 bytes**, npm's own banner never appeared, and the skill waited ~40 min on a completion signal that could not fire. An empty run must be loud, not pending. Contract and the refuted hypotheses: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/background-task-contract.md")`.

Full pattern reference (when to use vs. `TaskOutput`, until-condition gates, anti-patterns): `Read("${CLAUDE_PLUGIN_ROOT}/skills/chain-patterns/references/monitor-patterns.md")`.

**Partial results (CC 2.1.98):** If a verification agent fails mid-analysis, synthesize partial scores rather than re-spawning:

```python
for agent_result in verification_results:
    if "[PARTIAL RESULT]" in agent_result.output:
        # Extract whatever scores the agent produced before crashing
        partial_score = parse_score(agent_result.output)  # May be incomplete
        scores[agent_result.dimension] = {
            "score": partial_score, "partial": True,
            "note": "Agent crashed — score based on partial analysis"
        }
        # A 4-dimension score is better than no score. Do NOT re-spawn.
```

### Phase 2.5: Visual Capture (NEW — runs in parallel with Phase 2)

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/visual-capture.md")` for auto-detection, route discovery, screenshot capture, and AI vision evaluation.

**Summary**: Auto-detects project framework, starts dev server, discovers routes, uses agent-browser to screenshot each route, evaluates with Claude vision, generates self-contained `gallery.html` with base64-embedded images.

**Output**: `verification-output/{timestamp}/gallery.html` — open in browser to see all screenshots with AI evaluations, scores, and annotation diffs.

**Graceful degradation**: If no frontend detected or server won't start, skips visual capture with a warning — never blocks verification.


## Grading & Scoring

Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/quality-gates/references/unified-scoring-framework.md")` for dimensions, weights, grade thresholds, and improvement prioritization. Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/quality-model.md")` for verify-specific extensions (Visual dimension). Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/grading-rubric.md")` for per-agent scoring criteria.

### Dimension-Level Blockers (ork-rubric/1.0)

Composite is necessary but not sufficient — a strong composite can average away a critical dimension. In Phase 4 (Nuanced Grading), read per-dimension thresholds from `${CLAUDE_PLUGIN_ROOT}/skills/verify/rubric.json` (schema: `${CLAUDE_PLUGIN_ROOT}/skills/shared/rubric.schema.json`): security `min_blocker` 4.0, compliance `min_pass` 6.0.

- **ANY dimension below its `min_blocker` → verdict is BLOCKED regardless of composite.** Report it explicitly: `Security 3.2/10 (CRITICAL BLOCKER — below min_blocker 4.0)`.
- A dimension below its `min_pass` (but at/above `min_blocker`) caps the verdict at IMPROVEMENTS RECOMMENDED — it cannot grade READY FOR MERGE.
- Blocked verdicts list every tripped dimension first, each with the fix needed to clear it.
- A project `.claude/policies/verification-policy.json` (see Policy-as-Code) may tighten these thresholds, never loosen them below the rubric defaults.

Threshold bands and reporting format: `references/grading-rubric.md` ("Dimension-Level Blockers" section).


## Streak Gate (consecutive-pass mode)

A single green is not proof — flaky and order-dependent suites pass once and fail the next run. With `--streak=N`, verify declares **READY FOR MERGE only after N consecutive passing runs**, resetting the count to 0 on any non-ready verdict. The count persists across independent runs in `.claude/chain/verify-streak.json`, keyed by scope.

- `--streak=N` (N ≥ 2; 3 is the sensible default). Absent ⇒ today's single pass/fail behavior, unchanged. Target may also come from `.claude/policies/verification-policy.json` (`"streak_target"`); the flag wins.
- The gate sits **above** the verdict — it never loosens a blocker, it only withholds "done" until the streak is met. Each run re-executes the *actual* tests (no cached passes — that independence is the whole point).
- Reset rule: **any** non-`READY FOR MERGE` verdict (tripped blocker, failing test, or IMPROVEMENTS RECOMMENDED) zeroes the count. No partial credit.
- The verdict surfaces the count: `STREAK 2/3 — one more green to merge`, or `streak reset to 0/3 (security 3.2 < 4.0)`.
- This is the native mechanism the `prd-to-goal` quality-streak recipe (#2539) leans on. Pair it with a `/goal` loop, but **`rm` the ledger first** — `/goal` reads `until` before the turn's verify, so a stale `met:true` exits with zero runs (see streak-gate.md "Stale-ledger guard").

Full protocol — ledger schema, run loop, `/goal` wiring, and `/ork:cover` reuse: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/streak-gate.md")`.


## Evidence & Test Execution

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/rules/evidence-collection.md")` for git commands, test execution patterns, metrics tracking, and post-verification feedback.


## Policy-as-Code

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/policy-as-code.md")` for configuration.

Define verification rules in `.claude/policies/verification-policy.json`:

```json
{
  "thresholds": {
    "composite_minimum": 6.0,
    "security_minimum": 7.0,
    "coverage_minimum": 70
  },
  "blocking_rules": [
    {"dimension": "security", "below": 5.0, "action": "block"}
  ]
}
```


## Verification Manifest (VERIFIED vs CLAIMED)

Agent scores, tool summaries, and every "X is clean / passing / fixed" sentence are **claims** until the lead re-runs the proof. Before the verdict, build a **Verification Manifest** marking every *load-bearing* claim ✅ VERIFIED (lead ran it fresh — cites `command · exit · key line`), 🟡 CLAIMED (an agent/tool/doc asserted it, not re-run), ⬜ UNCHECKED, or ⚪ WAIVED (accepted non-blocking, with a reason). An agent's "PASS" copied into the report is still CLAIMED — VERIFIED means *the lead* ran it; a sub-agent's number (price, model-id, count) is CLAIMED until checked against source.

> **Verdict rule:** any load-bearing claim still 🟡 CLAIMED or ⬜ UNCHECKED **caps the verdict at IMPROVEMENTS RECOMMENDED** (never READY FOR MERGE) until it is ✅ VERIFIED or ⚪ WAIVED — this stacks with the dimension-level blockers (both must clear), and under `--streak=N` it resets the streak.

Protocol — claim sources, build step, template, and anti-patterns (laundering, optimism-marking, omission): `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/verification-manifest.md")`.

### Reachability: is the green load-bearing? (REACHED vs UNREACHED)

Provenance answers *who ran it*. It does not answer *whether the pass means anything*. A row reading `✅ VERIFIED · pytest · exit 0 · 214 passed` is honest and can still be worthless, because a suite passing does not prove the suite **reached** the change. A validator shipped 2026-07-19 was fully defined, fully tested, and never called at its call site: every test passed against the old path.

For every test the diff **adds or modifies**, the manifest carries a second mark:

| Mark | Meaning |
|---|---|
| 🟢 **REACHED** | The run showed the test **fail without the change and pass with it**, citing both commands. |
| 🟡 **UNREACHED** | The test is green but has never been seen to fail. Not evidence. |
| ⚪ **WAIVED** | Deliberately accepted with a one-line reason. |

> **Verdict rule:** a test added or modified by this diff that is 🟡 UNREACHED **caps the verdict at IMPROVEMENTS RECOMMENDED** until the proof is shown or the row is ⚪ WAIVED. Stacks with the provenance cap and the dimension blockers — all must clear. Under `--streak=N` it resets the streak.

Two ordering rules make the proof safe, and both come from real damage: **commit before mutating** (`git checkout --` restores to HEAD, so mutating uncommitted work destroys the change on restore), and **mutate the call site, not the new unit** (mutating the unit proves the unit's tests work, and leaves a dead call site undetected).

**This skill does not perform the mutation** — it writes no test files and edits no source. The proof is produced upstream by `/ork:implement` or `/ork:cover` and graded here; absent a proof, the row is 🟡 UNREACHED and the verdict is capped.

Protocol — scope, the 5-step proof, what makes a mutation load-bearing, template, and anti-patterns (coverage-as-proof, batch proof, cosmetic mutation): `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/reachability-proof.md")`.


## Report Format

Load details: `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/report-template.md")` for full format. Summary:

```markdown
# Feature Verification Report

**Composite Score: [N.N]/10** (Grade: [LETTER])

## Verdict
**[READY FOR MERGE | IMPROVEMENTS RECOMMENDED | BLOCKED]**

[--streak=N mode only: **STREAK [current]/[target]** — READY FOR MERGE requires the full target; any non-ready run resets to 0.]

## Verification Manifest
[✅ VERIFIED · 🟡 CLAIMED · ⬜ UNCHECKED · ⚪ WAIVED — any load-bearing 🟡/⬜ caps the verdict below READY FOR MERGE]
[Reached: 🟢 REACHED · 🟡 UNREACHED · n/a — any 🟡 on a test this diff added/modified also caps the verdict]
| # | Load-bearing claim | Asserted by | Provenance | Reached | Evidence (cmd · exit · key line) |
```

> **Push notifications (CC 2.1.110+):** Verify runs for >5 min are common on complex changes. When the final verdict is ready, call `PushNotification` to alert the user — they likely walked away from the terminal. Requires Remote Control with "Push when Claude decides" config; fails silently for users without it.
>
> ```python
> PushNotification(
>   message=f"ork:verify complete — {verdict} · {score}/10 · {blockers_count} blockers",
>   status="proactive"
> )
> ```


## References

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/references/<file>")`:

| File | Content |
|------|---------|
| `verification-phases.md` | 8-phase workflow, agent spawn definitions, Agent Teams mode |
| `visual-capture.md` | Phase 2.5: screenshot capture, AI vision, gallery generation |
| `quality-model.md` | Scoring dimensions and weights (8 unified) |
| `grading-rubric.md` | Per-agent scoring criteria |
| `report-template.md` | Full report format with visual evidence section |
| `verification-manifest.md` | VERIFIED‑vs‑CLAIMED provenance ledger: states, verdict rule, claim sources, template, anti‑patterns |
| `reachability-proof.md` | REACHED‑vs‑UNREACHED: the mutate→red→restore→green proof, commit-first and call-site rules, verdict cap, anti‑patterns |
| `alternative-comparison.md` | Approach comparison template |
| `orchestration-mode.md` | Agent Teams vs Task Tool |
| `policy-as-code.md` | Verification policy configuration |
| `verification-checklist.md` | Pre-flight checklist |
| `streak-gate.md` | `--streak=N` consecutive-pass gate: ledger schema, reset rule, `/goal` wiring, cover reuse |

## Rules

Load on demand with `Read("${CLAUDE_PLUGIN_ROOT}/skills/verify/rules/<file>")`:

| File | Content |
|------|---------|
| `scoring-rubric.md` | Composite scoring, grades, verdicts |
| `evidence-collection.md` | Evidence gathering and test patterns |

### Verification Gate (Cross-Cutting)

Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/verification-gate.md")` — the minimum 5-step gate that applies to ALL completion claims across all skills. This is non-negotiable: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

### Anti-Sycophancy Protocol

Load `Read("${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/anti-sycophancy.md")` — all verification agents report findings directly without performative agreement. "Should be fine" is not evidence. "Tests pass (exit 0, 47/47)" is.

### Agent Status Protocol

All verification agents MUST report using the standardized protocol: `Read("${CLAUDE_PLUGIN_ROOT}/agents/shared/status-protocol.md")`. Never report DONE if concerns exist. Never silently produce work you're unsure about.


## Agent Coordination

### SendMessage (Cross-Agent Findings)

When a security agent finds a critical issue, share it with other verification agents:

```python
SendMessage(to="test-generator", message="Security: SQL injection in user_service.py:88 — add parameterized query test")
SendMessage(to="code-quality-reviewer", message="Security finding at user_service.py:88 — flag in review")
```

### Skill Chain

After verification, chain to commit if all gates pass:

```python
TaskCreate(subject="Commit verified changes", activeForm="Committing")
TaskUpdate(taskId=commit_id, addBlockedBy=[verify_task_id])
# Then: /ork:commit
```

> **Session recovery (CC 2.1.108+):** After idle periods or interruptions, use `/recap` to restore conversational context alongside checkpoint-resume state. Enabled by default since CC 2.1.110 (even with telemetry disabled).

## Quality Bar

Done means all of these hold:
- verdict is exactly one of READY FOR MERGE / IMPROVEMENTS RECOMMENDED / BLOCKED, with the composite and every dimension score cited
- every load-bearing "passing/clean/fixed" claim sits in the Verification Manifest marked VERIFIED (lead re-ran, cites command · exit · key line), CLAIMED, UNCHECKED, or WAIVED
- test evidence is the actual runner summary line (command, exit code, pass count) — never paraphrase
- every test the diff added or modified carries a Reached mark: REACHED cites the failing run AND the passing run; a green-only row is UNREACHED, not evidence
- any dimension below its `min_blocker` is reported BLOCKED regardless of composite
- READY FOR MERGE only when no load-bearing claim is still CLAIMED/UNCHECKED, no diff-added test is still UNREACHED (and under `--streak=N`, the full streak is met)

## Related Skills

- `ork:implement` - Full implementation with verification
- `ork:review-pr` - PR-specific verification
- `testing-unit` / `testing-integration` / `testing-e2e` - Test execution patterns
- `ork:quality-gates` - Quality gate patterns
- `browser-tools` - Browser automation for visual capture


**Version:** 4.6.0 (July 2026) — Added the Reachability Proof (REACHED vs UNREACHED): the manifest's second axis. Provenance grades who ran a claim; reachability grades whether the green means anything. A test the diff added that has never been seen to fail caps the verdict below READY FOR MERGE
**Version:** 4.5.0 (July 2026) — Added the Verification Manifest (VERIFIED vs CLAIMED) — a load-bearing-claim provenance ledger that caps the verdict below READY FOR MERGE until unverified claims are re-run or waived
**Version:** 4.4.0 (June 2026) — Added `--streak=N` consecutive-pass gate (#2540)
