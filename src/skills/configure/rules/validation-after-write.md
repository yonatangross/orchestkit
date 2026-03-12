---
title: Validate configuration after writing to catch malformed JSON and invalid settings
impact: HIGH
impactDescription: "Blind config writes that produce invalid JSON or missing required fields silently break plugin loading"
tags: [configuration, validation, json, integrity]
---

# Validate Config After Writing

## Why

Configuration files are consumed by Claude Code's plugin loader. A malformed JSON file, a missing required field, or an invalid enum value will silently fail to load — the user sees no error, just missing functionality.

## Rule

After every config write:
1. Parse the written file as JSON to verify syntax
2. Validate required fields exist
3. Validate field values against allowed enums
4. Report success or failure to the user

## Incorrect — write config and assume success

```bash
# Write config, no verification
cat > config.json << 'EOF'
{
  "version": "1.0.0",
  "preset": "complete",
  "skills": { "ai_ml": true }
}
EOF
echo "Configuration saved successfully!"
```

```typescript
writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("Done!"); // No verification that file is valid
```

**Problems:**
- Truncated writes (disk full) produce invalid JSON
- Missing trailing brace from template errors breaks parsing
- Typo in preset name ("compelte") silently falls back to defaults

## Correct — write then validate

```bash
CONFIG="$HOME/.claude/plugins/orchestkit/config.json"

cat > "$CONFIG" << 'EOF'
{
  "version": "1.0.0",
  "preset": "complete",
  "skills": { "ai_ml": true }
}
EOF

# Validate JSON syntax
if ! python3 -c "import json; json.load(open('$CONFIG'))"; then
  echo "ERROR: Written config is not valid JSON"
  exit 1
fi

# Validate required fields
python3 -c "
import json, sys
config = json.load(open('$CONFIG'))
required = ['version', 'preset']
missing = [f for f in required if f not in config]
if missing:
    print(f'ERROR: Missing required fields: {missing}')
    sys.exit(1)
valid_presets = ['complete', 'standard', 'lite', 'hooks-only', 'monorepo']
if config.get('preset') not in valid_presets:
    print(f'ERROR: Invalid preset \"{config[\"preset\"]}\". Must be one of: {valid_presets}')
    sys.exit(1)
print('Config validated successfully')
"
```

```typescript
import { readFileSync, writeFileSync } from "fs";

function writeAndValidateConfig(path: string, config: PluginConfig): void {
  const content = JSON.stringify(config, null, 2);
  writeFileSync(path, content);

  // Read back and validate
  const written = readFileSync(path, "utf-8");
  const parsed = JSON.parse(written); // Throws on malformed JSON

  const VALID_PRESETS = ["complete", "standard", "lite", "hooks-only", "monorepo"];
  if (!parsed.version) throw new Error("Missing required field: version");
  if (!VALID_PRESETS.includes(parsed.preset)) {
    throw new Error(`Invalid preset "${parsed.preset}"`);
  }
}
```

## Validation Checklist

| Check | Action on Failure |
|-------|-------------------|
| Valid JSON syntax | Restore from backup |
| Required fields present | Report missing fields |
| Preset value valid | Suggest closest match |
| Version format valid | Default to current |
