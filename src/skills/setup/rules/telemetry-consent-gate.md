---
title: Require explicit opt-in before enabling any telemetry or analytics
impact: HIGH
impactDescription: "Enabling telemetry without consent violates user trust, may breach GDPR/CCPA, and sends potentially sensitive project data to external endpoints"
tags: telemetry, consent, privacy, phase-9, webhooks
---

## Telemetry Consent Gate

Phase 9 (Telemetry & Webhooks) must require explicit, informed opt-in before configuring any data collection. Never default to enabled, never bundle telemetry with other setup steps.

## Problem

The setup wizard configures "full streaming" telemetry as part of a batch operation, or pre-selects it as the default option. The user clicks through quickly and doesn't realize 18 Claude Code events are now being sent to an external webhook URL, potentially including file paths, tool invocations, and session metadata.

**Incorrect -- telemetry enabled by default or bundled with other config:**
```python
# Phase 9: Configure telemetry (default: full streaming)
AskUserQuestion(questions=[{
    "question": "Configure telemetry?",
    "options": [
        {"label": "Full streaming (Recommended)", "description": "All 18 CC events"},  # Pre-selected
        {"label": "Summary only", "description": "SessionEnd + worktree events"},
        {"label": "Skip", "description": "No telemetry"}
    ]
}])

# If user picked "Full streaming", immediately configure
webhook_url = "https://company-default.example.com/hooks"  # Hardcoded default
Bash(command=f'npm run generate:http-hooks -- {webhook_url} --write')
# No explanation of what data is sent, no consent trail
```

**Correct -- informed consent with explicit opt-in, no pre-selection:**
```python
# Phase 9: Telemetry requires separate, informed consent
# Step 1: Explain what telemetry collects
AskUserQuestion(questions=[{
    "question": "OrchestKit can send usage events to a webhook for team analytics. "
        + "This is fully optional and disabled by default.\n\n"
        + "Data sent includes: tool invocations, session duration, skill usage, "
        + "error counts. NO file contents, NO prompts, NO code snippets.",
    "header": "Telemetry Setup (Optional)",
    "options": [
        {"label": "Skip (Default)", "description": "No telemetry -- no data leaves your machine"},
        {"label": "Summary only", "description": "Only session-end summaries"},
        {"label": "Full streaming", "description": "All 18 event types -- requires webhook URL"}
    ]
}])

# Step 2: If user explicitly chose telemetry, require their own URL
if user_choice != "Skip":
    webhook_url = AskUserQuestion(questions=[{
        "question": "Enter your webhook URL (no default -- you must provide your own):",
    }])
    if not webhook_url or not webhook_url.startswith("https://"):
        # Refuse non-HTTPS endpoints
        report("Webhook URL must use HTTPS. Skipping telemetry configuration.")
        return

    # Step 3: Confirm before writing
    AskUserQuestion(questions=[{
        "question": f"Confirm: send {user_choice} events to {webhook_url}?",
        "options": [
            {"label": "Confirm", "description": "Write config and enable"},
            {"label": "Cancel", "description": "Do not enable telemetry"}
        ]
    }])
```

**Key rules:**
- "Skip" / disabled must always be the default option (listed first, no pre-selection)
- Explain exactly what data is collected before asking for consent
- Never hardcode or suggest a default webhook URL -- the user must provide their own
- Require HTTPS for all webhook endpoints -- reject plain HTTP
- Require a separate confirmation step after the user provides their URL
- Store consent choice in `.claude/orchestration/config.json` with a timestamp for audit
- On `--rescan`, never re-enable telemetry that was previously skipped
