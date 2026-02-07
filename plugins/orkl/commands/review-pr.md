---
description: "PR review with parallel specialized agents. Use when reviewing pull requests or code."
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__memory__search_nodes]
---

# Auto-generated from skills/review-pr/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Review PR

Deep code review using 6-7 parallel specialized agents.

## Quick Start

```bash
/review-pr 123
/review-pr feature-branch
```

> **Opus 4.6**: Parallel agents use native adaptive thinking for deeper analysis. Complexity-aware routing matches agent model to review difficulty.


## STEP 0: Verify User Intent with AskUserQuestion

**BEFORE creating tasks**, clarify review focus:

```python
AskUserQuestion(
  questions=[{
    "question": "What type of review do you need?",
    "header": "Focus",
    "options": [
      {"label": "Full review (Recommended)", "description": "Security + code quality + tests + architecture"},
      {"label": "Security focus", "description": "Prioritize security vulnerabilities"},
      {"label": "Performance focus", "description": "Focus on performance implications"},
      {"label": "Quick review", "description": "High-level review, skip deep analysis"}
    ],
    "multiSelect": false
  }]
)
```

**Based on answer, adjust workflow:**
- **Full review**: All 6-7 parallel agents
- **Security focus**: Prioritize security-auditor, reduce other agents
- **Performance focus**: Add performance-engineer agent
- **Quick review**: Single code-quality-reviewer agent only


## STEP 0b: Select Orchestration Mode

Choose **Agent Teams** (mesh — reviewers cross-reference findings) or **Task tool** (star — all report to lead):

1. `ORCHESTKIT_PREFER_TEAMS=1` → **Agent Teams mode**
2. Agent Teams unavailable → **Task tool mode** (default)
3. Otherwise: Full review with 6+ agents and cross-cutting concerns → recommend **Agent Teams**; Quick/focused review → **Task tool**

| Aspect | Task Tool | Agent Teams |
|--------|-----------|-------------|
| Communication | All reviewers report to lead | Reviewers cross-reference findings |
| Security + quality overlap | Lead deduplicates | security-auditor messages code-quality-reviewer directly |
| Cost | ~200K tokens | ~500K tokens |
| Best for | Quick/focused reviews | Full reviews with cross-cutting concerns |

> **Fallback:** If Agent Teams encounters issues, fall back to Task tool for remaining review.


## ⚠️ CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main review task IMMEDIATELY
TaskCreate(
  subject="Review PR #{number}",
  description="Comprehensive code review with parallel agents",
  activeForm="Reviewing PR #{number}"
)

# 2. Create subtasks for each phase
TaskCreate(subject="Gather PR information", activeForm="Gathering PR information")
TaskCreate(subject="Launch review agents", activeForm="Dispatching review agents")
TaskCreate(subject="Run validation checks", activeForm="Running validation checks")
TaskCreate(subject="Synthesize review", activeForm="Synthesizing review")
TaskCreate(subject="Submit review", activeForm="Submitting review")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```


## Phase 1: Gather PR Information

```bash
# Get PR details
gh pr view $ARGUMENTS --json title,body,files,additions,deletions,commits,author

# View the diff
gh pr diff $ARGUMENTS

# Check CI status
gh pr checks $ARGUMENTS
```

Identify:
- Total files changed
- Lines added/removed
- Affected domains (frontend, backend, AI)

## Tool Guidance

Use the right tools for PR review operations:

| Task | Use | Avoid |
|------|-----|-------|
| Fetch PR diff | `Bash: gh pr diff` | Reading all changed files individually |
| List changed files | `Bash: gh pr diff --name-only` | `bash find` |
| Search for patterns | `Grep(pattern="...", path="src/")` | `bash grep` |
| Read file content | `Read(file_path="...")` | `bash cat` |
| Check CI status | `Bash: gh pr checks` | Polling APIs |

## Parallel Execution Strategy

<use_parallel_tool_calls>
When gathering PR context, run independent operations in parallel:
- `gh pr view` (PR metadata) - independent
- `gh pr diff` (changed files) - independent
- `gh pr checks` (CI status) - independent

Spawn all three in ONE message. This cuts context-gathering time by 60%.

For agent-based review (Phase 3), all 6 agents are independent - launch them together.
</use_parallel_tool_calls>

## Phase 2: Skills Auto-Loading (CC 2.1.6)

**CC 2.1.6 auto-discovers skills** - no manual loading needed!

Relevant skills activated automatically:
- `code-review-playbook` - Review patterns, conventional comments
- `security-scanning` - OWASP, secrets, dependencies
- `type-safety-validation` - Zod, TypeScript strict

## Phase 3: Parallel Code Review (6 Agents)

Launch SIX specialized reviewers in ONE message with `run_in_background: true`:

| Agent | Focus Area |
|-------|-----------|
| code-quality-reviewer #1 | Readability, complexity, DRY |
| code-quality-reviewer #2 | Type safety, Zod, Pydantic |
| security-auditor | Security, secrets, injection |
| test-generator | Test coverage, edge cases |
| backend-system-architect | API, async, transactions |
| frontend-ui-developer | React 19, hooks, a11y |

```python
# PARALLEL - All 6 agents in ONE message
Task(
  description="Review code quality",
  subagent_type="code-quality-reviewer",
  prompt="""CODE QUALITY REVIEW for PR $ARGUMENTS

  Review code readability and maintainability:
  1. Naming conventions and clarity
  2. Function/method complexity (cyclomatic < 10)
  3. DRY violations and code duplication
  4. SOLID principles adherence

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [brief list]"
  """,
  run_in_background=True
)
Task(
  description="Review type safety",
  subagent_type="code-quality-reviewer",
  prompt="""TYPE SAFETY REVIEW for PR $ARGUMENTS

  Review type safety and validation:
  1. TypeScript strict mode compliance
  2. Zod/Pydantic schema usage
  3. No `any` types or type assertions
  4. Exhaustive switch/union handling

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] type issues: [brief list]"
  """,
  run_in_background=True
)
Task(
  description="Security audit PR",
  subagent_type="security-auditor",
  prompt="""SECURITY REVIEW for PR $ARGUMENTS

  Security audit:
  1. Secrets/credentials in code
  2. Injection vulnerabilities (SQL, XSS)
  3. Authentication/authorization checks
  4. Dependency vulnerabilities

  SUMMARY: End with: "RESULT: [PASS|WARN|BLOCK] - [N] findings: [severity summary]"
  """,
  run_in_background=True
)
Task(
  description="Review test coverage",
  subagent_type="test-generator",
  prompt="""TEST COVERAGE REVIEW for PR $ARGUMENTS

  Review test quality:
  1. Test coverage for changed code
  2. Edge cases and error paths tested
  3. Meaningful assertions (not just truthy)
  4. No flaky tests (timing, external deps)

  SUMMARY: End with: "RESULT: [N]% coverage, [M] gaps - [key missing test]"
  """,
  run_in_background=True
)
Task(
  description="Review backend code",
  subagent_type="backend-system-architect",
  prompt="""BACKEND REVIEW for PR $ARGUMENTS

  Review backend code:
  1. API design and REST conventions
  2. Async/await patterns and error handling
  3. Database query efficiency (N+1)
  4. Transaction boundaries

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [key concern]"
  """,
  run_in_background=True
)
Task(
  description="Review frontend code",
  subagent_type="frontend-ui-developer",
  prompt="""FRONTEND REVIEW for PR $ARGUMENTS

  Review frontend code:
  1. React 19 patterns (hooks, server components)
  2. State management correctness
  3. Accessibility (a11y) compliance
  4. Performance (memoization, lazy loading)

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] issues: [key concern]"
  """,
  run_in_background=True
)
```

### Phase 3 — Agent Teams Alternative

In Agent Teams mode, form a review team where reviewers cross-reference findings directly:

```python
TeamCreate(team_name="review-pr-{number}", description="Review PR #{number}")

Task(subagent_type="code-quality-reviewer", name="quality-reviewer",
     team_name="review-pr-{number}",
     prompt="""Review code quality and type safety for PR #{number}.
     When you find patterns that overlap with security concerns,
     message security-reviewer with the finding.
     When you find test gaps, message test-reviewer.""")

Task(subagent_type="security-auditor", name="security-reviewer",
     team_name="review-pr-{number}",
     prompt="""Security audit for PR #{number}.
     Cross-reference with quality-reviewer for injection risks in code patterns.
     When you find issues, message the responsible reviewer (backend-reviewer
     for API issues, frontend-reviewer for XSS).""")

Task(subagent_type="test-generator", name="test-reviewer",
     team_name="review-pr-{number}",
     prompt="""Review test coverage for PR #{number}.
     When quality-reviewer flags test gaps, verify and suggest specific tests.
     Message backend-reviewer or frontend-reviewer with test requirements.""")

Task(subagent_type="backend-system-architect", name="backend-reviewer",
     team_name="review-pr-{number}",
     prompt="""Review backend code for PR #{number}.
     When security-reviewer flags API issues, validate and suggest fixes.
     Share API pattern findings with frontend-reviewer for consistency.""")

Task(subagent_type="frontend-ui-developer", name="frontend-reviewer",
     team_name="review-pr-{number}",
     prompt="""Review frontend code for PR #{number}.
     When backend-reviewer shares API patterns, verify frontend matches.
     When security-reviewer flags XSS risks, validate and suggest fixes.""")
```

**Team teardown** after synthesis:
```python
# After collecting all findings and producing the review
SendMessage(type="shutdown_request", recipient="quality-reviewer", content="Review complete")
SendMessage(type="shutdown_request", recipient="security-reviewer", content="Review complete")
SendMessage(type="shutdown_request", recipient="test-reviewer", content="Review complete")
SendMessage(type="shutdown_request", recipient="backend-reviewer", content="Review complete")
SendMessage(type="shutdown_request", recipient="frontend-reviewer", content="Review complete")
TeamDelete()
```

> **Fallback:** If team formation fails, use standard Phase 3 Task spawns above.


### Optional: AI Code Review

If PR includes AI/ML code, add 7th agent:

```python
Task(
  description="Review LLM integration",
  subagent_type="llm-integrator",
  prompt="""LLM CODE REVIEW for PR $ARGUMENTS

  Review AI/LLM integration:
  1. Prompt injection prevention
  2. Token limit handling
  3. Caching strategy
  4. Error handling and fallbacks

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] LLM issues: [key concern]"
  """,
  run_in_background=True
)
```

## Phase 4: Run Validation

```bash
# Backend
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run pytest tests/unit/ -v --tb=short

# Frontend
cd frontend
npm run format:check
npm run lint
npm run typecheck
npm run test
```

## Phase 5: Synthesize Review

Combine all agent feedback into structured report:

```markdown
# PR Review: #$ARGUMENTS

## Summary
[1-2 sentence overview]

## Code Quality
| Area | Status | Notes |
|------|--------|-------|
| Readability | // | [notes] |
| Type Safety | // | [notes] |
| Test Coverage | // | [X%] |

## Security
| Check | Status |
|-------|--------|
| Secrets | / |
| Input Validation | / |
| Dependencies | / |

## Blockers (Must Fix)
- [if any]

## Suggestions (Non-Blocking)
- [improvements]
```

## Phase 6: Submit Review

```bash
# Approve
gh pr review $ARGUMENTS --approve -b "Review message"

# Request changes
gh pr review $ARGUMENTS --request-changes -b "Review message"
```

## CC 2.1.20 Enhancements

### PR Status Enrichment

The `pr-status-enricher` hook automatically detects open PRs at session start and sets:
- `ORCHESTKIT_PR_URL` - PR URL for quick reference
- `ORCHESTKIT_PR_STATE` - PR state (OPEN, MERGED, CLOSED)

## CC 2.1.27+ Enhancements

### Session Resume with PR Context

Sessions are automatically linked when reviewing PRs. Resume later with full context:

```bash
# Resume with PR context preserved (diff, comments, CI status)
claude --from-pr 123
claude --from-pr https://github.com/org/repo/pull/123
```

This preserves:
- Full PR diff still available
- Review comments and threads loaded
- CI/check status fresh
- Perfect for multi-session deep reviews

### Task Metrics (CC 2.1.30)

Task tool results now include efficiency metrics. After parallel agents complete, report:

```markdown
## Review Efficiency
| Agent | Tokens | Tools | Duration |
|-------|--------|-------|----------|
| code-quality-reviewer | 450 | 8 | 12s |
| security-auditor | 620 | 12 | 18s |
| test-generator | 380 | 6 | 10s |

**Total:** 1,450 tokens, 26 tool calls
```

Use metrics to:
- Identify slow or expensive agents
- Track review efficiency over time
- Optimize agent prompts based on token usage

## Conventional Comments

Use these prefixes for comments:
- `praise:` - Positive feedback
- `nitpick:` - Minor suggestion
- `suggestion:` - Improvement idea
- `issue:` - Must fix
- `question:` - Needs clarification

## Related Skills
- commit: Create commits after review
- create-pr: Create PRs for review
- slack-integration: Team notifications for review events
## References

- [Review Template](references/review-template.md)
