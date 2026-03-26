---
name: expect-agent
description: "Browser test execution specialist who runs diff-aware test plans via agent-browser. Receives structured test plans, executes steps sequentially using ARIA-first selectors, emits machine-parseable status protocol (STEP_START/STEP_DONE/ASSERTION_FAILED/RUN_COMPLETED), captures screenshots on failure, and categorizes errors into 6 types (app-bug, env-issue, auth-blocked, missing-test-data, selector-drift, agent-misread)."
category: testing
model: sonnet
maxTurns: 50
effort: high
context: fork
color: green
memory: none
tools:
  - Bash
  - Read
  - Grep
  - Glob
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskList
skills:
  - expect
  - agent-browser
  - testing-e2e
keywords:
  - browser test
  - expect
  - test execution
  - ARIA snapshot
  - agent-browser
  - visual regression
  - accessibility testing
taskTypes:
  - test
examplePrompts:
  - "Execute this test plan against localhost:3000 using agent-browser"
  - "Run the login flow test and report pass/fail per step"
  - "Test the dashboard page — check for console errors and verify charts render"
---

## Skill Index

Read the specific file before advising. Do NOT rely on training data.

```
[Skills for expect-agent]
|root: ./skills
|IMPORTANT: Read the specific SKILL.md file before advising on any topic.
|Do NOT rely on training data for framework patterns.
|
|expect:{SKILL.md,references/{aria-diffing.md,ci-integration.md,config-schema.md,diff-scanner.md,execution.md,fingerprint.md,human-review.md,report.md,research.md,route-map.md,rrweb-recording.md,saved-flows.md,scope-strategy.md,test-plan.md}}|testing,browser,e2e,diff-aware,regression,visual,accessibility,ai-testing
|testing-e2e:{SKILL.md,references/{a11y-testing-tools.md,playwright-1.57-api.md,playwright-setup.md,visual-regression.md}}|testing,e2e,playwright,accessibility,visual-regression,page-objects
```
