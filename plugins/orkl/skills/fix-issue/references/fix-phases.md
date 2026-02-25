# Fix Issue: 11-Phase Workflow

Detailed procedures for each phase of the fix-issue workflow.

---

## Phase 1: Understand the Issue

```bash
gh issue view $ARGUMENTS --json title,body,labels,assignees,comments
gh pr list --search "issue:$ARGUMENTS"
gh issue view $ARGUMENTS --comments
```

**Start Work ceremony** (from `issue-progress-tracking`): move issue to in-progress, comment on issue, ensure branch is named `issue/N-description`.

---

## Phase 2: Similar Issue Detection

See [Similar Issue Search](similar-issue-search.md) for patterns.

```bash
gh issue list --search "[key error message]" --state all
mcp__memory__search_nodes(query="issue [error type] fix")
```

| Similar Issue | Similarity | Status | Relevant? |
|---------------|------------|--------|-----------|
| #101 | 85% | Closed | Yes |

**Determine:** Regression? Variant? New issue?

---

## Phase 3: Hypothesis Formation

See [Hypothesis-Based RCA](hypothesis-rca.md) for confidence scoring.

```markdown
## Hypothesis 1: [Brief name]
**Confidence:** [0-100]%
**Description:** [What might cause the issue]
**Test:** [How to verify]
```

| Confidence | Meaning |
|------------|---------|
| 90-100% | Near certain |
| 70-89% | Highly likely |
| 50-69% | Probable |
| 30-49% | Possible |
| 0-29% | Unlikely |

---

## Phase 4: Root Cause Analysis (5 Agents)

Launch ALL 5 agents in parallel with `run_in_background=True` and `max_turns=25`:

1. **debug-investigator**: Root cause tracing
2. **debug-investigator**: Impact analysis
3. **backend-system-architect**: Backend fix design
4. **frontend-ui-developer**: Frontend fix design
5. **test-generator**: Test requirements

Each agent outputs structured JSON with findings and SUMMARY line.

### Agent Teams Alternative

> See [agent-teams-rca.md](agent-teams-rca.md) for Agent Teams root cause analysis workflow.

---

## Phase 5: Fix Design

```markdown
## Fix Design for Issue #$ARGUMENTS

### Root Cause (Confirmed)
[Description]

### Proposed Fix
[Approach]

### Files to Modify
| File | Change | Reason |
|------|--------|--------|
| [file] | MODIFY | [why] |

### Risks
- [Risk 1]

### Rollback Plan
[How to revert]
```

---

## Phase 6: Implementation

### CRITICAL: Feature Branch Required

**NEVER commit directly to main or dev.** Always create a feature branch:

```bash
# Determine base branch
BASE_BRANCH=$(git remote show origin | grep 'HEAD branch' | cut -d: -f2 | tr -d ' ')

# Create feature branch (MANDATORY)
git checkout $BASE_BRANCH && git pull origin $BASE_BRANCH
git checkout -b issue/$ARGUMENTS-fix
```

### CRITICAL: Regression Test Required

**A fix without a test is incomplete.** Add test BEFORE implementing fix:

```bash
# 1. Write test that reproduces the bug (should FAIL)
# 2. Implement the fix
# 3. Verify test now PASSES
```

**Guidelines:**
- Make minimal, focused changes
- Add proper error handling
- Add regression test FIRST (MANDATORY)
- DO NOT over-engineer
- DO NOT commit directly to protected branches

---

## Phase 7: Validation

```bash
# Backend
poetry run ruff format --check app/
poetry run pytest tests/unit/ -v --tb=short

# Frontend
npm run lint && npm run typecheck && npm run test
```

---

## Phase 8: Prevention Recommendations

**CRITICAL: Prevention must include at least one of:**
1. **Automated test** - CI catches similar issues (PREFERRED)
2. **Validation rule** - Schema/lint rule prevents bad state
3. **Process check** - Review checklist item

See [Prevention Patterns](prevention-patterns.md) for full template.

| Category | Examples | Effectiveness |
|----------|----------|---------------|
| **Automated test** | Unit/integration test in CI | HIGH - catches before merge |
| **Validation rule** | Schema check, lint rule | HIGH - catches on save/commit |
| Architecture | Better error boundaries | MEDIUM |
| Process | Review checklist item | LOW - human-dependent |

---

## Phase 9: Runbook Generation

```markdown
# Runbook: [Issue Type]

## Symptoms
- [Observable symptom]

## Diagnosis Steps
1. Check [X] by running: `[command]`

## Resolution Steps
1. [Step 1]

## Prevention
- [How to prevent]
```

Store in memory for future reference.

---

## Phase 10: Lessons Learned

```python
mcp__memory__create_entities(entities=[{
  "name": "lessons-issue-$ARGUMENTS",
  "entityType": "LessonsLearned",
  "observations": [
    "root_cause: [brief]",
    "key_learning: [most important]",
    "prevention: [recommendation]"
  ]
}])
```

---

## Phase 11: Commit and PR

```bash
git add .
git commit -m "fix(#$ARGUMENTS): [Brief description]

Root cause: [one line]
Prevention: [recommendation]"

git push -u origin issue/$ARGUMENTS-fix
gh pr create --base dev --title "fix(#$ARGUMENTS): [description]"
```
