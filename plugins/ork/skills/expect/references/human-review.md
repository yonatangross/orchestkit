# Human-in-the-Loop Plan Review (#1179)

Present the generated test plan to the user for review before execution.

## Flow

```
Diff Scan → Plan Generated → [REVIEW GATE] → Execute → Report
                                   ↓
                        AskUserQuestion:
                        "Run this plan?"
                        ├── Run (proceed)
                        ├── Edit (modify)
                        └── Skip (cancel)
```

## Implementation

```python
if not SKIP_REVIEW:  # -y flag bypasses
    AskUserQuestion(questions=[{
        "question": f"Run this test plan? ({step_count} steps across {page_count} pages)",
        "header": "Plan",
        "options": [
            {
                "label": "Run (Recommended)",
                "description": f"{step_count} steps, ~{estimated_time}s",
                "preview": test_plan_preview  # First 20 lines of the plan
            },
            {
                "label": "Edit plan",
                "description": "Modify steps before running"
            },
            {
                "label": "Skip",
                "description": "Cancel without running"
            }
        ],
        "multiSelect": False
    }])
```

## Edit Mode

When "Edit plan" is selected:
1. Present the full test plan as editable text
2. User modifies (add/remove/reorder steps)
3. Re-validate step count against scope strategy limits
4. Proceed to execution with modified plan

## Skip Scenarios

The review is automatically skipped when:
- `-y` flag is passed
- Running in CI (`CI=true`)
- Fingerprint matched (no test to run)
- Saved flow replay (`--flow` flag — flow is pre-approved)

## Progressive Feedback

After the user approves, show incremental progress:
```
Executing test plan...
  ✓ /login — 3/3 steps passed (2.1s)
  ◌ /dashboard — running step 2/4...
  ○ /settings — pending
```
