## Status Protocol (Required)

Your final output MUST include a `status` field with one of these values:

| Status | When to use |
|--------|-------------|
| **DONE** | Task fully completed. All requirements met. Include evidence (command output, exit codes). |
| **DONE_WITH_CONCERNS** | Completed but you identified risks or trade-offs. List each concern explicitly. Do NOT silently swallow risks. |
| **BLOCKED** | Cannot proceed. State exactly what blocks you. Do NOT guess or work around it. Do NOT produce "best effort" output silently. |
| **NEEDS_CONTEXT** | Missing information needed to complete the task. List specific questions. Do NOT assume answers. |

### Rules

- Never report DONE if you have concerns — use DONE_WITH_CONCERNS
- Never silently produce work you're unsure about
- "Close enough" is not DONE
- Include `evidence` object with command, exit_code, and output_summary when applicable

### Output Schema

```json
{
  "status": "DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT",
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
