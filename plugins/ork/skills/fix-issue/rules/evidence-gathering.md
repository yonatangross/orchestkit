---
title: "Evidence Gathering"
impact: HIGH
impactDescription: "Fixing without evidence leads to wrong root cause, wasted effort, and regressions"
tags: debugging, root-cause, investigation, reproduction
---

# Evidence Gathering Patterns

## Verify User Intent (STEP 0)

**BEFORE creating tasks**, clarify fix approach with AskUserQuestion:

```python
AskUserQuestion(
  questions=[{
    "question": "What approach for this fix?",
    "header": "Approach",
    "options": [
      {"label": "Proper fix (Recommended)", "description": "Full RCA, tests, prevention recommendations", "markdown": "```\nProper Fix (11 phases)\n──────────────────────\n  Issue ──▶ RCA ──▶ Fix ──▶ Prevent\n  ┌─────┐  ┌─────┐  ┌─────┐  ┌───────┐\n  │Read │  │5-Why│  │Code │  │Tests  │\n  │issue│  │Fish │  │impl │  │Runbook│\n  │+hist│  │bone │  │+test│  │Lessons│\n  └─────┘  └─────┘  └─────┘  └───────┘\n  5 parallel agents for RCA\n  Regression test BEFORE fix\n  Prevention + lessons learned\n```"},
      {"label": "Quick fix", "description": "Minimal fix to resolve the immediate issue", "markdown": "```\nQuick Fix (phases 1-7)\n──────────────────────\n  Issue ──▶ Diagnose ──▶ Fix\n  ┌─────┐   ┌────────┐  ┌─────┐\n  │Read │   │Focused │  │Code │\n  │issue│   │RCA     │  │+test│\n  └─────┘   └────────┘  └─────┘\n  Skip: prevention, runbook,\n  lessons learned phases\n  Still requires regression test\n```"},
      {"label": "Investigate first", "description": "Understand the issue before deciding on approach", "markdown": "```\nInvestigate Only (phases 1-4)\n─────────────────────────────\n  Issue ──▶ Search ──▶ Hypotheses\n  ┌─────┐  ┌──────┐  ┌──────────┐\n  │Read │  │Find  │  │Rank by   │\n  │issue│  │similar│  │confidence│\n  └─────┘  └──────┘  └──────────┘\n  Output: Root cause analysis\n  NO code changes made\n  Decide approach after findings\n```"},
      {"label": "Hotfix", "description": "Emergency patch, minimal testing", "markdown": "```\nHotfix (minimal)\n────────────────\n  Issue ──▶ Fix ──▶ Ship\n  ┌─────┐  ┌────┐  ┌────┐\n  │Skim │  │Min │  │Push│\n  │issue│  │fix │  │now │\n  └─────┘  └────┘  └────┘\n  Skip: similar issue search,\n  deep RCA, prevention\n  ⚠ Follow up with proper fix\n```"},
      {"label": "Plan first", "description": "Investigate root cause in plan mode before fixing", "markdown": "```\nPlan Mode Investigation\n──────────────────────\n  1. EnterPlanMode("Issue #$ISSUE")\n  2. Read issue + repro\n  3. Trace code paths\n  4. Identify root cause\n  5. ExitPlanMode → fix plan\n  6. User approves approach\n  7. Implement fix + tests\n\n  Best for: Complex bugs,\n  regressions, multi-file fixes\n```"}
    ],
    "multiSelect": false
  }]
)
```

**If 'Plan first' selected:** Call `EnterPlanMode("Investigate issue #$ISSUE: $TITLE")`, perform research using Read/Grep/Glob only, then `ExitPlanMode` with the plan for user approval before proceeding.

**Based on answer, adjust workflow:**
- **Proper fix**: All 11 phases, parallel agents for RCA
- **Quick fix**: Skip phases 8-10 (prevention, runbook, lessons)
- **Investigate first**: Only phases 1-4 (understand, search, hypotheses, analyze)
- **Hotfix**: Minimal phases, skip similar issue search

**Incorrect:**
```python
# Jump straight to code without understanding the issue
Edit(file_path="src/auth.py", old_string="return token", new_string="return new_token")
```

**Correct:**
```python
# Gather evidence first: read issue, search codebase, form hypotheses
Read(file_path="src/auth.py")
Grep(pattern="token.*expir", path="src/")
# Hypothesis: token refresh skips validation (confidence: 75%)
```

## Hypothesis Confidence Scale

| Confidence | Meaning |
|------------|---------|
| 90-100% | Near certain |
| 70-89% | Highly likely |
| 50-69% | Probable |
| 30-49% | Possible |
| 0-29% | Unlikely |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Feature branch | MANDATORY | Never commit to main/dev directly |
| Regression test | MANDATORY | Fix without test is incomplete |
| Hypothesis confidence | 0-100% scale | Quantifies certainty |
| Similar issue search | Before hypothesis | Leverage past solutions |
| Prevention analysis | Mandatory phase | Break recurring issue cycle |
| Runbook generation | Template-based | Consistent documentation |
