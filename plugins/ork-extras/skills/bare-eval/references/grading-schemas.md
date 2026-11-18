# Grading Schemas

JSON schemas for structured eval output with `--json-schema`.

## Batch Assertion Grading

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Assertion name" },
      "verdict": { "enum": ["PASS", "FAIL"], "description": "Whether the output satisfies the assertion" },
      "reason": { "type": "string", "description": "One-line explanation" }
    },
    "required": ["name", "verdict", "reason"]
  }
}
```

## Trigger Classification

```json
{
  "type": "object",
  "properties": {
    "skill_name": { "type": "string", "description": "The skill that would be triggered" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1, "description": "Confidence score 0-1" },
    "reasoning": { "type": "string", "description": "Why this skill matches" }
  },
  "required": ["skill_name", "confidence"]
}
```

## Quality Score

```json
{
  "type": "object",
  "properties": {
    "score": { "type": "integer", "minimum": 0, "maximum": 10 },
    "dimensions": {
      "type": "object",
      "properties": {
        "accuracy": { "type": "integer", "minimum": 0, "maximum": 10 },
        "completeness": { "type": "integer", "minimum": 0, "maximum": 10 },
        "actionability": { "type": "integer", "minimum": 0, "maximum": 10 },
        "format": { "type": "integer", "minimum": 0, "maximum": 10 }
      }
    },
    "verdict": { "enum": ["PASS", "FAIL", "PARTIAL"] },
    "reason": { "type": "string" }
  },
  "required": ["score", "verdict"]
}
```

## Description Quality

For `optimize-description.sh` iterations:

```json
{
  "type": "object",
  "properties": {
    "improved_description": { "type": "string", "maxLength": 1024 },
    "changes_made": {
      "type": "array",
      "items": { "type": "string" }
    },
    "trigger_keywords_added": {
      "type": "array",
      "items": { "type": "string" }
    }
  },
  "required": ["improved_description"]
}
```

## Usage

```bash
# Save schema to file
cat > /tmp/grading-schema.json << 'EOF'
{ ... schema above ... }
EOF

# Use with --json-schema
claude -p "$prompt" --bare --json-schema /tmp/grading-schema.json --output-format json
```
