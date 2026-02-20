---
title: Agent Prompts — Agent Teams Mode
impact: HIGH
impactDescription: "Orchestrates multi-agent review teams with cross-referencing between specialized reviewers"
tags: agent-teams, review, orchestration
---

# Agent Prompts — Agent Teams Mode

In Agent Teams mode, form a review team where reviewers cross-reference findings directly:

```python
# DOMAIN-AWARE AGENT SELECTION
# Core agents (always spawn): quality-reviewer, security-reviewer, test-reviewer
# Conditional: backend-reviewer (if HAS_BACKEND), frontend-reviewer (if HAS_FRONTEND)

# Capture scope from Phase 1
CHANGED_FILES = "$(gh pr diff $PR_NUMBER --name-only)"

TeamCreate(team_name="review-pr-$PR_NUMBER", description="Review PR #$PR_NUMBER")

Task(subagent_type="code-quality-reviewer", name="quality-reviewer",
     team_name="review-pr-$PR_NUMBER",
     prompt="""Review code quality and type safety for PR #$PR_NUMBER.
     Scope: ONLY review the following changed files:
     ${CHANGED_FILES}
     Do NOT explore beyond these files.
     When you find patterns that overlap with security concerns,
     message security-reviewer with the finding.
     When you find test gaps, message test-reviewer.""")

Task(subagent_type="security-auditor", name="security-reviewer",
     team_name="review-pr-$PR_NUMBER",
     prompt="""Security audit for PR #$PR_NUMBER.
     Scope: ONLY review the following changed files:
     ${CHANGED_FILES}
     Do NOT explore beyond these files.
     Cross-reference with quality-reviewer for injection risks in code patterns.
     When you find issues, message the responsible reviewer (backend-reviewer
     for API issues, frontend-reviewer for XSS).""")

Task(subagent_type="test-generator", name="test-reviewer",
     team_name="review-pr-$PR_NUMBER",
     prompt="""Review TEST ADEQUACY for PR #$PR_NUMBER.
     Scope: ONLY review the following changed files:
     ${CHANGED_FILES}
     Do NOT explore beyond these files.
     1. Check: Does the PR add/modify code WITHOUT adding tests? Flag as MISSING.
     2. Match change types to required test types (testing-patterns rules):
        - API → integration-api, verification-contract
        - DB → integration-database, data-seeding-cleanup
        - UI → unit-aaa-pattern, a11y-jest-axe
        - Logic → verification-property
     3. Evaluate test quality: meaningful assertions, no flaky patterns.
     4. When quality-reviewer flags test gaps, verify and suggest specific tests.
     Message backend-reviewer or frontend-reviewer with test requirements.
     End with: RESULT: [ADEQUATE|GAPS|MISSING] - summary""")

# Only spawn if backend files detected (HAS_BACKEND)
Task(subagent_type="backend-system-architect", name="backend-reviewer",
     team_name="review-pr-$PR_NUMBER",
     prompt="""Review backend code for PR #$PR_NUMBER.
     Scope: ONLY review the following changed files:
     ${CHANGED_FILES}
     Do NOT explore beyond these files.
     When security-reviewer flags API issues, validate and suggest fixes.
     Share API pattern findings with frontend-reviewer for consistency.""")

# Only spawn if frontend files detected (HAS_FRONTEND)
Task(subagent_type="frontend-ui-developer", name="frontend-reviewer",
     team_name="review-pr-$PR_NUMBER",
     prompt="""Review frontend code for PR #$PR_NUMBER.
     Scope: ONLY review the following changed files:
     ${CHANGED_FILES}
     Do NOT explore beyond these files.
     When backend-reviewer shares API patterns, verify frontend matches.
     When security-reviewer flags XSS risks, validate and suggest fixes.""")
```

**Team teardown** after synthesis (only shut down agents that were actually spawned):
```python
# After collecting all findings and producing the review
# Core agents — always shut down
SendMessage(type="shutdown_request", recipient="quality-reviewer", content="Review complete")
SendMessage(type="shutdown_request", recipient="security-reviewer", content="Review complete")
SendMessage(type="shutdown_request", recipient="test-reviewer", content="Review complete")
# Conditional agents — only shut down if spawned
# if HAS_BACKEND:
SendMessage(type="shutdown_request", recipient="backend-reviewer", content="Review complete")
# if HAS_FRONTEND:
SendMessage(type="shutdown_request", recipient="frontend-reviewer", content="Review complete")
TeamDelete()
```

**Incorrect — No team teardown:**
```python
# Agents keep running indefinitely
Task(subagent_type="code-quality-reviewer", team_name="review-pr-$PR_NUMBER")
Task(subagent_type="security-auditor", team_name="review-pr-$PR_NUMBER")
# Missing shutdown_request calls!
```

**Correct — Proper team teardown:**
```python
# After review synthesis complete
SendMessage(type="shutdown_request", recipient="quality-reviewer", content="Review complete")
SendMessage(type="shutdown_request", recipient="security-reviewer", content="Review complete")
TeamDelete()  # Clean shutdown
```

> **Fallback:** If team formation fails, use standard Task tool spawns from [agent-prompts-task-tool.md](agent-prompts-task-tool.md).
