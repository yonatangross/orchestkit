---
description: "Generate and run comprehensive test suites — unit tests, integration tests with real services (testcontainers/docker-compose), and Playwright E2E tests. Analyzes coverage gaps, spawns parallel test-generator agents per tier, runs tests, and heals failures (max 3 iterations). Use when generating tests for existing code, improving coverage after implementation, or creating a full test suite from scratch. Chains naturally after /ork:implement. Do NOT use for verifying/grading existing tests (use /ork:verify) or running tests without generation (use npm test directly)."
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, TaskStop, ToolSearch, CronCreate, CronDelete, Monitor, PushNotification, mcp__memory__search_nodes, mcp__context7__resolve-library-id, mcp__context7__query-docs]
---

# Auto-generated from skills/cover/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Cover — Test Suite Generator

Generate comprehensive test suites for existing code with real-service integration testing and automated failure healing.

> **Note:** If `disableSkillShellExecution` is enabled (CC 2.1.91), the precondition check for vitest/jest won't run. Verify a test runner is installed before proceeding: `npx vitest --version` or `npx jest --version`.

## Quick Start

```bash
/ork:cover authentication flow
/ork:cover --model=opus payment processing
/ork:cover --tier=unit,integration user service
/ork:cover --real-services checkout pipeline
```

## Argument Resolution

```python
SCOPE = "$ARGUMENTS"  # e.g., "authentication flow"

# Flag parsing
MODEL_OVERRIDE = None
TIERS = ["unit", "integration", "e2e"]  # default: all three
REAL_SERVICES = False

for token in "$ARGUMENTS".split():
    if token.startswith("--model="):
        MODEL_OVERRIDE = token.split("=", 1)[1]
        SCOPE = SCOPE.replace(token, "").strip()
    elif token.startswith("--tier="):
        TIERS = token.split("=", 1)[1].split(",")
        SCOPE = SCOPE.replace(token, "").strip()
    elif token == "--real-services":
        REAL_SERVICES = True
        SCOPE = SCOPE.replace(token, "").strip()
```


## Step -0.5: Effort-Aware Coverage Scaling (CC 2.1.76, env var since 2.1.120)

Read `${CLAUDE_EFFORT}` (CC 2.1.120+) first; explicit `--effort=` token wins as override. Default `high` when CC < 2.1.120 and no flag. Pattern matches assess + explore (#1540). Scale test generation depth:

| Effort Level | Tiers Generated | Agents | Heal Iterations |
|-------------|----------------|--------|-----------------|
| **low** | Unit only | 1 agent | 1 max |
| **medium** | Unit + Integration | 2 agents | 2 max |
| **high** (default) | Unit + Integration + E2E | 3 agents | 3 max |
| **xhigh** (Opus 4.8, CC 2.1.111+) | Unit + Integration + E2E | 3 agents | 4 max (one extra heal pass) |

> **Override:** Explicit `--tier=` flag or user selection overrides `/effort` downscaling.

## Step -1: MCP Probe + Resume Check

```python
# Probe MCPs (parallel):
# memory is alwaysLoad in .mcp.json (CC 2.1.121+, #1541) — probe below kept as fallback for older CC:
ToolSearch(query="select:mcp__memory__search_nodes")
ToolSearch(query="select:mcp__context7__resolve-library-id")

Write(".claude/chain/capabilities.json", {
  "memory": <true if found>,
  "context7": <true if found>,
  "skill": "cover",
  "timestamp": now()
})

# Resume check:
Read(".claude/chain/state.json")
# If exists and skill == "cover": resume from current_phase
# Otherwise: initialize state
```


## Step 0: Scope & Tier Selection

```python
AskUserQuestion(
  questions=[
    {
      "question": "What test tiers should I generate?",
      "header": "Test Tiers",
      "options": [
        {"label": "Full coverage (Recommended)", "description": "Unit + Integration (real services) + E2E", "preview": "```\nFull Coverage\n─────────────\n  Unit            Integration       E2E\n  ┌─────────┐    ┌─────────────┐  ┌──────────┐\n  │ AAA     │    │ Real DB     │  │Playwright│\n  │ Mocks   │    │ Real APIs   │  │Page obj  │\n  │ Factory │    │ Testcontain │  │A11y      │\n  └─────────┘    └─────────────┘  └──────────┘\n  3 parallel test-generator agents\n```"},
        {"label": "Unit + Integration", "description": "Skip E2E, focus on logic and service boundaries", "preview": "```\nUnit + Integration\n──────────────────\n  Unit tests for business logic\n  Integration tests at API boundaries\n  Real services if docker-compose found\n  Skip: browser automation\n```"},
        {"label": "Unit only", "description": "Fast isolated tests for business logic", "preview": "```\nUnit Only (~2 min)\n──────────────────\n  AAA pattern tests\n  MSW/VCR mocking\n  Factory-based data\n  Coverage gap analysis\n  Skip: real services, browser\n```"},
        {"label": "E2E only", "description": "Playwright browser tests", "preview": "```\nE2E Only\n────────\n  Playwright page objects\n  User flow tests\n  Visual regression\n  Accessibility (axe-core)\n```"}
      ],
      "multiSelect": false
    },
    {
      "question": "Healing strategy for failing tests?",
      "header": "Failure Handling",
      "options": [
        {"label": "Auto-heal (Recommended)", "description": "Fix failing tests up to 3 iterations"},
        {"label": "Generate only", "description": "Write tests, report failures, don't fix"},
        {"label": "Strict", "description": "All tests must pass or abort"}
      ],
      "multiSelect": false
    }
  ]
)
```

Override TIERS based on selection. Skip this step if `--tier=` flag was provided.


## Task Management (MANDATORY)

```python
# 1. Create main task IMMEDIATELY
TaskCreate(subject=f"Cover: {SCOPE}", description="Generate comprehensive test suite with real-service testing", activeForm=f"Generating tests for {SCOPE}")

# 2. Create subtasks for each phase
TaskCreate(subject="Discover scope and detect frameworks", activeForm="Discovering test scope")    # id=2
TaskCreate(subject="Analyze coverage gaps", activeForm="Analyzing coverage gaps")                  # id=3
TaskCreate(subject="Generate tests (parallel per tier)", activeForm="Generating tests")            # id=4
TaskCreate(subject="Execute generated tests", activeForm="Running tests")                          # id=5
TaskCreate(subject="Heal failing tests", activeForm="Healing test failures")                       # id=6
TaskCreate(subject="Generate coverage report", activeForm="Generating report")                     # id=7

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Analysis needs discovery first
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Generation needs gap map
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Execution needs generated tests
TaskUpdate(taskId="6", addBlockedBy=["5"])  # Healing needs test results
TaskUpdate(taskId="7", addBlockedBy=["6"])  # Report needs healed suite

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```


## 6-Phase Workflow

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Discovery** | Detect frameworks, scan scope, find untested code | Framework map, file list |
| **2. Coverage Analysis** | Run existing tests, map gaps per tier | Coverage baseline, gap map |
| **3. Generation** | Parallel test-generator agents per tier | Test files created |
| **4. Execution** | Run all generated tests | Pass/fail results |
| **5. Heal** | Fix failures, re-run (max 3 iterations) | Green test suite |
| **6. Report** | Coverage delta, test count, summary | Coverage report |

### Phase Handoffs

| After Phase | Handoff File | Key Outputs |
|-------------|-------------|-------------|
| 1. Discovery | `01-cover-discovery.json` | Frameworks, scope files, tier plan |
| 2. Analysis | `02-cover-analysis.json` | Baseline coverage, gap map |
| 3. Generation | `03-cover-generation.json` | Files created, test count per tier |
| 5. Heal | `05-cover-healed.json` | Final pass/fail, iterations used |


### Phase 1: Discovery

Detect the project's test infrastructure and scope the work.

```python
# PARALLEL — all in ONE message:
# 1. Framework detection (hook handles this, but also scan manually)
Grep(pattern="vitest|jest|mocha|playwright|cypress", glob="package.json", output_mode="content")
Grep(pattern="pytest|unittest|hypothesis", glob="pyproject.toml", output_mode="content")
Grep(pattern="pytest|unittest|hypothesis", glob="requirements*.txt", output_mode="content")

# 2. Real-service infrastructure
Glob(pattern="**/docker-compose*.yml")
Glob(pattern="**/testcontainers*")
Grep(pattern="testcontainers", glob="**/package.json", output_mode="content")
Grep(pattern="testcontainers", glob="**/requirements*.txt", output_mode="content")

# 3. Existing test structure
Glob(pattern="**/tests/**/*.test.*")
Glob(pattern="**/tests/**/*.spec.*")
Glob(pattern="**/__tests__/**/*")
Glob(pattern="**/test_*.py")

# 4. Scope files (what to test)
# If SCOPE specified, find matching source files
Grep(pattern=SCOPE, output_mode="files_with_matches")
```

**Real-service decision:**
- `docker-compose*.yml` found → integration tests use real services
- `testcontainers` in deps → use testcontainers for isolated service instances
- Neither found + `--real-services` flag → error: "No docker-compose or testcontainers found. Install testcontainers or remove --real-services flag."
- Neither found, no flag → integration tests use mocks (MSW/VCR)

Load real-service detection details: `Read("${CLAUDE_SKILL_DIR}/references/real-service-detection.md")`

### Phase 2: Coverage Analysis

Run existing tests and identify gaps.

```python
# Detect and run coverage command
# TypeScript: npx vitest run --coverage --reporter=json
# Python: pytest --cov=<scope> --cov-report=json
# Go: go test -coverprofile=coverage.out ./...

# Parse coverage output to identify:
# 1. Files with 0% coverage (priority targets)
# 2. Files below threshold (default 70%)
# 3. Uncovered functions/methods
# 4. Untested edge cases (error paths, boundary conditions)
```

Output coverage baseline to user immediately (progressive output).

### Phase 3: Generation (Parallel Agents)

Spawn test-generator agents per tier. Launch ALL in ONE message with `run_in_background=true`.

> ⚠️ **`isolation="worktree"` does NOT reliably isolate parallel agents in
> CC Opus 4.7.** Observed: spawning multiple agents with that param thrashes
> the PRIMARY worktree's HEAD via sequential `git checkout`, cutting agents
> off at ~60 tool uses. Tracked at Yonatan-HQ/platform#3224.
>
> **Use the manual pre-create pattern instead.** Create one worktree per
> agent BEFORE spawning (`git worktree add ../<repo>-<tier> -b feat/<slug>-<tier> origin/dev`),
> then make `FIRST: cd <worktree-path>` the first Bash call in each agent
> prompt. Empirical: 4–22 tool-uses per agent (vs 60–86 with broken
> isolation), zero cutoffs across M164 Wave 2/3 + M170 sub-agents.
>
> Full pattern + helper function + prompt-constraint template:
> `Read("/Users/yonatangross/coding/yonatangross/orchestkit/src/skills/implement/references/manual-worktree-pattern.md")`
> (cross-referenced from `/ork:implement` — same doc applies here).

```python
# Pre-create worktrees BEFORE the agent batch (lead-thread responsibility).
# One worktree per tier (unit / integration / e2e) so they don't conflict.
import subprocess
REPO_ROOT = Bash("git rev-parse --show-toplevel").stdout.strip()
BASE_REF = "origin/dev"  # or "origin/main" depending on repo convention
TIER_WORKTREES = {}
for tier in TIERS:
    wt_path = f"../<repo>-cover-{tier}"  # adjust per your repo
    branch = f"feat/cover-{SCOPE_SLUG}-{tier}"
    Bash(f"git worktree add {wt_path} -b {branch} {BASE_REF}")
    TIER_WORKTREES[tier] = wt_path

# Unit tests agent (manual pre-create pattern)
if "unit" in TIERS:
    Agent(
        subagent_type="test-generator",
        prompt=f"""FIRST: cd {TIER_WORKTREES["unit"]}

        Generate unit tests for: {SCOPE}
        Coverage gaps: {gap_map.unit_gaps}
        Framework: {detected_framework}
        Existing tests: {existing_test_files}

        Focus on:
        - AAA pattern (Arrange-Act-Assert)
        - Parametrized tests for multiple inputs
        - MSW/VCR for HTTP mocking (never mock fetch directly)
        - Factory-based test data (FactoryBoy/faker-js)
        - Edge cases: empty input, errors, timeouts, boundary values
        - Target: 90%+ business logic coverage

        Do NOT use `isolation="worktree"` — this worktree was pre-created
        by the lead. Every Bash call should start from {TIER_WORKTREES["unit"]}.""",
        run_in_background=True,
        max_turns=50,
        model=MODEL_OVERRIDE
    )

# Integration + E2E agents follow the same pattern:
# - Pre-create worktree at TIER_WORKTREES["integration"] / TIER_WORKTREES["e2e"]
# - Agent prompt FIRST line: `cd <path>`
# - subagent_type="test-generator", run_in_background=True (no isolation kwarg)
# - Integration focus: API endpoints (Supertest/httpx), real DB, contract tests (Pact), Zod schema validation
# - E2E focus: Playwright, semantic locators, Page Object Model, axe-core a11y, visual regression
#
# Special case — emulate (Vercel Labs stateful API emulation):
# When integration tests need GitHub/Stripe/Resend/Okta/etc. emulated
# (HMAC webhooks, parallel port isolation, full config from scratch),
# spawn emulate-engineer instead of test-generator for that tier:
# - subagent_type="emulate-engineer" (same manual-worktree pattern)
# - Pairs with emulate-seed skill for seed YAML patterns
```

Output each agent's results **as soon as it returns** — don't wait for all agents.

> **Focus mode (CC 2.1.101):** In focus mode, include the full coverage report (before/after delta, test count per tier, files created) in your final message.

### Phase 4: Execution

Run all generated tests and collect results.

```python
# Run test commands per tier (PARALLEL if independent):
# Unit: npx vitest run tests/unit/ OR pytest tests/unit/
# Integration: npx vitest run tests/integration/ OR pytest tests/integration/
# E2E: npx playwright test

# Collect: pass count, fail count, error details, coverage delta
```

### Phase 5: Heal Loop

Fix failing tests iteratively. Max 3 iterations to prevent infinite loops.

```python
for iteration in range(3):
    if all_tests_pass:
        break

    # For each failing test:
    # 1. Read the test file and the source code it tests
    # 2. Analyze the failure (assertion error? import error? timeout?)
    # 3. Fix the test (not the source code — tests only)
    # 4. Re-run the fixed tests

    # Common fixes:
    # - Wrong assertions (expected value mismatch)
    # - Missing imports or setup
    # - Stale selectors in E2E tests
    # - Race conditions (add proper waits)
    # - Mock configuration errors
```

Load heal strategy details: `Read("${CLAUDE_SKILL_DIR}/references/heal-loop-strategy.md")`

**Boundary: heal fixes TESTS, not source code.** If a test fails because the source code has a bug, report it — don't silently fix production code.

### Phase 6: Report

Generate coverage report with before/after comparison.

Full report layout (baseline→after table, tests-generated counts, heal iterations, files created, remaining gaps, next-steps commands): `Read("${CLAUDE_SKILL_DIR}/references/coverage-report-template.md")`.

### PushNotification on Completion (CC 2.1.110+)

Full `/ork:cover` runs (unit + integration + E2E with heal loop) take 15–45 min. After the Phase 6 report is assembled, call `PushNotification(title="ork:cover complete", body=f"{SCOPE}: {coverage_pct}% coverage · {tests_generated} tests · {heal_loops} heal iters")`. Full rule: `Read("/Users/yonatangross/coding/yonatangross/orchestkit/plugins/ork/skills/chain-patterns/rules/push-notification-on-completion.md")`.

### Coverage Drift Monitor (CC 2.1.71)

Optionally schedule weekly coverage drift detection:

```python
# Guard: Skip cron in headless/CI (CLAUDE_CODE_DISABLE_CRON)
# if env CLAUDE_CODE_DISABLE_CRON is set, run a single check instead
CronCreate(
  schedule="0 2 * * 0",
  prompt="Weekly coverage drift check for {SCOPE}: npm test -- --coverage.
    If coverage >= baseline → CronDelete.
    If coverage drops > 5% → alert with regression details and recommendation."
)
```


## Key Principles

- **Output limits (CC 2.1.77+):** Opus 4.6 defaults to 64k output tokens (128k upper bound). For large test suites, chunk generation across multiple agent turns if output approaches the limit.
- **Partial reads (CC 2.1.144+):** Read returns a `[PARTIAL view]` first page (not an error) on oversized files — re-read with explicit `offset`/`limit` so coverage analysis sees the whole file.
- **Tests only** — never modify production source code, only generate test files
- **Real services when available** — prefer testcontainers/docker-compose over mocks for integration tests because mock/prod divergence causes silent failures in production
- **Parallel generation** — spawn one test-generator agent per tier in ONE message
- **Heal, don't loop forever** — max 3 iterations, then report remaining failures
- **Progressive output** — show results as each agent completes
- **Factory over fixtures** — use FactoryBoy/faker-js for test data, not hardcoded values
- **Mock at network level** — MSW/VCR, never mock fetch/axios directly


## Agent Coordination

### Context Passing

Each test-generator agent receives: coverage gaps for its tier, test framework config, real-service infrastructure (testcontainers, docker-compose), and fixture patterns from the project.

### Monitor + Partial Results (CC 2.1.98)

Use `Monitor` for streaming test execution output from background agents:

```python
# Stream test suite output in real-time
Bash(command="npm test -- --coverage 2>&1", run_in_background=true)
Monitor(pid=test_task_id)  # Each line → notification
```

Full pattern reference (until-condition gates, partial-result salvage, `TaskOutput` vs `Monitor` decision): `Read("/Users/yonatangross/coding/yonatangross/orchestkit/plugins/ork/skills/chain-patterns/references/monitor-patterns.md")`.

**Partial results (CC 2.1.98):** If a test-generator crashes mid-generation, synthesize what it produced:

```python
for agent_result in test_gen_results:
    if "[PARTIAL RESULT]" in agent_result.output:
        # Agent crashed — check if it wrote any test files before dying
        partial_tests = Glob(pattern="**/tests/**/*.test.*", path=agent_result.worktree)
        if partial_tests:
            # 6 passing tests from a crashed agent > 0 tests
            # Copy partial tests to main worktree, run them in Phase 4
            for test_file in partial_tests:
                Bash(command=f"cp {test_file} {main_worktree}/{test_file}")
            # Flag as partial in report
```

### SendMessage (Test Healing)

When a generated test fails, the healer agent can request context from the generator:

```python
SendMessage(to="test-generator-unit", message="Test user_service_test.py:42 fails — TypeError on mock return. What's the expected shape?")
```

### Skill Chain

Standard chain: `implement → cover → verify → commit`. Use `addBlockedBy` between each.

### Verification Gate

Before claiming coverage is complete, apply: `Read("${CLAUDE_PLUGIN_ROOT}/skills/shared/rules/verification-gate.md")`. Run the coverage report fresh. "Should pass" is not evidence.

### Agent Status Protocol

All test-generator agents report using: `Read("${CLAUDE_PLUGIN_ROOT}/agents/shared/status-protocol.md")`. BLOCKED if tests can't be written due to missing interfaces. NEEDS_CONTEXT if test expectations are unclear.

## Related Skills

- `ork:implement` — generates tests during implementation (Phase 5); use `/ork:cover` after for deeper coverage
- `ork:verify` — grades existing tests 0-10; chain: `implement → cover → verify`
- `testing-unit` / `testing-integration` / `testing-e2e` — knowledge skills loaded by test-generator agents
- `ork:commit` — commit generated test files

> **Session recovery (CC 2.1.108+):** After idle periods or interruptions, use `/recap` to restore conversational context alongside checkpoint-resume state. Enabled by default since CC 2.1.110 (even with telemetry disabled).

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `real-service-detection.md` | Docker-compose/testcontainers detection, service startup, teardown |
| `heal-loop-strategy.md` | Failure classification, fix patterns, iteration budget |
| `coverage-report-template.md` | Report format, delta calculation, gap analysis |


**Version:** 1.2.0 (April 2026) — `${CLAUDE_EFFORT}` env var as primary effort signal (CC 2.1.120, #1540)
