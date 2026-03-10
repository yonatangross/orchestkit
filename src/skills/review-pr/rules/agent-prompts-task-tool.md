---
title: Agent Prompts — Task Tool Mode
impact: HIGH
impactDescription: "Defines six parallel reviewer agents for comprehensive PR code review"
tags: task-tool, review, agents
---

# Agent Prompts — Task Tool Mode

Launch SIX specialized reviewers in ONE message with `run_in_background: true`:

| Agent | Focus Area |
|-------|-----------|
| code-quality-reviewer #1 | Readability, complexity, DRY |
| code-quality-reviewer #2 | Type safety, Zod, Pydantic |
| security-auditor | Security, secrets, injection |
| test-generator | Test coverage, edge cases |
| backend-system-architect | API, async, transactions |
| frontend-ui-developer | React 19, hooks, a11y |

## Project Context Injection

Before spawning agents, load project-specific review context if it exists:

```python
# Load project review context from memory (if available)
# This file contains project conventions, security patterns, and known weaknesses
# from prior reviews. Agents receive it as PROJECT_CONTEXT in their prompts.
PROJECT_CONTEXT = ""
try:
    Read("${MEMORY_DIR}/review-pr-context.md")  # ${MEMORY_DIR} = project memory path
    PROJECT_CONTEXT = "<result from read>"
except:
    PROJECT_CONTEXT = "No project-specific review context available."
```

## Structured Output Contract

Every agent MUST return a JSON block (fenced with ```json```) at the end of their review:

```json
{
  "agent": "<agent-role>",
  "pr_number": $PR_NUMBER,
  "summary": "One-line summary",
  "findings": [
    {
      "id": "<CATEGORY_PREFIX>-<NNN>",
      "severity": "critical|high|medium|low|info",
      "category": "security|performance|correctness|maintainability|accessibility|testing",
      "file": "relative/path.ext",
      "line": 42,
      "title": "Short title (<80 chars)",
      "description": "Detailed explanation",
      "suggestion": "Fix suggestion",
      "effort": "5min|15min|30min|1h|2h+",
      "conventional_comment": "praise|nitpick|suggestion|issue|question"
    }
  ],
  "stats": { "files_reviewed": 0, "findings_count": 0, "critical": 0, "high": 0, "medium": 0, "low": 0 },
  "verdict": "approve|request-changes|comment-only"
}
```

Category prefixes: SEC (security), PERF (performance), BUG (correctness), MAINT (maintainability), A11Y (accessibility), TEST (testing).

The lead reviewer collects all agent JSON outputs, deduplicates by file+line+category (keeps highest severity), and persists critical/high findings to the memory graph.

## Agent Prompts

```python
# DOMAIN-AWARE AGENT SELECTION
# Only spawn agents relevant to detected domains.
# CHANGED_FILES and domain flags (HAS_FRONTEND, HAS_BACKEND, HAS_AI)
# are captured in Phase 1.

# ALWAYS spawn these 4 core agents:
# - code-quality-reviewer (readability)
# - code-quality-reviewer (type safety)
# - security-auditor
# - test-generator

# CONDITIONALLY spawn these based on domain:
# - backend-system-architect  → only if HAS_BACKEND
# - frontend-ui-developer     → only if HAS_FRONTEND
# - llm-integrator (7th)      → only if HAS_AI

# PARALLEL - All agents in ONE message
Agent(
  description="Review code quality",
  subagent_type="code-quality-reviewer",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  CODE QUALITY REVIEW

  ## Project Context
  ${PROJECT_CONTEXT}

  Review code readability and maintainability:
  1. Naming conventions and clarity
  2. Function/method complexity (cyclomatic < 10)
  3. DRY violations and code duplication
  4. SOLID principles adherence

  Do NOT explore beyond the changed files listed below. Focus your analysis on the diff.

  Return your findings as a JSON block (```json```) matching the structured output contract above.
  Use category prefix MAINT for maintainability findings. Use conventional comments (praise/suggestion/issue/nitpick).

  PR: $PR_NUMBER
  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}
  """,
  run_in_background=True,
  max_turns=25
)
Agent(
  description="Review type safety",
  subagent_type="code-quality-reviewer",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  TYPE SAFETY REVIEW

  ## Project Context
  ${PROJECT_CONTEXT}

  Review type safety and validation:
  1. TypeScript strict mode compliance
  2. Zod/Pydantic schema usage
  3. No `any` types or type assertions
  4. Exhaustive switch/union handling

  Do NOT explore beyond the changed files listed below. Focus your analysis on the diff.

  Return your findings as a JSON block (```json```) matching the structured output contract above.
  Use category prefix MAINT for type safety findings. Use conventional comments.

  PR: $PR_NUMBER
  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}
  """,
  run_in_background=True,
  max_turns=25
)
Agent(
  description="Security audit PR",
  subagent_type="security-auditor",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  SECURITY REVIEW

  ## Project Context
  ${PROJECT_CONTEXT}

  Security audit:
  1. Secrets/credentials in code
  2. Injection vulnerabilities (SQL, XSS)
  3. Authentication/authorization checks
  4. Dependency vulnerabilities
  5. Fail-closed auth patterns (reject when config missing)
  6. SSRF protection on user-controlled URLs
  7. Rate limiting on auth endpoints

  Do NOT explore beyond the changed files listed below. Focus your analysis on the diff.

  Return your findings as a JSON block (```json```) matching the structured output contract above.
  Use category prefix SEC for security findings. Use conventional comments.

  PR: $PR_NUMBER
  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}
  """,
  run_in_background=True,
  max_turns=25
)
Agent(
  description="Review test adequacy",
  subagent_type="test-generator",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  TEST ADEQUACY REVIEW

  Evaluate whether this PR has sufficient tests:

  1. TEST EXISTENCE CHECK
     - Does the PR add/modify code WITHOUT adding/updating tests?
     - Are there changed files with 0 corresponding test files?
     - Flag: "MISSING" if code changes have no tests at all

  2. TEST TYPE MATCHING (use testing-unit/testing-e2e/testing-integration rules)
     Match changed code to required test types:
     - API endpoint changes → need integration tests (rule: integration-api)
     - DB schema changes → need migration + integration tests (rule: integration-database)
     - UI component changes → need unit + a11y tests (rule: unit-aaa-pattern, a11y-testing)
     - Business logic → need unit + property tests (rule: verification-techniques)
     - LLM/AI changes → need eval tests (rule: llm-evaluation)

  3. TEST QUALITY
     - Meaningful assertions (not just truthy/exists)
     - Edge cases and error paths covered
     - No flaky patterns (timing, external deps, random)
     - Mocking is appropriate (not over-mocked)

  4. COVERAGE GAPS
     - Which changed functions/methods lack test coverage?
     - Which error paths are untested?

  ## Project Context
  ${PROJECT_CONTEXT}

  Do NOT explore beyond the changed files listed below. Focus your analysis on the diff.

  Return your findings as a JSON block (```json```) matching the structured output contract above.
  Use category prefix TEST for testing findings. Use conventional comments.

  PR: $PR_NUMBER
  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}
  """,
  run_in_background=True,
  max_turns=25
)
Agent(
  description="Review backend code",
  subagent_type="backend-system-architect",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  BACKEND REVIEW

  ## Project Context
  ${PROJECT_CONTEXT}

  Review backend code:
  1. API design and REST conventions
  2. Async/await patterns and error handling
  3. Database query efficiency (N+1)
  4. Transaction boundaries
  5. Redis connection lifecycle (close in try/finally)
  6. Webhook auth patterns (fail-closed)

  Do NOT explore beyond the changed files listed below. Focus your analysis on the diff.

  Return your findings as a JSON block (```json```) matching the structured output contract above.
  Use category prefixes: BUG (correctness), PERF (performance), MAINT (maintainability). Use conventional comments.

  PR: $PR_NUMBER
  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}
  """,
  run_in_background=True,
  max_turns=25
)
Agent(
  description="Review frontend code",
  subagent_type="frontend-ui-developer",
  prompt="""# Cache-optimized: stable content first (CC 2.1.72)
  FRONTEND REVIEW

  ## Project Context
  ${PROJECT_CONTEXT}

  Review frontend code:
  1. React 19 patterns (hooks, server components)
  2. State management correctness
  3. Accessibility (a11y) compliance — button type attrs, ARIA
  4. Performance (memoization, lazy loading)
  5. SSR safety — no navigator/window outside hooks/useEffect

  Do NOT explore beyond the changed files listed below. Focus your analysis on the diff.

  Return your findings as a JSON block (```json```) matching the structured output contract above.
  Use category prefixes: A11Y (accessibility), PERF (performance), BUG (correctness). Use conventional comments.

  PR: $PR_NUMBER
  Scope: ONLY review the following changed files:
  ${CHANGED_FILES}
  """,
  run_in_background=True,
  max_turns=25
)
```

**Incorrect — Sequential agents:**
```python
# 6 reviewers run one-by-one (slow)
Agent(subagent_type="code-quality-reviewer", prompt="...")
# Wait for completion
Agent(subagent_type="security-auditor", prompt="...")
# Wait again...
```

**Correct — Parallel agents:**
```python
# All 6 agents in ONE message (fast)
Agent(subagent_type="code-quality-reviewer", prompt="...", run_in_background=True)
Agent(subagent_type="security-auditor", prompt="...", run_in_background=True)
Agent(subagent_type="test-generator", prompt="...", run_in_background=True)
# All launch simultaneously
```
