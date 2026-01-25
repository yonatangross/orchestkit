# Quality Gate Workflows Reference

Detailed workflows for quality gate validation and task management.

---

## Workflow 1: Pre-Task Gate Validation

**When:** Before starting any task (especially Level 3-5)

### Step 1: Assess Complexity
```
Read task description
Count file changes needed
Estimate lines of code
Identify dependencies
Count unknowns
-> Assign complexity score (1-5)
```

### Step 2: Identify Critical Questions
```
What must I know to complete this?
- Data structures?
- Expected behaviors?
- Edge cases?
- Error handling?
- API contracts?

-> List all critical questions
-> Count unanswered questions
```

### Step 3: Check Dependencies
```
What does this task depend on?
- Other tasks?
- External services?
- Database changes?
- Configuration?

-> Verify dependencies ready
-> List blockers
```

### Step 4: Gate Decision
```javascript
if (unansweredQuestions > 3) return BLOCKED;
if (missingDependencies > 0) return BLOCKED;
if (complexity >= 4 && !hasPlan) return BLOCKED;
if (complexity == 3) return WARNING;
return PASS;
```

### Step 5: Document in Context
```javascript
context.quality_gates.push({
  task_id: taskId,
  timestamp: new Date().toISOString(),
  complexity_score: 3,
  gate_status: 'pass',
  critical_questions: [...],
  can_proceed: true
});
```

---

## Workflow 2: Stuck Detection & Escalation

**When:** After multiple failed attempts at same task

### Step 1: Track Attempts
```javascript
if (!context.attempt_tracking[taskId]) {
  context.attempt_tracking[taskId] = {
    attempts: [],
    first_attempt: new Date().toISOString()
  };
}

context.attempt_tracking[taskId].attempts.push({
  timestamp: new Date().toISOString(),
  approach: "Describe what was tried",
  outcome: "Failed because X",
  error_message: "Error details"
});
```

### Step 2: Check Threshold
```javascript
const attemptCount = context.attempt_tracking[taskId].attempts.length;

if (attemptCount >= 3) {
  return {
    status: 'blocked',
    reason: 'stuck_after_3_attempts',
    escalate_to: 'user',
    attempts_history: context.attempt_tracking[taskId].attempts
  };
}
```

### Step 3: Escalation Message
```markdown
## Escalation: Task Stuck

**Task:** [Task description]
**Attempts:** 3
**Status:** BLOCKED - Need human guidance

### What Was Tried
1. **Attempt 1:** [Approach] -> Failed: [Reason]
2. **Attempt 2:** [Approach] -> Failed: [Reason]
3. **Attempt 3:** [Approach] -> Failed: [Reason]

### Current Blocker
[Describe the persistent problem]

### Need Guidance On
- [Specific question 1]
- [Specific question 2]

**Recommendation:** Human review needed to unblock
```

---

## Workflow 3: Complexity Breakdown (Level 4-5)

**When:** Assigned a Level 4 or 5 complexity task

### Step 1: Break Down into Subtasks
```markdown
## Task Breakdown: [Main Task]
**Overall Complexity:** Level 4

### Subtasks
1. **Subtask 1:** [Description]
   - Complexity: Level 2
   - Dependencies: None
   - Estimated: 2 hours

2. **Subtask 2:** [Description]
   - Complexity: Level 3
   - Dependencies: Subtask 1
   - Estimated: 4 hours

3. **Subtask 3:** [Description]
   - Complexity: Level 2
   - Dependencies: Subtask 2
   - Estimated: 2 hours

**Total Estimated:** 8 hours
**Complexity Check:** All subtasks <= Level 3
```

### Step 2: Validate Breakdown
```
Check:
- [ ] All subtasks are Level 1-3
- [ ] Dependencies clearly mapped
- [ ] Each subtask has clear acceptance criteria
- [ ] Sum of estimates reasonable
- [ ] No overlapping work
- [ ] No circular dependencies
```

### Step 3: Create Execution Plan
```markdown
## Execution Plan

**Phase 1:** Subtask 1
- Start: After requirements confirmed
- Gate check: Pass
- Evidence: Tests pass, build succeeds

**Phase 2:** Subtask 2
- Start: After Subtask 1 complete
- Gate check: Verify Subtask 1 evidence
- Evidence: Integration tests pass

**Phase 3:** Subtask 3
- Start: After Subtask 2 complete
- Gate check: End-to-end verification
- Evidence: Full feature tests pass
```

---

## Workflow 4: Requirements Completeness Check

**When:** Starting a new feature or significant task

### Functional Requirements Check
```markdown
- [ ] **Happy path defined:** What should happen when everything works?
- [ ] **Error cases defined:** What should happen when things fail?
- [ ] **Edge cases identified:** What are the boundary conditions?
- [ ] **Input validation:** What inputs are valid/invalid?
- [ ] **Output format:** What should the output look like?
- [ ] **Success criteria:** How do we know it works?
```

### Technical Requirements Check
```markdown
- [ ] **API contracts:** Endpoints, methods, schemas defined?
- [ ] **Data structures:** Models, types, interfaces specified?
- [ ] **Database changes:** Schema migrations needed?
- [ ] **Authentication:** Who can access this?
- [ ] **Performance:** Any latency/throughput requirements?
- [ ] **Security:** Any special security considerations?
```

### Count Critical Unknowns
```javascript
const criticalUnknowns = [
  !functionalRequirements.happyPath,
  !functionalRequirements.errorCases,
  !technicalRequirements.apiContracts,
  !technicalRequirements.dataStructures
].filter(unknown => unknown).length;

if (criticalUnknowns > 3) {
  return {
    gate_status: 'blocked',
    reason: 'incomplete_requirements',
    critical_unknowns: criticalUnknowns,
    action: 'clarify_requirements'
  };
}
```

---

## Best Practices

### 1. Always Run Gate Check Before Starting
```javascript
// GOOD: Gate check first
function startTask(task) {
  const gateCheck = runQualityGate(task);

  if (gateCheck.status === 'blocked') {
    escalate(gateCheck.reason);
    return;
  }

  if (gateCheck.status === 'warning') {
    documentAssumptions(gateCheck.warnings);
  }

  implementTask(task);
}
```

### 2. Document All Assumptions
```markdown
When proceeding with warnings, document assumptions:

## Assumptions Made
1. **Assumption:** API will return JSON format
   **Risk:** Low - standard REST practice
   **Mitigation:** Add try-catch for parsing

2. **Assumption:** User authentication already implemented
   **Risk:** Medium - might not exist
   **Mitigation:** Check early, escalate if missing
```

### 3. Track Attempts for Stuck Detection
```javascript
function attemptTask(taskId, approach) {
  trackAttempt(taskId, approach);

  const attemptCount = getAttemptCount(taskId);
  if (attemptCount >= 3) {
    escalateToUser(taskId);
    return 'blocked';
  }

  return executeApproach(approach);
}
```

### 4. Break Down Complex Tasks Proactively
```javascript
function handleComplexTask(task) {
  if (task.complexity >= 4) {
    const subtasks = breakDownIntoSubtasks(task);

    subtasks.forEach(subtask => {
      runQualityGate(subtask);
      implementSubtask(subtask);
    });
  } else {
    implementTask(task);
  }
}
```