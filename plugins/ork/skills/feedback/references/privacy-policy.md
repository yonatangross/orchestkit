# Privacy Policy Reference

> Anonymous analytics privacy documentation for OrchestKit Claude Plugin

## Overview

OrchestKit offers **optional** anonymous analytics to help improve the plugin. This is strictly **opt-in** - no data is collected without explicit user consent.

## What We Collect

When you opt in, we collect only aggregated, non-identifiable metrics:

| Data Type | Example | Purpose |
|-----------|---------|---------|
| Skill usage counts | "api-design: 45 uses" | Identify popular skills |
| Skill success rates | "92% success" | Improve underperforming skills |
| Agent spawn counts | "backend-architect: 8 spawns" | Agent utilization |
| Agent success rates | "88% tasks completed" | Agent effectiveness |
| Hook trigger counts | "git-branch-protection: 120 triggers" | Hook tuning |
| Hook block counts | "5 commands blocked" | Security effectiveness |
| Plugin version | "4.12.0" | Version adoption |
| Report date | "2026-01-14" | Trend analysis |

## What We Never Collect

The following are **explicitly blocked** from collection:

- Your code or file contents
- Project names, paths, or directory structure
- User names, emails, or personal information
- IP addresses (stripped at network layer)
- mem0 memory data or conversation history
- Architecture decisions or design documents
- API keys, tokens, or credentials
- Git history or commit messages
- Session IDs or user identifiers
- Any data that could identify you or your projects

## PII Detection

Before any data export, we scan for:

```bash
# Blocked patterns (excerpt from analytics-lib.sh)
/Users/, /home/, /var/, /tmp/    # File paths
@                                 # Email indicators
http://, https://                 # URLs
password, secret, token, api_key  # Credentials
username, user_id, email          # Identifiers
[0-9]{1,3}\.[0-9]{1,3}...        # IP addresses
```

If **any** PII pattern is detected, the export is **aborted**.

## Consent Management

### Granting Consent

```bash
# Via command
/ork:feedback opt-in

# What happens:
# 1. consent-log.json records: {"action": "granted", "version": "1.0", "timestamp": "..."}
# 2. preferences.json sets: shareAnonymized = true
```

### Revoking Consent

```bash
# Via command
/ork:feedback opt-out

# What happens:
# 1. consent-log.json records: {"action": "revoked", "timestamp": "..."}
# 2. preferences.json sets: shareAnonymized = false
# 3. No further data collection occurs
```

### Checking Status

```bash
/ork:feedback status
# Shows: consent state, timestamp, policy version
```

## Data Flow

```
Session Activity
      │
      ▼
┌──────────────┐
│ Local Metrics│ ← Stored in .claude/feedback/metrics.json
│  (always)    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Consent Check    │ ← has_consent() must return true
└──────┬───────────┘
       │
       ▼ (only if consented)
┌──────────────────┐
│ PII Validation   │ ← validate_no_pii() scans all data
└──────┬───────────┘
       │
       ├── PII Found → ABORT
       │
       └── Clean → Export/Send
```

## Transmission (Optional)

If network transmission is enabled:

- **HTTPS only** - encrypted in transit
- **No cookies** - no session tracking
- **No IP logging** - server strips client IP
- **Best effort** - no retries on failure
- **Open source server** - auditable code

Default behavior is **local export only** with no network calls.

## Data Retention

| Stage | Retention |
|-------|-----------|
| Local metrics | User-controlled (default 90 days) |
| Server raw reports | Deleted after aggregation (max 30 days) |
| Aggregate statistics | Indefinite (no PII) |

## GDPR Compliance

This implementation follows GDPR requirements:

1. **Explicit consent** - opt-in only, no pre-checked boxes
2. **Informed consent** - clear disclosure of what's collected
3. **Easy withdrawal** - opt-out as easy as opt-in
4. **Audit trail** - consent-log.json records all actions
5. **Data minimization** - only collect what's needed
6. **Purpose limitation** - only used for plugin improvement

## Files

| File | Purpose |
|------|---------|
| `.claude/feedback/preferences.json` | Contains `shareAnonymized` flag |
| `.claude/feedback/consent-log.json` | Audit trail of consent actions |
| `.claude/feedback/metrics.json` | Local metrics (always stored) |
| `.claude/feedback/analytics-exports/` | Exported reports for review |

## Commands Reference

| Command | Description |
|---------|-------------|
| `/ork:feedback opt-in` | Enable anonymous sharing |
| `/ork:feedback opt-out` | Disable sharing (revoke consent) |
| `/ork:feedback status` | Show current consent status |
| `/ork:feedback export` | Export data for review |
| `/ork:feedback privacy` | Display full privacy policy |

## Contact

- **Repository**: https://github.com/yonatangross/orchestkit-claude-plugin
- **Issues**: https://github.com/yonatangross/orchestkit-claude-plugin/issues