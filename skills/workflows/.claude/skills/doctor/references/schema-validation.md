# Schema Validation

## Overview

SkillForge uses JSON schemas to validate configuration files. This reference explains how to validate and fix schema issues.

## Schemas

Located in `.claude/schemas/`:

| Schema | Validates |
|--------|-----------|
| `plugin.schema.json` | `plugin.json` |
| `skill-capabilities.schema.json` | All `capabilities.json` files |
| `context.schema.json` | Context protocol files |
| `coordination.schema.json` | Work registry and decision log |

## Validation Commands

### Validate All

```bash
./tests/schemas/validate-all.sh
```

### Validate Specific File

```bash
# Using ajv
npx ajv validate \
  -s .claude/schemas/skill-capabilities.schema.json \
  -d skills/workflows/.claude/skills/doctor/capabilities.json

# Using jq for basic structure check
jq empty skills/workflows/.claude/skills/doctor/capabilities.json
```

## Common Schema Errors

### Missing Required Field

```json
// ERROR: Missing "description"
{
  "name": "my-skill",
  "version": "1.0.0"
}
```

**Fix:** Add all required fields:

```json
{
  "$schema": "../../schemas/skill-capabilities.schema.json",
  "name": "my-skill",
  "version": "1.0.0",
  "description": "Description of the skill",
  "capabilities": ["capability-1"]
}
```

### Invalid Type

```json
// ERROR: capabilities must be array
{
  "capabilities": "single-capability"
}
```

**Fix:** Use correct type:

```json
{
  "capabilities": ["single-capability"]
}
```

### Pattern Mismatch

```json
// ERROR: version must match semver
{
  "version": "1.0"
}
```

**Fix:** Use proper semver:

```json
{
  "version": "1.0.0"
}
```

## Batch Validation

```bash
# Validate all capabilities.json files
for category in skills/*/.claude/skills; do for f in "$category"/*/capabilities.json; do
  npx ajv validate \
    -s .claude/schemas/skill-capabilities.schema.json \
    -d "$f" || echo "INVALID: $f"
done
```

## Creating Valid Files

Use schema as a template:

```bash
# View required fields
jq '.required' .claude/schemas/skill-capabilities.schema.json

# View property types
jq '.properties | to_entries | map({key: .key, type: .value.type})' \
  .claude/schemas/skill-capabilities.schema.json
```