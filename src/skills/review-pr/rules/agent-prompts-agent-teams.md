---
title: Agent Prompts — Agent Teams Mode
impact: HIGH
impactDescription: "Orchestrates multi-agent review teams with cross-referencing between specialized reviewers"
tags: agent-teams, review, orchestration
---

# Agent Prompts — Agent Teams Mode

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
     prompt="""Review TEST ADEQUACY for PR #{number}.
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

> **Fallback:** If team formation fails, use standard Task tool spawns from [agent-prompts-task-tool.md](agent-prompts-task-tool.md).
