---
name: verify
description: Comprehensive feature verification with parallel analysis agents. Use when verifying implementations, testing changes, validating features, or checking correctness.
context: fork
version: 3.0.0
author: OrchestKit
tags: [verification, testing, quality, validation, parallel-agents, grading]
user-invocable: true
allowedTools: [Bash, Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, TaskList, mcp__memory__search_nodes]
skills: [code-review-playbook, security-scanning, evidence-verification, run-tests, unit-testing, integration-testing, recall, quality-gates]
---

# Verify Feature

Comprehensive verification using parallel specialized agents with nuanced grading (0-10 scale) and improvement suggestions.

## Quick Start

```bash
/verify authentication flow
/verify user profile feature
/verify --scope=backend database migrations
```

## Workflow Overview

```
Phase 1: Context & Task Creation (MANDATORY)
    |
    v
Phase 2: Parallel Agent Dispatch (5-7 agents)
    |
    +---> code-quality-reviewer    --+
    +---> security-auditor           |
    +---> test-generator             +---> Results (0-10 scores)
    +---> backend-system-architect   |
    +---> frontend-ui-developer    --+
    |
    v
Phase 3: Parallel Test Execution
    |
    v
Phase 4: Nuanced Grading & Scoring
    |
    v
Phase 5: Improvement Suggestions with Point Estimates
    |
    v
Phase 6: Alternative Comparison (Optional)
    |
    v
Phase 7: Metrics Over Time Tracking
    |
    v
Phase 8: Evidence Compilation & Report
```

---

## Phase 1: Context & Task Creation (MANDATORY)

**ALWAYS create tasks before verification** - This tracks progress and provides clear completion criteria.

### 1a. Gather Context

```bash
# PARALLEL - Run all in ONE message
git diff main --stat                    # Changes summary
git log main..HEAD --oneline           # Commit history
git diff main --name-only | sort -u    # Affected files
```

### 1b. Create Verification Tasks

```python
# Create task hierarchy for verification (8-phase process)
TaskCreate(
  subject="Verify [feature-name] implementation",
  description="Comprehensive verification with nuanced grading",
  activeForm="Verifying [feature-name] implementation"
)

# Create subtasks for each verification domain
TaskCreate(subject="Run code quality checks", activeForm="Running code quality checks")
TaskCreate(subject="Execute security audit", activeForm="Executing security audit")
TaskCreate(subject="Verify test coverage", activeForm="Verifying test coverage")
TaskCreate(subject="Validate API correctness", activeForm="Validating API correctness")
TaskCreate(subject="Check UI/UX compliance", activeForm="Checking UI/UX compliance")
TaskCreate(subject="Calculate nuanced grades", activeForm="Calculating grades")
TaskCreate(subject="Generate improvement suggestions", activeForm="Generating suggestions")
TaskCreate(subject="Compile verification report", activeForm="Compiling verification report")
```

---

## Phase 2: Parallel Agent Dispatch (5-7 Agents)

Launch ALL agents in ONE message with `run_in_background: true`.

### Agent Configuration Matrix

| Agent | Focus | Skills Auto-Injected | Output |
|-------|-------|---------------------|--------|
| code-quality-reviewer | Lint, types, patterns | code-review-playbook, biome-linting, clean-architecture | JSON quality report with 0-10 scores |
| security-auditor | OWASP, secrets, CVEs | owasp-top-10, security-scanning, defense-in-depth | JSON security findings with severity |
| test-generator | Coverage gaps, test quality | unit-testing, integration-testing, msw-mocking | Coverage analysis with 0-10 score |
| backend-system-architect | API design, async patterns | api-design-framework, fastapi-advanced, error-handling-rfc9457 | API compliance report with 0-10 score |
| frontend-ui-developer | React 19, Zod, a11y | react-server-components-framework, wcag-compliance, type-safety-validation | UI compliance report with 0-10 score |

### Parallel Dispatch Template (with 0-10 Scoring)

```python
# PARALLEL - Launch ALL 5 agents in ONE message
TaskUpdate(taskId="1", status="in_progress")

Task(
  subagent_type="code-quality-reviewer",
  prompt="""QUALITY VERIFICATION for: $ARGUMENTS

  Execute REAL checks and provide 0-10 NUANCED SCORES:

  1. LINTING (0-10)
     - 10: Zero errors, zero warnings
     - 7-9: Zero errors, < 5 warnings
     - 4-6: 1-5 errors or many warnings
     - 1-3: Many errors
     - 0: Lint fails to run

  2. TYPE SAFETY (0-10)
     - 10: Zero type errors, strict mode
     - 7-9: Zero errors, some `any` usage
     - 4-6: 1-5 type errors
     - 1-3: Many type errors
     - 0: Type check fails

  3. PATTERNS (0-10)
     - 10: Exemplary code, all best practices
     - 7-9: Good patterns, minor improvements possible
     - 4-6: Some anti-patterns detected
     - 1-3: Significant pattern violations
     - 0: Major architectural issues

  4. COMPLEXITY (0-10, inverted)
     - 10: Simple, easy to understand
     - 7-9: Reasonable complexity
     - 4-6: Some complex functions
     - 1-3: High complexity throughout
     - 0: Unmaintainable

  Output JSON:
  {
    "scores": {
      "linting": N,
      "type_safety": N,
      "patterns": N,
      "complexity": N,
      "overall": N.N
    },
    "details": {...},
    "improvement_suggestions": [
      {"area": "...", "suggestion": "...", "effort_points": N, "impact_points": N}
    ]
  }

  SUMMARY: End with: "QUALITY: [N.N]/10 - [strongest area] strong, [weakest area] needs work"
  """,
  run_in_background=True
)

Task(
  subagent_type="security-auditor",
  prompt="""SECURITY AUDIT for: $ARGUMENTS

  Execute REAL scans and provide 0-10 NUANCED SCORE:

  SECURITY SCORE (0-10):
  - 10: No vulnerabilities, exemplary security practices
  - 8-9: No critical/high, excellent practices
  - 6-7: No critical, few high, good practices
  - 4-5: No critical, some highs
  - 2-3: Some critical issues
  - 0-1: Multiple critical vulnerabilities

  Check:
  1. Dependency audit: `npm audit --json` / `pip-audit`
  2. Secret detection: grep for API keys, passwords
  3. OWASP Top 10 compliance
  4. Rate limiting, auth patterns

  Output JSON:
  {
    "score": N,
    "vulnerabilities": {
      "critical": N,
      "high": N,
      "medium": N,
      "low": N
    },
    "owasp_compliance": {"A01": true/false, ...},
    "improvement_suggestions": [
      {"issue": "...", "fix": "...", "effort_points": N, "risk_reduction_points": N}
    ]
  }

  SUMMARY: End with: "SECURITY: [N]/10 - [N] critical, [M] high - [key finding]"
  """,
  run_in_background=True
)

Task(
  subagent_type="test-generator",
  prompt="""TEST COVERAGE VERIFICATION for: $ARGUMENTS

  Execute tests and provide 0-10 NUANCED SCORE:

  COVERAGE SCORE (0-10):
  - 10: >= 90% coverage, all critical paths
  - 8-9: >= 80% coverage, critical paths covered
  - 6-7: >= 70% coverage (target)
  - 4-5: >= 50% coverage
  - 2-3: >= 30% coverage
  - 0-1: < 30% coverage

  TEST QUALITY SCORE (0-10):
  - 10: Meaningful assertions, edge cases, no flaky tests
  - 7-9: Good assertions, some edge cases
  - 4-6: Basic assertions
  - 1-3: Shallow tests
  - 0: Tests don't test actual behavior

  Output JSON:
  {
    "scores": {
      "coverage": N,
      "quality": N,
      "overall": N.N
    },
    "coverage_percent": N,
    "test_summary": {"total": N, "passed": N, "failed": N},
    "gaps": ["file:line - reason"],
    "improvement_suggestions": [
      {"gap": "...", "test_to_add": "...", "effort_points": N, "coverage_gain": N}
    ]
  }

  SUMMARY: End with: "TESTS: [N.N]/10 - [coverage]% coverage, [quality] quality"
  """,
  run_in_background=True
)

Task(
  subagent_type="backend-system-architect",
  prompt="""API VERIFICATION for: $ARGUMENTS

  Verify backend and provide 0-10 NUANCED SCORES:

  API DESIGN SCORE (0-10):
  - 10: Perfect REST, excellent error handling, fully documented
  - 7-9: Good REST, proper errors, documented
  - 4-6: Acceptable API, some inconsistencies
  - 1-3: Poor API design
  - 0: Broken or insecure API

  Score dimensions:
  1. REST conventions compliance
  2. Pydantic v2 validation
  3. RFC 9457 error handling
  4. Async safety (timeouts)
  5. Query optimization (no N+1)

  Output JSON:
  {
    "score": N.N,
    "dimensions": {
      "rest_compliance": N,
      "validation": N,
      "error_handling": N,
      "async_safety": N,
      "query_optimization": N
    },
    "improvement_suggestions": [
      {"endpoint": "...", "issue": "...", "fix": "...", "effort_points": N}
    ]
  }

  SUMMARY: End with: "API: [N.N]/10 - [strongest] strong, [weakest] needs work"
  """,
  run_in_background=True
)

Task(
  subagent_type="frontend-ui-developer",
  prompt="""UI/UX VERIFICATION for: $ARGUMENTS

  Verify frontend and provide 0-10 NUANCED SCORES:

  UI COMPLIANCE SCORE (0-10):
  - 10: All React 19 APIs, perfect Zod, WCAG AAA
  - 8-9: Modern patterns, good validation, WCAG AA
  - 6-7: Acceptable patterns, some validation
  - 4-5: Dated patterns, missing validation
  - 1-3: Poor practices
  - 0: Broken or inaccessible

  Score dimensions:
  1. React 19 API usage
  2. Zod validation coverage
  3. Type exhaustiveness
  4. Loading states (skeletons)
  5. Accessibility (WCAG)

  Output JSON:
  {
    "score": N.N,
    "dimensions": {
      "react_19": N,
      "zod_validation": N,
      "type_safety": N,
      "ux_patterns": N,
      "accessibility": N
    },
    "improvement_suggestions": [
      {"component": "...", "issue": "...", "fix": "...", "effort_points": N}
    ]
  }

  SUMMARY: End with: "UI: [N.N]/10 - [strongest] strong, [weakest] needs work"
  """,
  run_in_background=True
)
```

---

## Phase 3: Parallel Test Execution

```bash
# PARALLEL - Run backend and frontend tests simultaneously

# Backend tests
cd /path/to/backend && poetry run pytest tests/ -v \
  --cov=app --cov-report=term-missing --cov-report=json \
  --tb=short --maxfail=5

# Frontend tests
cd /path/to/frontend && npm run test -- --coverage --passWithNoTests
```

---

## Phase 4: Nuanced Grading & Scoring (NEW)

**Goal:** Replace binary pass/fail with 0-10 nuanced grades.

### Composite Score Calculation

```python
# Weights for each dimension
WEIGHTS = {
    "code_quality": 0.20,
    "security": 0.25,
    "test_coverage": 0.20,
    "api_compliance": 0.20,
    "ui_compliance": 0.15
}

# Calculate weighted composite score
composite_score = (
    quality_score * 0.20 +
    security_score * 0.25 +
    test_score * 0.20 +
    api_score * 0.20 +
    ui_score * 0.15
)
```

### Grade Interpretation

| Score | Grade | Meaning | Action |
|-------|-------|---------|--------|
| 9.0-10.0 | A+ | Exceptional | Ship it! |
| 8.0-8.9 | A | Excellent | Ready for merge |
| 7.0-7.9 | B | Good | Minor improvements optional |
| 6.0-6.9 | C | Acceptable | Consider improvements |
| 5.0-5.9 | D | Below par | Improvements recommended |
| 4.0-4.9 | F | Poor | Significant work needed |
| 0.0-3.9 | F- | Critical | Do not merge |

### Dimension Breakdown Report

```markdown
## Verification Grade: [COMPOSITE]/10 (Grade: [LETTER])

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Code Quality | [N]/10 | 20% | [N*0.2] |
| Security | [N]/10 | 25% | [N*0.25] |
| Test Coverage | [N]/10 | 20% | [N*0.2] |
| API Compliance | [N]/10 | 20% | [N*0.2] |
| UI Compliance | [N]/10 | 15% | [N*0.15] |
| **Composite** | **[N.N]/10** | 100% | **[N.N]** |
```

---

## Phase 5: Improvement Suggestions with Point Estimates (NEW)

**Goal:** Prioritize improvements by effort vs impact.

### Suggestion Format

Each improvement suggestion includes:
- **Effort Points (1-5):** How hard to implement
- **Impact Points (1-5):** How much improvement
- **Priority Score:** Impact / Effort (higher = do first)

### Suggestion Prioritization Table

| Suggestion | Effort | Impact | Priority | Category |
|------------|--------|--------|----------|----------|
| Add Zod validation to /users endpoint | 2 | 4 | 2.0 | Security |
| Fix N+1 query in get_all_items | 3 | 5 | 1.67 | Performance |
| Add missing unit tests | 4 | 3 | 0.75 | Testing |
| Refactor AuthService | 5 | 3 | 0.60 | Maintainability |

### Effort Point Guidelines

| Points | Effort Level | Time Estimate |
|--------|--------------|---------------|
| 1 | Trivial | < 15 minutes |
| 2 | Easy | 15-60 minutes |
| 3 | Medium | 1-4 hours |
| 4 | Hard | 4-8 hours |
| 5 | Very Hard | 1+ days |

### Impact Point Guidelines

| Points | Impact Level | Description |
|--------|--------------|-------------|
| 1 | Minimal | Nice to have |
| 2 | Low | Minor improvement |
| 3 | Medium | Noticeable improvement |
| 4 | High | Significant improvement |
| 5 | Critical | Essential fix |

---

## Phase 6: Alternative Comparison (Optional, NEW)

**Goal:** Compare current implementation against alternatives.

### When to Use

- Multiple valid approaches exist
- User asked "is this the best way?"
- Major architectural decisions made

### Comparison Template

```python
Task(
  subagent_type="workflow-architect",
  prompt="""ALTERNATIVE COMPARISON for: $ARGUMENTS

  Compare the current implementation against alternatives:

  1. CURRENT APPROACH
     - Description: [what was implemented]
     - Pros: [strengths]
     - Cons: [weaknesses]
     - Score: [0-10]

  2. ALTERNATIVE A: [name]
     - Description: [different approach]
     - Pros: [strengths]
     - Cons: [weaknesses]
     - Score: [0-10]

  3. ALTERNATIVE B: [name]
     - Description: [another approach]
     - Pros: [strengths]
     - Cons: [weaknesses]
     - Score: [0-10]

  RECOMMENDATION:
  - Best overall: [which approach and why]
  - Migration effort if switching: [effort points]
  - Should we switch? [Yes/No with justification]

  SUMMARY: End with: "ALTERNATIVES: Current [N]/10 vs Best alternative [M]/10 - [recommendation]"
  """,
  run_in_background=True
)
```

---

## Phase 7: Metrics Over Time Tracking (NEW)

**Goal:** Track verification scores over time to measure improvement.

### Metrics Storage

```python
# Store verification metrics in memory
mcp__memory__create_entities(entities=[{
  "name": "verification-{date}-{feature}",
  "entityType": "VerificationMetrics",
  "observations": [
    f"date: {date}",
    f"feature: {feature}",
    f"composite_score: {score}",
    f"code_quality: {quality}",
    f"security: {security}",
    f"test_coverage: {coverage}",
    f"api_compliance: {api}",
    f"ui_compliance: {ui}"
  ]
}])
```

### Trend Analysis Query

```python
# Query past verifications
mcp__memory__search_nodes(query="VerificationMetrics")
```

### Trend Report

```markdown
## Score Trends (Last 5 Verifications)

| Date | Feature | Composite | Quality | Security | Tests |
|------|---------|-----------|---------|----------|-------|
| Jan 20 | Auth | 7.2 | 8.0 | 6.5 | 7.5 |
| Jan 18 | Profile | 6.8 | 7.5 | 7.0 | 6.0 |
| Jan 15 | Dashboard | 7.5 | 8.5 | 7.0 | 7.0 |

**Trend:** [Improving / Stable / Declining]
**Focus Area:** [Dimension with declining scores]
```

---

## Phase 8: Evidence Compilation & Report

### Final Verification Report Template

```markdown
# Feature Verification Report

**Date**: [TODAY'S DATE]
**Branch**: [branch-name]
**Feature**: $ARGUMENTS
**Reviewer**: Claude Code with 5 parallel subagents

---

## Grade Summary

**Composite Score: [N.N]/10 (Grade: [LETTER])**

| Dimension | Score | Status |
|-----------|-------|--------|
| Code Quality | [N]/10 | [bar visualization] |
| Security | [N]/10 | [bar visualization] |
| Test Coverage | [N]/10 | [bar visualization] |
| API Compliance | [N]/10 | [bar visualization] |
| UI Compliance | [N]/10 | [bar visualization] |

---

## Top Improvement Suggestions (by Priority)

| # | Suggestion | Effort | Impact | Priority |
|---|------------|--------|--------|----------|
| 1 | [highest priority] | [N] | [N] | [N.N] |
| 2 | [second priority] | [N] | [N] | [N.N] |
| 3 | [third priority] | [N] | [N] | [N.N] |

**Quick Wins (Effort <= 2, Impact >= 4):**
- [list quick wins]

---

## Alternative Analysis (if applicable)

Current approach: [N]/10
Best alternative: [N]/10
Recommendation: [Keep current / Consider switching]

---

## Trend Analysis

Compared to last verification:
- Composite: [+/-N.N] ([improving/declining])
- Biggest improvement: [dimension]
- Needs attention: [dimension]

---

## Evidence Artifacts

| Artifact | Location |
|----------|----------|
| Test Results | `/tmp/test_results.log` |
| Coverage Report | `/tmp/coverage.json` |
| Security Scan | `/tmp/security_audit.json` |

---

## Verdict

**[READY FOR MERGE | IMPROVEMENTS RECOMMENDED | BLOCKED]**

[1-2 sentence summary explaining the verdict]
```

---

## Policy-as-Code Support (NEW)

**Goal:** Define verification policies as code for consistent enforcement.

### Policy Definition

Create `.claude/policies/verification-policy.json`:

```json
{
  "version": "1.0",
  "name": "default-verification-policy",
  "thresholds": {
    "composite_minimum": 6.0,
    "security_minimum": 7.0,
    "coverage_minimum": 70,
    "critical_vulnerabilities": 0,
    "high_vulnerabilities": 3
  },
  "required_checks": [
    "lint",
    "typecheck",
    "security_audit",
    "unit_tests"
  ],
  "blocking_rules": [
    {"dimension": "security", "below": 5.0, "action": "block"},
    {"dimension": "test_coverage", "below": 50, "action": "block"},
    {"check": "critical_vulnerabilities", "above": 0, "action": "block"}
  ],
  "warning_rules": [
    {"dimension": "code_quality", "below": 7.0, "action": "warn"},
    {"dimension": "ui_compliance", "below": 6.0, "action": "warn"}
  ]
}
```

### Policy Enforcement

```python
def check_policy(results, policy):
    violations = []

    for rule in policy["blocking_rules"]:
        if rule["dimension"] in results:
            if results[rule["dimension"]] < rule.get("below", float('inf')):
                violations.append({
                    "rule": rule,
                    "actual": results[rule["dimension"]],
                    "severity": "BLOCKING"
                })

    return violations
```

---

**Version:** 3.0.0 (January 2026)

**v3.0.0 Enhancements:**
- Added **Nuanced Grading**: 0-10 scores instead of binary pass/fail
- Added **Improvement Suggestions with Point Estimates**: Effort vs Impact prioritization
- Added **Alternative Comparison**: Compare current implementation vs alternatives
- Added **Metrics Over Time Tracking**: Trend analysis across verifications
- Added **Policy-as-Code**: Define verification rules as JSON policies
- Expanded from 5-phase to 8-phase process

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scoring scale | 0-10 with decimals | Nuanced feedback, not binary |
| Improvement prioritization | Impact / Effort ratio | Do high-value, low-effort first |
| Alternative comparison | Optional phase | Only when multiple valid approaches |
| Metrics persistence | Memory MCP | Track trends over time |
| Policy-as-code | JSON in .claude/policies/ | Consistent, version-controlled rules |

## Related Skills

- `implement` - Full implementation with verification
- `review-pr` - PR-specific verification workflow
- `run-tests` - Detailed test execution patterns
- `evidence-verification` - Evidence collection standards
- `code-review-playbook` - Review quality patterns
- `quality-gates` - Quality gate patterns

## References

- [Verification Report Template](references/report-template.md)
