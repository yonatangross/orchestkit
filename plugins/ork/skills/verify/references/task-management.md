# Task Management (CC 2.1.16)


```python
# 0. Check TaskList first. If tasks already exist, reuse or clear per session rules
#    before creating; do not assume a fresh empty list or fixed numeric ids.
existing = TaskList()

# 1. Create main verification task
TaskCreate(
  subject="Verify [feature-name] implementation",
  description="Comprehensive verification with nuanced grading",
  activeForm="Verifying [feature-name] implementation"
)

# 2. Create subtasks for 8-phase process; capture each returned id
quality_result = TaskCreate(subject="Run code quality checks", activeForm="Running quality checks")
quality_id = quality_result["task"]["id"]
security_result = TaskCreate(subject="Execute security audit", activeForm="Running security audit")
security_id = security_result["task"]["id"]
coverage_result = TaskCreate(subject="Verify test coverage", activeForm="Verifying test coverage")
coverage_id = coverage_result["task"]["id"]
api_result = TaskCreate(subject="Validate API", activeForm="Validating API")
api_id = api_result["task"]["id"]
ui_result = TaskCreate(subject="Check UI/UX", activeForm="Checking UI/UX")
ui_id = ui_result["task"]["id"]
grading_result = TaskCreate(subject="Calculate grades", activeForm="Calculating grades")
grading_id = grading_result["task"]["id"]
suggestions_result = TaskCreate(subject="Generate suggestions", activeForm="Generating suggestions")
suggestions_id = suggestions_result["task"]["id"]
report_result = TaskCreate(subject="Compile report", activeForm="Compiling report")
report_id = report_result["task"]["id"]

# 3. Set dependencies — phases 2-6 run in parallel, 7-9 are sequential
TaskUpdate(taskId=grading_id, addBlockedBy=[quality_id, security_id, coverage_id, api_id, ui_id])  # Grading needs all checks
TaskUpdate(taskId=suggestions_id, addBlockedBy=[grading_id])  # Suggestions need grades
TaskUpdate(taskId=report_id, addBlockedBy=[suggestions_id])  # Report needs suggestions

# 4. Update status as you progress
TaskUpdate(taskId=quality_id, status="in_progress")  # When starting
TaskUpdate(taskId=quality_id, status="completed")    # When done — repeat for each subtask
```
