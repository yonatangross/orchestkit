# Execution Engine

Run the test plan via agent-browser orchestration.

## Agent Spawn

```python
Agent(
    subagent_type="general-purpose",
    prompt=f"""Execute this browser test plan using the agent-browser skill.

{test_plan}

Base URL: {base_url}

For each test step:
1. Execute the action (navigate, click, fill, assert)
2. Report PASS or FAIL immediately
3. On FAIL: take a screenshot, capture console errors, note the failure reason
4. Continue to next step (don't stop on first failure)

Output format per step:
PASS | Step N: description
FAIL | Step N: description | Reason: error message

After all steps, output a summary:
TOTAL: X passed, Y failed
""",
    run_in_background=True
)
```

## Status Protocol

The agent reports status using a machine-parseable format:

```
[EXPECT:START] 12 steps across 4 pages
[EXPECT:STEP:1:PASS] /login — page loads
[EXPECT:STEP:2:PASS] /login — form renders
[EXPECT:STEP:3:FAIL] /login — validation error missing | TypeError: Cannot read properties of undefined
[EXPECT:STEP:4:PASS] /signup — page loads
...
[EXPECT:DONE] 10 passed, 2 failed
```

## Failure Handling

| Failure Type | Action |
|-------------|--------|
| Page crash (5xx) | Screenshot + skip remaining steps on that page |
| Element not found | Screenshot + retry once after 2s wait |
| Assertion mismatch | Screenshot + continue |
| Network timeout | Retry once, then fail |
| Console error | Log but don't fail (unless assertion requires no errors) |

## Concurrency

For multiple pages, test sequentially (not parallel) to avoid port/state conflicts.
Single browser instance, sequential navigation.

## Artifacts

Store all artifacts in `.expect/`:
```
.expect/
├── reports/2026-03-26T16-30-00.json
├── screenshots/
│   ├── login-step3-fail.png
│   └── dashboard-step7-fail.png
└── fingerprints.json  (updated after run)
```
