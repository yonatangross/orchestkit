---
title: Done Sign-off
impact: HIGH
impactDescription: Closes a task only when the person accepts the verified result, never on the agent's own word
tags: [verification, completion, askuserquestion, cross-cutting]
---

## Done is a sign-off, not a claim

Use after `verification-gate.md` has produced fresh evidence. The gate proves the
work; the sign-off lets the person accept it. Skills that load this rule: `verify`
(always, at the end of its report) and `glyph --signoff` (appended to any render).

### The gate

Lead with any FAIL. Then ask one question with exactly these three options, in this
order, with these labels:

```python
AskUserQuestion(questions=[{
  "question": "<work>: <grade line>. Accept as done?",
  "header": "Sign-off",
  "multiSelect": False,
  "options": [
    {"label": "Accept done", "description": "Verified; close it out."},
    {"label": "Show me the evidence", "description": "Re-run one check live, then ask again."},
    {"label": "Not satisfied", "description": "Something is off; say what to re-check."}
  ]
}])
```

`<grade line>` is the verdict in the caller's own scale. From `verify`, that is the composite
and the verdict, for example `7.8/10, IMPROVEMENTS RECOMMENDED` (scores are 0 to 10). From
`glyph --signoff` or any skill without a grade, it is the count of checks that ran, for example
`11 of 12 checks passed`.

- **"Accept done"**: the work is closed. Not before.
- **"Show me the evidence"**: re-run the named check in the main thread, paste the
  output, then ask again.
- **"Not satisfied"**: treat the answer as a bug report. Fix, re-verify, ask again.

### Incorrect

```
All 12 checks pass. Done!
```

The agent closed its own task. Nobody accepted it, and a check that failed
earlier in the run is not in the reply.

### Correct

```
❌ 1 of 12 failed: docs build (exit 1, generate-search-index).
✅ 11 of 12 passed (tests 412/412, typecheck 0 errors).
```

Then the gate above, with `<grade line>` = `11 of 12 checks passed` (or, from `verify`,
`6.4/10, BLOCKED`).

### When to skip the gate

- Non-interactive runs (`claude -p`, a `Workflow` script, a background subagent)
  cannot call `AskUserQuestion`. Return the verdict as data
  (`{passed, total, findings[]}`) and let the main thread ask.
- `ORK_ASK_FALLBACK=text` is set: ask the same three options as a numbered text
  list with the same labels.
- Pure conversation or a one-line doc edit: no gate.
