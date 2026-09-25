# Task Management (CC 2.1.16)


```python
# 1. Create main verification task
TaskCreate(
  subject="Verify [feature-name] implementation",
  description="Comprehensive verification with nuanced grading",
  activeForm="Verifying [feature-name] implementation"
)

# 2. Create subtasks for 8-phase process
TaskCreate(subject="Run code quality checks", activeForm="Running quality checks")    # id=2
TaskCreate(subject="Execute security audit", activeForm="Running security audit")     # id=3
TaskCreate(subject="Verify test coverage", activeForm="Verifying test coverage")      # id=4
TaskCreate(subject="Validate API", activeForm="Validating API")                       # id=5
TaskCreate(subject="Check UI/UX", activeForm="Checking UI/UX")                       # id=6
TaskCreate(subject="Calculate grades", activeForm="Calculating grades")               # id=7
TaskCreate(subject="Generate suggestions", activeForm="Generating suggestions")       # id=8
TaskCreate(subject="Compile report", activeForm="Compiling report")                   # id=9

# 3. Set dependencies — phases 2-6 run in parallel, 7-9 are sequential
TaskUpdate(taskId="7", addBlockedBy=["2", "3", "4", "5", "6"])  # Grading needs all checks
TaskUpdate(taskId="8", addBlockedBy=["7"])  # Suggestions need grades
TaskUpdate(taskId="9", addBlockedBy=["8"])  # Report needs suggestions

# 4. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask
```
