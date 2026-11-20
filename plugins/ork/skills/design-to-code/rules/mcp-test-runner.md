---
title: MCP Test Runner
impact: CRITICAL
impactDescription: Automated test + a11y verification closes the generate-verify loop without manual intervention
tags: [storybook-mcp, testing, a11y, self-healing, testing-toolset]
---

# MCP Test Runner

Use `run-story-tests` to verify components pass both functional and accessibility tests after generation.

## Pattern: Generate → Test → Self-Heal

```python
# Step 1: Generate component + story
Write("src/components/Modal/Modal.tsx", component_code)
Write("src/components/Modal/Modal.stories.tsx", story_code)

# Step 2: Run tests via MCP (with a11y enabled)
results = run-story-tests(
    stories=[{ "storyId": "modal--default" }, { "storyId": "modal--open" }],
    a11y=True  # default: true
)

# Step 3: Handle results
if results.all_passed:
    # Success — component is verified
    preview-stories(stories=[...])  # Show user the result
else:
    # Self-heal: read violations, fix, retry
    for failure in results.failures:
        if failure.type == "a11y":
            # Fix accessibility violation (e.g., missing aria-label)
            fix_a11y_violation(failure.violation)
        elif failure.type == "interaction":
            # Fix interaction test failure
            fix_interaction(failure.error)

    # Retry (max 3 attempts)
    results = run-story-tests(stories=[...], a11y=True)
```

## Incorrect

```python
# BAD: Generate component without any verification
Write("src/components/Modal/Modal.tsx", component_code)
# "Done! I've created the Modal component."
# (No tests run, no a11y check, no visual preview)
```

## Correct

```python
# GOOD: Full verification loop
Write("src/components/Modal/Modal.tsx", component_code)
Write("src/components/Modal/Modal.stories.tsx", story_code)

results = run-story-tests(a11y=True)  # Omit stories[] to run ALL tests
# Results: 12 passed, 1 failed (a11y: missing aria-label on close button)

# Fix the violation
Edit("src/components/Modal/Modal.tsx",
     old_string='<button onClick={onClose}>',
     new_string='<button onClick={onClose} aria-label="Close modal">')

# Re-run the failing test
results = run-story-tests(
    stories=[{ "storyId": "modal--open" }],
    a11y=True
)
# Results: 1 passed

# Show preview
preview-stories(stories=[{ "storyId": "modal--default" }])
# "Modal component verified: all tests pass, a11y clean. Preview: [URL]"
```

## Run All vs Specific Stories

```python
# Run ALL tests (useful for full verification):
run-story-tests(a11y=True)

# Run specific stories (useful for targeted re-test after fix):
run-story-tests(
    stories=[{ "storyId": "modal--open" }],
    a11y=True
)
```

## Self-Healing Limits

- Max 3 retry attempts per component
- If still failing after 3 attempts, report failures to user with details
- Never suppress test failures — always surface them
