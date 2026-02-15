# Continuous Feedback Loop

Maintain a feedback loop throughout implementation.

## After Each Task Completion

Quick checkpoint:
- What was completed
- Tests pass/fail
- Actual vs estimated time
- Blockers encountered
- Scope deviations

Update task status with `TaskUpdate(taskId, status="completed")`.

## Feedback Triggers

| Trigger | Action |
|---------|--------|
| Task takes 2x estimated time | Pause, reassess scope |
| Test keeps failing | Consider design issue, not just implementation |
| Scope creep detected | Stop, discuss with user |
| Blocker found | Create blocking task, switch to parallel work |
