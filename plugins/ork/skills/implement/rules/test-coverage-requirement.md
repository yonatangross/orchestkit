---
title: Block completion if new code has zero test coverage — tests are mandatory for every implementation
impact: HIGH
impactDescription: "Shipping code with 0% test coverage means regressions go undetected; the Phase 9 gate exists but agents skip it when not enforced per-task"
tags: [testing, coverage, gate, phase-5, phase-9, quality]
---

## Test Coverage Requirement

Every task in Phase 5 must produce both implementation code AND matching tests. The test-generator agent is not optional — it runs in parallel with implementation agents and its output is required before Phase 6.

### Problem

Claude often treats tests as a "nice to have" and moves to integration/documentation phases without verifying that test-generator actually produced output. The Phase 9 gate catches this too late.

### Per-Task Enforcement

Each Phase 5 task must include a test verification step:

```python
# After each implementation agent completes:
task_output = TaskOutput(task_id)

# Check: does the output include test files?
Grep(pattern="describe\\(|it\\(|test\\(|def test_", glob="**/*.test.*")
Grep(pattern="def test_|class Test", glob="**/test_*.py")

# If 0 matches for new code paths → BLOCK Phase 6 entry
```

**Incorrect — proceed without tests:**
```python
# Phase 5: Implementation
Agent(subagent_type="backend-system-architect",
  prompt="Implement user auth endpoints", run_in_background=True)
Agent(subagent_type="frontend-ui-developer",
  prompt="Implement login form", run_in_background=True)
# No test-generator agent spawned
# Phase 6: "Let's verify integration..." ← no tests exist to run
```

**Correct — tests are parallel and mandatory:**
```python
# Phase 5: Implementation + Tests (parallel)
Agent(subagent_type="backend-system-architect",
  prompt="Implement user auth endpoints", run_in_background=True)
Agent(subagent_type="frontend-ui-developer",
  prompt="Implement login form", run_in_background=True)
Agent(subagent_type="test-generator",
  prompt="Generate tests for user auth: unit tests for endpoints,
  integration tests for auth flow, component tests for login form.
  Change types: API endpoint + UI component (see Test Requirements Matrix)",
  run_in_background=True)

# GATE: Verify before Phase 6
for agent in [backend, frontend, test_gen]:
    output = TaskOutput(agent.task_id)

if test_file_count == 0:
    # DO NOT proceed — return to Phase 5
    Agent(subagent_type="test-generator",
      prompt="BLOCKED: No tests found. Generate tests for: {files_created}")
```

### Change Type to Test Mapping

Always reference the Test Requirements Matrix from SKILL.md when spawning test-generator:

| Change | Minimum Tests |
|--------|--------------|
| API endpoint | 1 unit + 1 integration |
| DB migration | 1 migration test |
| UI component | 1 unit + 1 snapshot |
| Business logic | 2 unit tests |

### Key Rules

- Spawn test-generator in the same message as implementation agents
- Verify test output before advancing to Phase 6
- If test-generator fails, re-run it — do not skip
- Include test file paths in the `05-implementation.json` handoff
