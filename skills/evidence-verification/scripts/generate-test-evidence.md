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

### Test Command

```bash
!`echo "$ARGUMENTS" || echo "pytest --cov" || echo "npm test"`
```

### Test Results (Auto-Fetched)

**Exit Code:** !`$ARGUMENTS 2>&1; echo $? | tail -1 || echo "Unknown"` ✅/❌

**Summary:**
- Tests Passed: !`$ARGUMENTS 2>&1 | grep -oE '[0-9]+ passed' | head -1 | grep -oE '[0-9]+' || echo "Unknown"`
- Tests Failed: !`$ARGUMENTS 2>&1 | grep -oE '[0-9]+ failed' | head -1 | grep -oE '[0-9]+' || echo "0"`
- Tests Skipped: !`$ARGUMENTS 2>&1 | grep -oE '[0-9]+ skipped' | head -1 | grep -oE '[0-9]+' || echo "0"`
- Total Tests: !`$ARGUMENTS 2>&1 | grep -oE '[0-9]+ total' | head -1 | grep -oE '[0-9]+' || echo "Unknown"`

**Duration:** !`$ARGUMENTS 2>&1 | grep -oE 'Time:.*[0-9.]+s' | tail -1 || echo "Unknown"`

### Coverage (if available)

**Overall Coverage:** !`$ARGUMENTS --coverage 2>&1 | grep -oE '[0-9]+%' | head -1 || echo "Not available"`

**Detailed Coverage:**
- Statements: !`$ARGUMENTS --coverage 2>&1 | grep -i "statements" | grep -oE '[0-9]+%' | head -1 || echo "N/A"`
- Branches: !`$ARGUMENTS --coverage 2>&1 | grep -i "branches" | grep -oE '[0-9]+%' | head -1 || echo "N/A"`
- Functions: !`$ARGUMENTS --coverage 2>&1 | grep -i "functions" | grep -oE '[0-9]+%' | head -1 || echo "N/A"`
- Lines: !`$ARGUMENTS --coverage 2>&1 | grep -i "lines" | grep -oE '[0-9]+%' | head -1 || echo "N/A"`

### Test Output

```
!`$ARGUMENTS 2>&1 | head -30 || echo "Unable to fetch test output"`
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

**Status:** !`$ARGUMENTS 2>&1 | grep -q "passed\|PASS" && echo "✅ All tests passed" || echo "❌ Some tests failed"`

---

## Quick Evidence Template

```
## Test Evidence

**Task:** $ARGUMENTS
**Command:** `!`echo "$ARGUMENTS" || echo "test command"`
**Exit Code:** !`$ARGUMENTS 2>&1; echo $? | tail -1` [✅/❌]
**Results:** !`$ARGUMENTS 2>&1 | grep -oE '[0-9]+ passed.*[0-9]+ failed' || echo "See output above"`
**Coverage:** !`$ARGUMENTS --coverage 2>&1 | grep -oE '[0-9]+%' | head -1 || echo "N/A"`%
**Duration:** !`$ARGUMENTS 2>&1 | grep -oE 'Time:.*[0-9.]+s' || echo "Unknown"`
**Timestamp:** !`date "+%Y-%m-%d %H:%M:%S"`

**Status:** !`$ARGUMENTS 2>&1 | grep -q "passed\|PASS" && echo "All passed ✅" || echo "Some failed ❌"`
```
