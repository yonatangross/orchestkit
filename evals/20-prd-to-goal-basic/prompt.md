---
tags: [prd-to-goal, fire]
max_turns: 6
timeout_seconds: 180
runs: 3
allowed_tools: [Skill]
---

Turn this issue into a goal line I can paste into Claude Code.

Title: Rate limiter drops the retry-after header on 429
Acceptance Criteria:
- `src/middleware/rate_limit.py` sets a `Retry-After` header on every 429 response
- A new test in `tests/middleware/test_rate_limit.py` asserts the header is present
- `pytest tests/middleware` stays green
- `ruff check src` exits 0
