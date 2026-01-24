---
name: fix-issue
description: Fix GitHub issue with parallel analysis and implementation. Use when fixing issues, resolving bugs, closing GitHub issues.
context: fork
version: 2.0.0
author: OrchestKit
tags: [issue, bug-fix, github, debugging, rca, prevention]
user-invocable: true
allowedTools: [Bash, Read, Write, Edit, Task, TaskCreate, TaskUpdate, Grep, Glob, mcp__memory__search_nodes, mcp__context7__get-library-docs]
skills: [commit, explore, verify, debug-investigator, recall, remember]
---

# Fix Issue

Systematic issue resolution with hypothesis-based root cause analysis, similar issue detection, and prevention recommendations.

## Quick Start

```bash
/fix-issue 123
/fix-issue 456
```

---

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main fix task IMMEDIATELY
TaskCreate(
  subject="Fix issue #{number}",
  description="Systematic issue resolution with hypothesis-based RCA",
  activeForm="Fixing issue #{number}"
)

# 2. Create subtasks for each phase (10-phase process)
TaskCreate(subject="Understand the issue", activeForm="Understanding issue")
TaskCreate(subject="Search for similar issues", activeForm="Searching similar issues")
TaskCreate(subject="Form hypotheses with confidence", activeForm="Forming hypotheses")
TaskCreate(subject="Analyze root cause", activeForm="Analyzing root cause")
TaskCreate(subject="Design fix approach", activeForm="Designing fix")
TaskCreate(subject="Implement fix", activeForm="Implementing fix")
TaskCreate(subject="Validate fix", activeForm="Validating fix")
TaskCreate(subject="Generate prevention recommendations", activeForm="Generating prevention recommendations")
TaskCreate(subject="Create runbook entry", activeForm="Creating runbook")
TaskCreate(subject="Capture lessons learned", activeForm="Capturing lessons")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

---

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Understand Issue** | Read GitHub issue details | Problem statement |
| **2. Similar Issue Detection** | Search for related past issues | Related issues list |
| **3. Hypothesis Formation** | Form hypotheses with confidence scores | Ranked hypotheses |
| **4. Root Cause Analysis** | Parallel investigation | Confirmed root cause |
| **5. Fix Design** | Design approach based on RCA | Fix specification |
| **6. Implementation** | Apply fix with tests | Working code |
| **7. Validation** | Verify fix resolves issue | Evidence |
| **8. Prevention Recommendations** | How to prevent recurrence | Prevention plan |
| **9. Runbook Generation** | Create/update runbook entry | Runbook |
| **10. Lessons Learned** | Capture knowledge | Persisted learnings |

---

## Phase 1: Understand the Issue

```bash
# Get full issue details
gh issue view $ARGUMENTS --json title,body,labels,assignees,comments

# Check related PRs
gh pr list --search "issue:$ARGUMENTS"

# Check issue history
gh issue view $ARGUMENTS --comments
```

### Issue Context Template

```markdown
## Issue Summary
- **Number:** #$ARGUMENTS
- **Title:** [title]
- **Type:** [bug/feature/task]
- **Severity:** [critical/high/medium/low]
- **Reported:** [date]
- **Reporter:** [user]

## Symptoms
- [What the user observed]
- [Error messages if any]
- [Reproduction steps if provided]

## Expected Behavior
- [What should happen]

## Actual Behavior
- [What actually happens]
```

---

## Phase 2: Similar Issue Detection (NEW)

**Goal:** Find related past issues to leverage previous solutions.

### Search for Similar Issues

```bash
# Search in GitHub issues
gh issue list --search "[key error message]" --state all --json number,title,state,closedAt

# Search in memory for past fixes
mcp__memory__search_nodes(query="issue [error type] fix")
mcp__memory__search_nodes(query="bug [component name]")
```

### Similarity Assessment

| Similar Issue | Similarity | Status | Relevant? |
|---------------|------------|--------|-----------|
| #101 | 85% | Closed | Yes - same error type |
| #89 | 60% | Closed | Partial - different context |
| #145 | 40% | Open | No - superficial match |

### Extract Insights from Similar Issues

```python
Task(
  subagent_type="debug-investigator",
  prompt="""SIMILAR ISSUE ANALYSIS for issue #$ARGUMENTS

  Review similar past issues:
  [list of similar issues]

  For each similar issue, extract:
  1. Root cause that was identified
  2. Fix that was applied
  3. Time to resolution
  4. Any prevention measures taken

  Determine:
  - Is this a regression? (same issue recurring)
  - Is this a variant? (similar but different)
  - Is this new? (no similar issues)

  SUMMARY: End with: "SIMILAR: [N] related issues - [regression/variant/new] - [key insight]"
  """,
  run_in_background=True
)
```

---

## Phase 3: Hypothesis Formation with Confidence Scores (NEW)

**Goal:** Form multiple hypotheses about root cause, each with a confidence score.

### Hypothesis Template

```markdown
## Hypothesis 1: [Brief name]
**Confidence:** [0-100]%
**Description:** [What might be causing the issue]
**Evidence For:**
- [Supporting evidence]
**Evidence Against:**
- [Contradicting evidence]
**Test:** [How to verify this hypothesis]

## Hypothesis 2: [Brief name]
**Confidence:** [0-100]%
...
```

### Confidence Score Guidelines

| Confidence | Meaning | Evidence Required |
|------------|---------|-------------------|
| 90-100% | Near certain | Multiple strong evidence, reproduction |
| 70-89% | Highly likely | Clear evidence, logical chain |
| 50-69% | Probable | Some evidence, plausible |
| 30-49% | Possible | Limited evidence, needs investigation |
| 0-29% | Unlikely | Weak evidence, keeping as backup |

### Parallel Hypothesis Testing

```python
# PARALLEL - Test top 3 hypotheses simultaneously
Task(
  subagent_type="debug-investigator",
  prompt="""TEST HYPOTHESIS 1: [hypothesis name]

  Confidence before: [N]%

  Investigation steps:
  1. [Step 1 to verify/refute]
  2. [Step 2 to verify/refute]

  Find evidence for or against this hypothesis.
  Update confidence based on findings.

  SUMMARY: End with: "HYPOTHESIS 1: [CONFIRMED|REFUTED|INCONCLUSIVE] - Confidence now [M]% - [key finding]"
  """,
  run_in_background=True
)
# Repeat for hypotheses 2 and 3
```

---

## Phase 4: Root Cause Analysis (5 Agents)

**Goal:** Parallel deep investigation to confirm root cause.

Launch ALL 5 agents in ONE message with `run_in_background: true`:

```python
# PARALLEL - All 5 agents in ONE message
Task(
  subagent_type="debug-investigator",
  prompt="""ROOT CAUSE ANALYSIS for issue #$ARGUMENTS

  Based on confirmed hypothesis: [hypothesis]

  Investigate the root cause:
  1. Trace the error from symptoms to source
  2. Identify the exact code location
  3. Determine why this code is failing
  4. Identify the triggering conditions

  Output:
  {
    "root_cause": {
      "location": "file:line",
      "description": "...",
      "trigger": "...",
      "confidence": N%
    },
    "code_path": ["file1:line", "file2:line", ...],
    "contributing_factors": [...]
  }

  SUMMARY: End with: "ROOT CAUSE: [location] - [brief description] - [confidence]%"
  """,
  run_in_background=True
)

Task(
  subagent_type="debug-investigator",
  prompt="""IMPACT ANALYSIS for issue #$ARGUMENTS

  Analyze the impact:
  1. What functionality is affected?
  2. What other code depends on this?
  3. What tests need updating?
  4. Are there other occurrences of similar patterns?

  SUMMARY: End with: "IMPACT: [N] files, [M] tests affected - [scope: isolated/moderate/widespread]"
  """,
  run_in_background=True
)

Task(
  subagent_type="backend-system-architect",
  prompt="""BACKEND FIX DESIGN for issue #$ARGUMENTS

  Design the backend fix:
  1. What code changes are needed?
  2. API or database changes?
  3. Error handling improvements?
  4. Backward compatibility concerns?

  SUMMARY: End with: "BACKEND FIX: [N] files - [key change]"
  """,
  run_in_background=True
)

Task(
  subagent_type="frontend-ui-developer",
  prompt="""FRONTEND FIX DESIGN for issue #$ARGUMENTS

  Design the frontend fix:
  1. Component changes needed?
  2. State management updates?
  3. Error handling improvements?
  4. User feedback for edge cases?

  SUMMARY: End with: "FRONTEND FIX: [N] components - [key change]"
  """,
  run_in_background=True
)

Task(
  subagent_type="test-generator",
  prompt="""TEST REQUIREMENTS for issue #$ARGUMENTS

  Identify test requirements:
  1. Regression test to catch this specific issue
  2. Existing tests to update
  3. Edge cases to cover
  4. Integration test needed?

  SUMMARY: End with: "TESTS: Add [N] tests, update [M] - [key test: regression test name]"
  """,
  run_in_background=True
)
```

---

## Phase 5: Fix Design

### Fix Specification

```markdown
## Fix Design for Issue #$ARGUMENTS

### Root Cause (Confirmed)
[Brief description of root cause]

### Proposed Fix
[Description of the fix approach]

### Files to Modify
| File | Change | Reason |
|------|--------|--------|
| [file] | [MODIFY/CREATE/DELETE] | [why] |

### Tests to Add
| Test | Type | Verifies |
|------|------|----------|
| test_[name] | Unit | [what] |
| test_[name] | Integration | [what] |

### Risks
- [Potential risk 1]
- [Potential risk 2]

### Rollback Plan
[How to revert if fix causes issues]
```

---

## Phase 6: Implementation

```bash
# Create feature branch
git checkout dev
git pull origin dev
git checkout -b issue/$ARGUMENTS-fix
```

### Implementation Guidelines

- Make minimal, focused changes
- Add proper error handling
- Include type hints
- DO NOT over-engineer
- Add regression test FIRST

---

## Phase 7: Validation

```bash
# Backend
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run ty check app/
poetry run pytest tests/unit/ -v --tb=short

# Frontend
cd frontend
npm run format:check
npm run lint
npm run typecheck
npm run test

# Run the specific regression test
poetry run pytest tests/unit/test_issue_$ARGUMENTS.py -v
```

---

## Phase 8: Prevention Recommendations (NEW)

**Goal:** Identify how to prevent this class of issues from recurring.

```python
Task(
  subagent_type="workflow-architect",
  prompt="""PREVENTION ANALYSIS for issue #$ARGUMENTS

  Root cause: [confirmed root cause]

  Analyze how to prevent similar issues:

  1. CODE-LEVEL PREVENTION
     - Defensive coding patterns
     - Type safety improvements
     - Validation additions

  2. ARCHITECTURE-LEVEL PREVENTION
     - Design pattern changes
     - Interface improvements
     - Abstraction opportunities

  3. PROCESS-LEVEL PREVENTION
     - Code review focus areas
     - Testing requirements
     - Documentation needs

  4. TOOLING-LEVEL PREVENTION
     - Linting rules to add
     - Pre-commit hooks
     - CI/CD checks

  Output:
  {
    "code_level": [{"change": "...", "effort": N, "impact": N}],
    "architecture_level": [...],
    "process_level": [...],
    "tooling_level": [...],
    "priority_recommendation": "..."
  }

  SUMMARY: End with: "PREVENTION: [N] recommendations - priority: [top recommendation]"
  """,
  run_in_background=True
)
```

### Prevention Categories

| Category | Examples | Implementation |
|----------|----------|----------------|
| Code-level | Null checks, validation | Immediate |
| Architecture | Better error boundaries | Sprint planning |
| Process | Review checklist item | Team discussion |
| Tooling | ESLint rule | DevOps ticket |

---

## Phase 9: Runbook Generation (NEW)

**Goal:** Create or update runbook entry for this type of issue.

### Runbook Entry Template

```markdown
# Runbook: [Issue Type]

## Symptoms
- [Observable symptom 1]
- [Observable symptom 2]
- [Error message pattern]

## Likely Causes
1. [Cause 1] - [how to verify]
2. [Cause 2] - [how to verify]

## Diagnosis Steps
1. Check [X] by running: `[command]`
2. Look for [Y] in [location]
3. Verify [Z] by [action]

## Resolution Steps
### If Cause 1:
1. [Step 1]
2. [Step 2]

### If Cause 2:
1. [Step 1]
2. [Step 2]

## Verification
- [ ] [How to verify fix worked]
- [ ] [Additional verification]

## Prevention
- [How to prevent recurrence]

## Related Issues
- #[related issue numbers]

## Last Updated
[Date] - Issue #$ARGUMENTS
```

### Store Runbook

```python
# Save runbook to memory
mcp__memory__create_entities(entities=[{
  "name": "runbook-[issue-type]",
  "entityType": "Runbook",
  "observations": [
    "symptoms: [list]",
    "causes: [list]",
    "resolution: [steps]",
    "related_issues: #$ARGUMENTS"
  ]
}])
```

---

## Phase 10: Lessons Learned Capture (NEW)

**Goal:** Persist knowledge for future issue resolution.

### Lessons Learned Template

```python
Task(
  subagent_type="workflow-architect",
  prompt="""LESSONS LEARNED from issue #$ARGUMENTS

  Capture knowledge from this fix:

  1. WHAT WE LEARNED
     - New understanding about the system
     - Debugging techniques that worked
     - Red herrings that wasted time

  2. WHAT SHOULD CHANGE
     - Documentation to update
     - Patterns to adopt/avoid
     - Testing gaps identified

  3. TIME ANALYSIS
     - Time to identify root cause: [X]
     - Time to implement fix: [Y]
     - What would have been faster: [Z]

  4. SIMILAR FUTURE ISSUES
     - How to recognize this pattern faster
     - Key diagnostic commands/checks
     - Shortcuts for next time

  Output:
  {
    "key_learnings": [...],
    "changes_needed": [...],
    "time_spent": {"rca": "...", "fix": "...", "total": "..."},
    "future_shortcuts": [...],
    "update_documentation": [...]
  }

  SUMMARY: End with: "LESSONS: [N] learnings - key: [most important lesson]"
  """,
  run_in_background=True
)
```

### Persist Lessons

```python
# Store lessons in memory
mcp__memory__create_entities(entities=[{
  "name": "lessons-issue-$ARGUMENTS",
  "entityType": "LessonsLearned",
  "observations": [
    "issue: #$ARGUMENTS",
    "root_cause: [brief]",
    "fix_approach: [brief]",
    "key_learning: [most important]",
    "time_to_resolve: [duration]",
    "prevention: [recommendation]"
  ]
}])
```

---

## Phase 11: Commit and PR

```bash
git add .
git commit -m "fix(#$ARGUMENTS): [Brief description]

Root cause: [one line description]
Prevention: [one line recommendation]"

git push -u origin issue/$ARGUMENTS-fix
gh pr create --base dev --title "fix(#$ARGUMENTS): [Brief description]" --body "
## Summary
Fixes #$ARGUMENTS

## Root Cause
[Description]

## Changes
- [Change 1]
- [Change 2]

## Testing
- [x] Regression test added
- [x] All tests pass

## Prevention
[Recommendation to prevent recurrence]
"
```

---

## Summary

**Total Parallel Agents: 7**
- Phase 4 (RCA): 5 agents
- Phase 6 (Implementation): 2 agents

**New Phases (v2.0.0):**
- Similar Issue Detection
- Hypothesis Formation with Confidence
- Prevention Recommendations
- Runbook Generation
- Lessons Learned Capture

---

**Version:** 2.0.0 (January 2026)

**v2.0.0 Enhancements:**
- Added **Similar Issue Detection**: Search for related past issues before investigation
- Added **Hypothesis-Based RCA**: Form hypotheses with confidence scores (0-100%)
- Added **Prevention Recommendations**: How to prevent this class of issues
- Added **Runbook Generation**: Create/update runbook entry for future reference
- Added **Lessons Learned Capture**: Persist knowledge for faster future resolution
- Expanded from 8-phase to 11-phase process

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hypothesis confidence | 0-100% scale | Quantifies certainty, guides investigation priority |
| Similar issue search | Before hypothesis | Leverage past solutions, detect regressions |
| Prevention analysis | Mandatory phase | Break the cycle of recurring issues |
| Runbook generation | Template-based | Consistent, actionable documentation |
| Lessons persistence | Memory MCP | Build institutional knowledge over time |

## Related Skills
- commit: Commit issue fixes
- debug-investigator: Debug complex issues
- errors: Handle error patterns
- issue-progress-tracking: Auto-updates issue checkboxes from commits
- remember: Store lessons learned

## References

- [Commit Template](assets/commit-template.md)
