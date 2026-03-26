---
title: Sequential browser testing — no parallel page visits
impact: CRITICAL
impactDescription: "Parallel browser sessions cause port conflicts, shared state corruption, and flaky test results"
tags: execution, browser, concurrency, safety
---

## No Parallel Browsers

Always test pages sequentially in a single browser session.

**Incorrect — parallel browser sessions:**
```python
# Wrong: multiple agents hitting the same app simultaneously
Agent(prompt="Test /login", run_in_background=True)
Agent(prompt="Test /dashboard", run_in_background=True)
Agent(prompt="Test /settings", run_in_background=True)
# Risk: shared cookies, race conditions, port conflicts
```

**Correct — single agent, sequential navigation:**
```python
# Right: one agent tests all pages in sequence
Agent(prompt="""Test these pages in order:
  1. /login
  2. /dashboard
  3. /settings
Navigate between them sequentially. Do not open multiple tabs.""")
```

**Key rules:**
- One browser session per test run
- Navigate sequentially between pages
- Clear cookies/state between unrelated page groups if needed
- If app requires auth, login once and reuse the session
- Never spawn parallel browser agents for the same base_url
