---
name: evidence-verification
description: Use when completing tasks, code reviews, or deployments to verify work with evidence. Collects test results, build outputs, coverage metrics, and exit codes to prove work is complete.
version: 2.0.0
author: SkillForge AI Agent Hub
tags: [quality, verification, testing, evidence, completion]
context: fork
agent: code-quality-reviewer
model: haiku
hooks:
  PostToolUse:
    - matcher: Bash
      command: |
        # Capture exit code for evidence
        echo "::notice::Command exit code: $CC_LAST_EXIT_CODE"
  Stop:
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/evidence-collector.sh"
---

# Evidence-Based Verification Skill

**Version:** 2.0.0
**Type:** Quality Assurance
**Auto-activate:** Code review, task completion, production deployment

## Overview

This skill teaches agents how to collect and verify evidence before marking tasks complete. Inspired by production-grade development practices, it ensures all claims are backed by executable proof: test results, coverage metrics, build success, and deployment verification.

**Key Principle:** Show, don't tell. No task is complete without verifiable evidence.

---

## When to Use This Skill

### Auto-Activate Triggers
- Completing code implementation
- Finishing code review
- Marking tasks complete in Squad mode
- Before agent handoff
- Production deployment verification

### Manual Activation
- When user requests "verify this works"
- Before creating pull requests
- During quality assurance reviews
- When troubleshooting failures

---

## Core Concepts

### 1. Evidence Types

**Test Evidence**
- Exit code (must be 0 for success)
- Test suite results (passed/failed/skipped)
- Coverage percentage (if available)
- Test duration

**Build Evidence**
- Build exit code (0 = success)
- Compilation errors/warnings
- Build artifacts created
- Build duration

**Deployment Evidence**
- Deployment status (success/failed)
- Environment deployed to
- Health check results
- Rollback capability verified

**Code Quality Evidence**
- Linter results (errors/warnings)
- Type checker results
- Security scan results
- Accessibility audit results

### 2. Evidence Collection Protocol

```markdown
## Evidence Collection Steps

1. **Identify Verification Points**
   - What needs to be proven?
   - What could go wrong?
   - What does "complete" mean?

2. **Execute Verification**
   - Run tests
   - Run build
   - Run linters
   - Check deployments

3. **Capture Results**
   - Record exit codes
   - Save output snippets
   - Note timestamps
   - Document environment

4. **Store Evidence**
   - Add to shared context
   - Reference in task completion
   - Link to artifacts
```

### 3. Verification Standards

**Minimum Evidence Requirements:**
- ✅ At least ONE verification type executed
- ✅ Exit code captured (0 = pass, non-zero = fail)
- ✅ Timestamp recorded
- ✅ Evidence stored in context

**Production-Grade Requirements:**
- ✅ Tests run with exit code 0
- ✅ Coverage >70% (or project standard)
- ✅ Build succeeds with exit code 0
- ✅ No critical linter errors
- ✅ Security scan passes

---

## Evidence Collection Templates

### Template 1: Test Evidence

Use this template when running tests:

```markdown
## Test Evidence

**Command:** `npm test` (or equivalent)
**Exit Code:** 0 ✅ / non-zero ❌
**Duration:** X seconds
**Results:**
- Tests passed: X
- Tests failed: X
- Tests skipped: X
- Coverage: X%

**Output Snippet:**
```
[First 10 lines of test output]
```

**Timestamp:** YYYY-MM-DD HH:MM:SS
**Environment:** Node vX.X.X, OS, etc.
```

### Template 2: Build Evidence

Use this template when building:

```markdown
## Build Evidence

**Command:** `npm run build` (or equivalent)
**Exit Code:** 0 ✅ / non-zero ❌
**Duration:** X seconds
**Artifacts Created:**
- dist/bundle.js (XXX KB)
- dist/styles.css (XXX KB)

**Errors:** X
**Warnings:** X

**Output Snippet:**
```
[First 10 lines of build output]
```

**Timestamp:** YYYY-MM-DD HH:MM:SS
```

### Template 3: Code Quality Evidence

Use this template for linting and type checking:

```markdown
## Code Quality Evidence

**Linter:** ESLint / Ruff / etc.
**Command:** `npm run lint`
**Exit Code:** 0 ✅ / non-zero ❌
**Errors:** X
**Warnings:** X

**Type Checker:** TypeScript / mypy / etc.
**Command:** `npm run typecheck`
**Exit Code:** 0 ✅ / non-zero ❌
**Type Errors:** X

**Timestamp:** YYYY-MM-DD HH:MM:SS
```

---

## Quality Standards

### Minimum Acceptable

✅ **Tests executed** with captured exit code
✅ **Timestamp** recorded
✅ **Evidence stored** in context

### Production-Grade

✅ **Tests pass** (exit code 0)
✅ **Coverage ≥70%** (or project standard)
✅ **Build succeeds** (exit code 0)
✅ **No critical linter errors**
✅ **Type checker passes**
✅ **Security scan** shows no critical issues

### Gold Standard

✅ All production-grade requirements
✅ **Coverage ≥80%**
✅ **No linter warnings**
✅ **Performance benchmarks** within thresholds
✅ **Accessibility audit** passes (WCAG 2.1 AA)
✅ **Integration tests** pass
✅ **Deployment verification** complete

---

## Common Pitfalls

### ❌ Don't Skip Evidence Collection

**Bad:**
```
"I've implemented the login feature. It should work correctly."
```

**Good:**
```
"I've implemented the login feature. Evidence:
- Tests: Exit code 0, 12 tests passed, 0 failed
- Build: Exit code 0, no errors
- Coverage: 89%
Task complete with verification."
```

### ❌ Don't Fake Evidence

**Bad:**
```
"Tests passed" (without actually running them)
```

**Good:**
```
"Tests passed. Exit code: 0
Command: npm test
Output: Test Suites: 3 passed, 3 total
Timestamp: 2025-11-02 10:30:15"
```

### ❌ Don't Ignore Failed Evidence

**Bad:**
```
"Build failed with exit code 1, but the code looks correct so marking complete."
```

**Good:**
```
"Build failed with exit code 1. Errors:
- TypeError: Cannot read property 'id' of undefined (line 42)
Fixing the error now before marking complete."
```

---

## Quick Reference

### Evidence Collection Checklist

```markdown
Before marking task complete:

- [ ] Tests executed
- [ ] Test exit code captured (0 = pass)
- [ ] Build executed (if applicable)
- [ ] Build exit code captured (0 = pass)
- [ ] Code quality checks run (linter, types)
- [ ] Evidence documented with timestamp
- [ ] Evidence added to shared context
- [ ] Evidence summary in completion message
```

### Common Commands by Language/Framework

**JavaScript/TypeScript:**
```bash
npm test                 # Run tests
npm run build           # Build project
npm run lint            # Run ESLint
npm run typecheck       # Run TypeScript compiler
```

**Python:**
```bash
pytest                  # Run tests
pytest --cov           # Run tests with coverage
ruff check .           # Run linter
mypy .                 # Run type checker
```

---

**Remember:** Evidence-first development prevents hallucinations, ensures production quality, and builds confidence. When in doubt, collect more evidence, not less.
