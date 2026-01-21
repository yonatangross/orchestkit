# Version Management Guide

Reference guide for managing skill versions with safe rollback capability.

## Version Structure

Each skill can have versioned snapshots stored in:

```
skills/<category>/<skill-name>/
├── SKILL.md                 # Current version
├── SKILL.md        # Current metadata
├── references/              # Current references
├── scripts/               # Current templates
└── versions/
    ├── manifest.json        # Version history metadata
    ├── 1.0.0/
    │   ├── SKILL.md
    │   ├── SKILL.md
    │   ├── references/
    │   └── CHANGELOG.md
    └── 1.1.0/
        ├── SKILL.md
        ├── SKILL.md
        ├── references/
        └── CHANGELOG.md
```

## Manifest Schema

The `manifest.json` tracks version history:

```json
{
  "$schema": "../../../../../../.claude/schemas/skill-evolution.schema.json",
  "skillId": "api-design-framework",
  "currentVersion": "1.2.0",
  "versions": [
    {
      "version": "1.0.0",
      "date": "2025-11-01",
      "successRate": 0.78,
      "uses": 45,
      "avgEdits": 3.2,
      "changelog": "Initial release"
    },
    {
      "version": "1.1.0",
      "date": "2026-01-05",
      "successRate": 0.89,
      "uses": 80,
      "avgEdits": 1.8,
      "changelog": "Added pagination pattern (85% users added manually)"
    }
  ],
  "suggestions": [],
  "editPatterns": {},
  "lastAnalyzed": "2026-01-14T10:30:00Z"
}
```

## Versioning Workflow

### Creating a Version

1. **Before making changes**, create a version snapshot:
   ```bash
   version-manager.sh create <skill-id> "Description of changes"
   ```

2. The system:
   - Bumps version number (patch by default)
   - Copies current files to `versions/<new-version>/`
   - Records current metrics in manifest
   - Creates CHANGELOG.md

### Comparing Versions

Compare two versions to see what changed:

```bash
version-manager.sh diff <skill-id> 1.0.0 1.1.0
```

Shows:
- File differences (unified diff)
- Metrics comparison (success rate, uses, avg edits)

### Restoring a Version

If a change causes problems, rollback:

```bash
version-manager.sh restore <skill-id> <version>
```

The system:
1. Backs up current version to `.backup-<version>-<timestamp>`
2. Copies snapshot files to skill root
3. Updates manifest with rollback entry

## Automatic Safety Checks

### Rollback Triggers

The system monitors for:

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Success rate drop | -20% | Warning + rollback suggestion |
| Avg edits increase | +50% | Warning (users fighting skill) |
| Consecutive failures | 5+ | Alert to review |

### Health Check Integration

The posttool hooks monitor skill health:

```bash
check_skill_health() {
    local skill_id="$1"
    local current_rate=$(get_recent_success_rate "$skill_id" 10)
    local baseline_rate=$(get_version_baseline "$skill_id")

    if (( $(echo "$baseline_rate - $current_rate > 0.20" | bc -l) )); then
        echo "WARNING: $skill_id dropped from ${baseline_rate} to ${current_rate}"
    fi
}
```

## Best Practices

### When to Create Versions

- Before applying evolution suggestions
- Before major skill modifications
- After validating improvements work well
- At regular intervals (weekly/monthly) for active skills

### Version Naming

Use semantic versioning:
- **Major** (2.0.0): Breaking changes to skill behavior
- **Minor** (1.1.0): New features/patterns added
- **Patch** (1.0.1): Bug fixes, minor improvements

### Cleanup Policy

- Keep last 5 versions minimum
- Archive versions older than 90 days
- Never delete versions with good metrics (baseline references)

## Metrics Interpretation

### Success Rate Trends

| Pattern | Interpretation |
|---------|---------------|
| Increasing | Evolution working well |
| Stable | Skill mature and effective |
| Decreasing | Investigate recent changes |

### Average Edits Trends

| Pattern | Interpretation |
|---------|---------------|
| Decreasing | Skill producing better output |
| Stable | Consistent quality |
| Increasing | Users modifying more (skill may need updates) |

## Recovery Scenarios

### Accidental Breaking Change

```bash
# 1. Check history
version-manager.sh list <skill-id>

# 2. Find last good version
version-manager.sh metrics <skill-id>

# 3. Restore
version-manager.sh restore <skill-id> 1.1.0
```

### Gradual Degradation

```bash
# 1. Compare versions
version-manager.sh diff <skill-id> 1.0.0 1.2.0

# 2. Identify problematic changes
# 3. Create new version fixing issues
```