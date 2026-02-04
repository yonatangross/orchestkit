---
name: generate-test-evidence
description: Generate test evidence with auto-fetched test results. Use when documenting test execution for quality gates.
user-invocable: true
argument-hint: [test-suite-or-command]
---

Generate test evidence for: $ARGUMENTS

## Test Execution Evidence

### Basic Information

**Task/Feature:** $ARGUMENTS
**Agent:** Evidence Verification Agent
**Timestamp:** !`date "+%Y-%m-%d %H:%M:%S"`
**Test Command Available**: !`which pytest >/dev/null 2>&1 && echo "pytest" || (which npm >/dev/null 2>&1 && echo "npm test" || echo "Unknown")`

## Your Task

Run the test command: **$ARGUMENTS**

Then document the results below. If no command provided, use the detected test command above.

### Test Command

```bash
$ARGUMENTS
```

### Test Results

Run the command and capture:

**Exit Code:** [0 for success, non-zero for failure] ✅/❌

**Summary:**
- Tests Passed: [number]
- Tests Failed: [number]
- Tests Skipped: [number]
- Total Tests: [number]

**Duration:** [time in seconds or MM:SS format]

### Coverage (if available)

**Overall Coverage:** [percentage]%

**Detailed Coverage:**
- Statements: [percentage]%
- Branches: [percentage]%
- Functions: [percentage]%
- Lines: [percentage]%

### Test Output

```
[Paste first 10-20 lines of test output here]
[Include key information: which tests ran, any errors, summary]
```

### Environment

**Runtime:** !`python --version 2>/dev/null || node --version 2>/dev/null || echo "Unknown"`
**OS:** !`uname -s || echo "Unknown"`
**Test Framework:** !`grep -r "jest\|pytest\|mocha" package.json pyproject.toml 2>/dev/null | head -1 | grep -oE 'jest|pytest|mocha' || echo "Unknown"`

### Issues Found (if any)

| Test Name | Error | Expected | Actual |
|-----------|-------|----------|--------|
| [Auto-populate from test output] | | | |

### Evidence File

**Location:** `.claude/quality-gates/evidence/tests-!`date +%Y-%m-%d-%H%M%S`.log`

### Conclusion

[✅ All tests passed / ❌ X tests failed - needs fixing]

---

## Quick Evidence Template

```
## Test Evidence

**Task:** $ARGUMENTS
**Command:** `$ARGUMENTS`
**Exit Code:** [0/non-zero] [✅/❌]
**Results:** [X passed, X failed, X skipped]
**Coverage:** [X]%
**Duration:** [X]s
**Timestamp:** !`date "+%Y-%m-%d %H:%M:%S"`

**Status:** [All passed ✅ / X failed ❌]
```
