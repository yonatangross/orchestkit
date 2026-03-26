# Test Plan Generation

Build an AI-driven test plan scoped to the git diff and affected routes.

## Plan Structure

```markdown
# Test Plan — 2026-03-26T16:30:00Z
Target: unstaged (3 files changed)
Instruction: "test the login flow"

## Pages to Test

### /login (Direct — auth form changed)
1. Navigate to /login
2. Verify form renders with email + password fields
3. Submit empty form → expect validation errors
4. Fill valid credentials → expect redirect to /dashboard
5. Check console for errors

### /signup (Imported — shared auth component changed)
1. Navigate to /signup
2. Verify form renders correctly
3. Smoke test: no console errors

### /dashboard (Routed — renders auth-dependent header)
1. Navigate to /dashboard (requires auth)
2. Verify page loads without crash
3. Check user name renders in header
```

## Prompt Template

```python
PLAN_PROMPT = f"""
You are a QA engineer. Generate a browser test plan.

**Git Diff Summary:**
{diff_summary}

**Changed Files (Level 1 — Direct):**
{direct_files}

**Affected Files (Level 2 — Imported):**
{imported_files}

**Pages to Test (Level 3 — Routed):**
{affected_urls}

**User Instruction:**
{instruction or "Test that the changes work correctly and don't break existing functionality."}

**Rules:**
- Test each page proportional to its change level (Direct=full, Imported=render, Routed=smoke)
- Include form interaction tests if forms were changed
- Include navigation tests if routing changed
- Check for console errors on every page
- Note any accessibility concerns from the diff
- Keep the plan under 20 steps total

Output a numbered test plan in markdown.
"""
```

## Plan Review

Unless `-y` (skip review) is set, present the plan to the user:

```python
AskUserQuestion(questions=[{
    "question": "Run this test plan?",
    "header": "Plan",
    "options": [
        {"label": "Run (Recommended)", "description": f"{step_count} steps across {page_count} pages"},
        {"label": "Edit", "description": "Modify the plan before running"},
        {"label": "Skip", "description": "Cancel without running"}
    ],
    "multiSelect": False
}])
```
