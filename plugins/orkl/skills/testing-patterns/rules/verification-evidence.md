---
title: Require evidence verification for task completion to detect hidden failures and regressions
impact: MEDIUM
impactDescription: "Tasks marked complete without evidence often contain undetected failures and quality regressions"
tags: evidence, verification, testing, quality, exit-code, coverage
---

## Evidence Verification for Task Completion

**Incorrect -- claiming completion without proof:**
```markdown
"I've implemented the login feature. It should work correctly."
# No tests run, no build verified, no evidence collected
```

**Correct -- evidence-backed task completion:**
```markdown
"I've implemented the login feature. Evidence:
- Tests: Exit code 0, 12 tests passed, 0 failed
- Build: Exit code 0, no errors
- Coverage: 89%
- Timestamp: 2026-02-13 10:30:15
Task complete with verification."
```

**Evidence collection protocol:**
```markdown
## Before Marking Task Complete

1. **Identify Verification Points**
   - What needs to be proven?
   - What could go wrong?

2. **Execute Verification**
   - Run tests (capture exit code)
   - Run build (capture exit code)
   - Run linters/type checkers

3. **Capture Results**
   - Record exit codes (0 = pass)
   - Save output snippets
   - Note timestamps

4. **Minimum Requirements:**
   - [ ] At least ONE verification type executed
   - [ ] Exit code captured (0 = pass)
   - [ ] Timestamp recorded

5. **Production-Grade Requirements:**
   - [ ] Tests pass (exit code 0)
   - [ ] Coverage >= 70%
   - [ ] Build succeeds (exit code 0)
   - [ ] No critical linter errors
   - [ ] Type checker passes
```

**Common commands for evidence collection:**
```bash
# JavaScript/TypeScript
npm test                 # Run tests
npm run build           # Build project
npm run lint            # ESLint
npm run typecheck       # TypeScript compiler

# Python
pytest                  # Run tests
pytest --cov           # Tests with coverage
ruff check .           # Linter
mypy .                 # Type checker
```

Key principles:
- Show, don't tell -- no task is complete without verifiable evidence
- Never fake evidence or mark tasks complete on failed evidence
- Exit code 0 is the universal success indicator
- Re-collect evidence after any changes
- Minimum coverage: 70% (production-grade), 80% (gold standard)
