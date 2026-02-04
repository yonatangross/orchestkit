# Preset Definitions

## Complete (Default)

Everything enabled - full AI-assisted development.

```json
{
  "preset": "complete",
  "skills": {
    "ai_ml": true,
    "backend": true,
    "frontend": true,
    "testing": true,
    "security": true,
    "devops": true,
    "planning": true
  },
  "agents": {
    "product": true,
    "technical": true
  },
  "hooks": {
    "safety": true,
    "productivity": true,
    "quality_gates": true,
    "team_coordination": true,
    "notifications": false
  },
  "commands": { "enabled": true },
  "mcps": {
    "context7": false,
    "sequential_thinking": false,
    "memory": false,
    "playwright": false
  }
}
```

## Standard

All skills, no agents (spawn manually).

```json
{
  "preset": "standard",
  "skills": { "ai_ml": true, "backend": true, "frontend": true, "testing": true, "security": true, "devops": true, "planning": true },
  "agents": { "product": false, "technical": false },
  "hooks": { "safety": true, "productivity": true, "quality_gates": true, "team_coordination": true, "notifications": false },
  "commands": { "enabled": true },
  "mcps": { "context7": false, "sequential_thinking": false, "memory": false, "playwright": false }
}
```

## Lite

Essential skills only, minimal overhead.

```json
{
  "preset": "lite",
  "skills": {
    "ai_ml": false,
    "backend": false,
    "frontend": false,
    "testing": true,
    "security": true,
    "devops": false,
    "planning": true
  },
  "agents": { "product": false, "technical": false },
  "hooks": {
    "safety": true,
    "productivity": true,
    "quality_gates": false,
    "team_coordination": false,
    "notifications": false
  },
  "commands": {
    "enabled": true,
    "disabled": ["add-golden", "implement", "fix-issue", "review-pr", "run-tests", "create-pr"]
  },
  "mcps": { "context7": false, "sequential_thinking": false, "memory": false, "playwright": false }
}
```

## Hooks-only

Just safety guardrails, no skills or agents.

```json
{
  "preset": "hooks-only",
  "skills": {
    "ai_ml": false,
    "backend": false,
    "frontend": false,
    "testing": false,
    "security": false,
    "devops": false,
    "planning": false
  },
  "agents": { "product": false, "technical": false },
  "hooks": {
    "safety": true,
    "productivity": true,
    "quality_gates": false,
    "team_coordination": true,
    "notifications": false
  },
  "commands": { "enabled": false },
  "mcps": { "context7": false, "sequential_thinking": false, "memory": false, "playwright": false }
}
```