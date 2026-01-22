# Permission Profiles

Pre-configured permission profiles for different development environments.

## Available Profiles

| Profile | Use Case | Security Level |
|---------|----------|----------------|
| `secure.json` | Solo development with maximum safety | High |
| `team.json` | Collaborative team development | Medium |
| `enterprise.json` | Enterprise with audit requirements | Very High |

## Applying a Profile

Use the `/ork:apply-permissions` command:

```bash
/ork:apply-permissions team
```

Or manually merge into `.claude/settings.json`:

```bash
# View profile
cat .claude/permissions/profiles/team.json | jq

# Apply (requires manual merge)
# Profile settings should be merged into .claude/settings.json permissions section
```

## Profile Structure

```json
{
  "name": "profile-name",
  "version": "1.0.0",
  "description": "Profile description",
  "auto_approve": {
    "tools": ["Read", "Glob"],
    "paths": ["src/**"],
    "bash_commands": ["git status"]
  },
  "require_approval": {
    "tools": ["Write"],
    "paths": ["config/**"]
  },
  "deny": {
    "paths": ["**/.env*"],
    "bash_patterns": ["rm -rf"]
  }
}
```

## Customization

Copy a profile and modify:

```bash
cp .claude/permissions/profiles/team.json .claude/permissions/profiles/custom.json
# Edit custom.json
/ork:apply-permissions custom
```

## Security Notes

- All profiles deny access to common secret files (`.env`, `*.pem`, `*.key`)
- Enterprise profile enables full audit logging
- Profiles are additive - they merge with existing settings
- Test profiles in a safe environment before production use