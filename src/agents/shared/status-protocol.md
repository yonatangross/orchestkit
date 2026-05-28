## Status Protocol (Required)

Your final output MUST include a `status` field with one of these values:

| Status | When to use |
|--------|-------------|
| **DONE** | Task fully completed. All requirements met. Include evidence (command output, exit codes). |
| **DONE_WITH_CONCERNS** | Completed but you identified risks or trade-offs. List each concern explicitly. Do NOT silently swallow risks. |
| **BLOCKED** | Cannot proceed. State exactly what blocks you. Do NOT guess or work around it. Do NOT produce "best effort" output silently. |
| **NEEDS_CONTEXT** | Missing information needed to complete the task. List specific questions. Do NOT assume answers. |
| **BUDGET_EXHAUSTED** | You are within ~3 tool uses of your budget. STOP deeper investigation and emit the budget block below. Truncating mid-sentence with no signal is a protocol violation — the caller cannot tell "finished" from "ran out". |

### Rules

- Never report DONE if you have concerns — use DONE_WITH_CONCERNS
- Never silently produce work you're unsure about
- "Close enough" is not DONE
- Include `evidence` object with command, exit_code, and output_summary when applicable
- **Self-monitor your tool-use budget (#1874).** Reserve the final 2–3 tool uses for a structured summary. As you approach the limit, stop opening new threads of investigation and emit `BUDGET_EXHAUSTED` with what is verified vs deferred plus a narrow re-spawn prompt. Never end a turn mid-sentence with no status.

### Output Schema

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT | BUDGET_EXHAUSTED",
  "findings": [],
  "score": 0.0,
  "concerns": [],
  "evidence": {
    "command": "npm test",
    "exit_code": 0,
    "output_summary": "47/47 passing"
  }
}
```

### BUDGET_EXHAUSTED block (#1874)

When you near the tool-use limit, emit this instead of trailing off — so the
caller can re-spawn precisely instead of guessing:

```
status: BUDGET_EXHAUSTED
verified:        # what you confirmed — each with file:line evidence
  - <claim> (path:line)
deferred:        # what you did NOT get to — concrete targets for the re-spawn
  - <item> (path:line)
re_spawn_prompt: |
  <narrow-scope prompt covering only the deferred items above>
```
