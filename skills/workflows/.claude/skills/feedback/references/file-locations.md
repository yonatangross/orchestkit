# Feedback File Locations

All feedback data is stored locally in the project.

## Storage Paths

```
.claude/feedback/
├── preferences.json      # User preferences and settings
├── metrics.json          # Skill and agent usage metrics
├── learned-patterns.json # Auto-approve patterns and code style
└── satisfaction.json     # Session satisfaction tracking
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
  "syncGlobalPatterns": true,
  "retentionDays": 90,
  "pausedUntil": null
}
```

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