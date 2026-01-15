# Feedback File Locations

All feedback data is stored locally in the project.

## Storage Paths

```
.claude/feedback/
├── preferences.json       # User preferences and settings
├── metrics.json           # Skill and agent usage metrics
├── learned-patterns.json  # Auto-approve patterns and code style
├── satisfaction.json      # Session satisfaction tracking
├── consent-log.json       # GDPR consent audit trail (#59)
├── analytics-sent.json    # Transmission history (if enabled)
└── analytics-exports/     # Anonymous analytics exports for review
    └── analytics-export-*.json
```

## File Descriptions

### preferences.json
```json
{
  "version": "1.0",
  "enabled": true,
  "learnFromEdits": true,
  "learnFromApprovals": true,
  "learnFromAgentOutcomes": true,
  "shareAnonymized": false,
  "consentedAt": null,
  "consentVersion": null,
  "syncGlobalPatterns": true,
  "retentionDays": 90,
  "pausedUntil": null
}
```

### consent-log.json (GDPR Audit Trail)

Records all consent actions for GDPR compliance. Created by `consent-manager.sh`.

```json
{
  "version": "1.0",
  "events": [
    {
      "action": "granted",
      "version": "1.0",
      "timestamp": "2026-01-14T10:00:00Z"
    },
    {
      "action": "revoked",
      "timestamp": "2026-01-15T14:00:00Z"
    }
  ]
}
```

**Event Actions:**
- `granted` - User opted in (includes policy version)
- `declined` - User said "No Thanks" on first prompt
- `revoked` - User opted out after previously opting in

### metrics.json
```json
{
  "version": "1.0",
  "updated": "2026-01-14T10:00:00Z",
  "skills": { ... },
  "hooks": { ... },
  "agents": { ... }
}
```

### learned-patterns.json
```json
{
  "version": "1.0",
  "updated": "2026-01-14T10:00:00Z",
  "permissions": { ... },
  "codeStyle": { ... }
}
```

### analytics-export-*.json

Anonymous analytics exports for user review before sharing.

```json
{
  "timestamp": "2026-01-14",
  "plugin_version": "4.12.0",
  "skill_usage": {
    "<skill-id>": { "uses": 12, "success_rate": 0.92 }
  },
  "agent_performance": {
    "<agent-id>": { "spawns": 8, "success_rate": 0.88 }
  },
  "hook_metrics": {
    "<hook-name>": { "triggered": 45, "blocked": 3 }
  },
  "summary": {
    "unique_skills_used": 8,
    "unique_agents_used": 3,
    "hooks_configured": 5,
    "total_skill_invocations": 45,
    "total_agent_spawns": 12
  },
  "metadata": {
    "exported_at": "2026-01-14T12:00:00Z",
    "format_version": "1.0",
    "note": "Review before sharing"
  }
}
```

## Gitignore

All files in `.claude/feedback/` are gitignored by default.

Add to your `.gitignore`:
```
.claude/feedback/
```

## Global Patterns

Cross-project patterns are stored at:
```
~/.claude/global-patterns.json
```

This file is shared across all projects when `syncGlobalPatterns` is enabled.

## Scripts

### consent-manager.sh (#59)

Manages GDPR-compliant consent for anonymous analytics.

```
.claude/scripts/consent-manager.sh
```

Key functions:
- `has_consent()` - Check if user has consented
- `has_been_asked()` - Check if user was ever prompted
- `record_consent()` - Record opt-in with timestamp
- `record_decline()` - Record "No Thanks" response
- `revoke_consent()` - Record opt-out (revocation)
- `get_consent_status()` - Get full consent state as JSON
- `show_opt_in_prompt()` - Display interactive prompt
- `show_privacy_policy()` - Display full privacy policy
- `show_consent_status()` - Display human-readable status

### analytics-lib.sh

Prepares anonymous analytics data.

```
.claude/scripts/analytics-lib.sh
```

Key functions:
- `prepare_anonymous_report()` - Aggregate anonymized data
- `get_shareable_metrics()` - Get only safe-to-share metrics
- `validate_no_pii(data)` - Verify no PII in data
- `export_analytics(filepath)` - Export to file for user review
- `opt_in_analytics()` - Enable anonymous sharing
- `opt_out_analytics()` - Disable anonymous sharing

### analytics-sender.sh (#59 - Optional)

Handles optional network transmission (disabled by default).

```
.claude/scripts/analytics-sender.sh
```

Key functions:
- `is_transmission_enabled()` - Check if network send is enabled
- `send_analytics_report()` - Send to configured endpoint
- `show_transmission_status()` - Show send history

**Note:** Network transmission requires:
1. User consent (`has_consent()` = true)
2. Endpoint configured (`SKILLFORGE_ANALYTICS_ENDPOINT`)
3. Network enabled (`enableNetworkTransmission` in preferences)

## Schemas

```
.claude/schemas/
├── feedback.schema.json   # Metrics, patterns, preferences schemas
└── consent.schema.json    # Consent log schema (#59)
```