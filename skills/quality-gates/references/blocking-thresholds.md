# Blocking Thresholds Reference

Detailed guide for quality gate blocking conditions and escalation.

---

## BLOCKING Conditions

These conditions MUST be resolved before proceeding:

### 1. Incomplete Requirements (>3 critical questions)

If you have more than 3 unanswered critical questions, **STOP**.

**Examples of critical questions:**
- "What should happen when X fails?"
- "What data structure should I use?"
- "What's the expected behavior for edge case Y?"
- "Which API should I call?"
- "What authentication method?"
- "What's the expected response format?"
- "Who is the target user for this feature?"

**Action:** List all critical questions and request clarification before proceeding.

---

### 2. Missing Dependencies (blocked by another task)

**Indicators:**
- Task depends on incomplete work
- Required API endpoint doesn't exist
- Database schema not ready
- External service not configured
- Required library not installed
- Configuration not set up

**Action:** Identify the blocking dependency and escalate or wait for resolution.

---

### 3. Stuck Detection (3 attempts at same task)

**Indicators:**
- Tried 3 different approaches, all failed
- Keep encountering the same error
- Can't find necessary information
- Solution keeps breaking other things
- Circular problem (fixing A breaks B, fixing B breaks A)

**Action:** Escalate to user with detailed attempt history.

---

### 4. Evidence Failure (tests/builds failing)

**Indicators:**
- Tests fail after 2 fix attempts
- Build breaks after changes
- Type errors persist
- Integration tests failing
- Linting errors that can't be resolved

**Action:** Analyze root cause, document failures, and escalate if unable to resolve.

---

### 5. Complexity Overflow (Level 4-5 tasks without breakdown)

**Indicators:**
- Complex task not broken into subtasks
- No clear implementation plan
- Too many unknowns
- Scope unclear
- No acceptance criteria defined

**Action:** Break down into Level 1-3 subtasks before proceeding.

---

## WARNING Conditions

Can proceed with caution, but document assumptions:

### 1. Moderate Complexity (Level 3)

- Can proceed but should verify approach first
- Document assumptions
- Plan for checkpoints
- Consider asking for validation mid-way

### 2. 1-2 Unanswered Questions

- Document assumptions
- Proceed with best guess
- Note for review later
- Flag for user during review

### 3. 1-2 Failed Attempts

- Try alternative approach
- Document what didn't work
- Consider asking for help before third attempt

---

## Escalation Protocol

### When to Escalate

| Condition | Trigger | Action |
|-----------|---------|--------|
| Critical Questions | > 3 unanswered | Ask user for clarification |
| Missing Dependencies | Any blocking | Report and wait/suggest alternatives |
| Stuck | 3 attempts failed | Full escalation with history |
| Evidence Failure | 2 fix attempts | Report failures, ask for guidance |
| Complexity Overflow | Level 4-5 no plan | Request breakdown approval |

### Escalation Message Template

```markdown
## Escalation: Task Blocked

**Task:** [Task description]
**Block Type:** [Critical Questions / Dependencies / Stuck / Evidence / Complexity]
**Attempts:** [Count if applicable]

### Current Blocker
[Describe the persistent problem]

### What Was Tried (if applicable)
1. **Attempt 1:** [Approach] - Failed: [Reason]
2. **Attempt 2:** [Approach] - Failed: [Reason]
3. **Attempt 3:** [Approach] - Failed: [Reason]

### Need Guidance On
- [Specific question 1]
- [Specific question 2]

**Recommendation:** [What might unblock this]
```

---

## Gate Decision Logic

```
function evaluateGate(task):
    if (unansweredCriticalQuestions > 3):
        return BLOCKED("incomplete_requirements")

    if (hasMissingDependencies):
        return BLOCKED("missing_dependencies")

    if (attemptCount >= 3):
        return BLOCKED("stuck_after_3_attempts")

    if (hasFailingEvidence && fixAttempts >= 2):
        return BLOCKED("evidence_failure")

    if (complexity >= 4 && !hasBreakdown):
        return BLOCKED("complexity_overflow")

    if (complexity == 3 || unansweredQuestions in [1, 2]):
        return WARNING("proceed_with_caution")

    return PASS("can_proceed")
```

---

## Attempt Tracking

```javascript
// Track every attempt at a task
context.attempt_tracking[taskId] = {
  attempts: [
    {
      timestamp: "2024-01-15T10:30:00Z",
      approach: "Tried approach X",
      outcome: "Failed because Y",
      error_message: "Error details"
    }
  ],
  first_attempt: "2024-01-15T10:00:00Z"
};

// Check if should escalate
if (context.attempt_tracking[taskId].attempts.length >= 3) {
  escalateToUser(taskId, context.attempt_tracking[taskId]);
}
```