---
title: Timeout and retry conventions for browser test execution
impact: CRITICAL
impactDescription: "Missing timeouts cause indefinite hangs; missing retries cause false failures on slow pages"
tags: execution, timeout, retry, reliability
---

## Timeout and Retry

Set explicit timeouts for every browser operation and retry transient failures exactly once.

**Incorrect — no timeout, no retry:**
```python
# Wrong: waits forever if element doesn't exist
await page.click("#submit-button")
# Wrong: fails immediately on slow network
assert page.url == "/dashboard"
```

**Correct — explicit timeouts with single retry:**
```python
# Right: 10s timeout for element interaction
await page.click("#submit-button", timeout=10000)

# Right: wait for navigation with timeout
await page.wait_for_url("/dashboard", timeout=15000)

# Right: retry once on element-not-found
try:
    await page.click("#submit-button", timeout=5000)
except ElementNotFound:
    await page.wait_for_timeout(2000)  # Wait 2s
    await page.click("#submit-button", timeout=5000)  # One retry
```

**Timeout defaults:**

| Operation | Timeout | Retry |
|-----------|---------|-------|
| Page navigation | 15s | 1x |
| Element click/fill | 10s | 1x after 2s wait |
| Assertion | 5s | No retry |
| Page crash (5xx) | — | Skip remaining steps on page |
| Network timeout | 15s | 1x |
