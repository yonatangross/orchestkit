# Permission Rules Analysis

## Overview

CC 2.1.3 added detection for unreachable permission rules. This reference explains how to diagnose and fix permission issues.

## Common Issues

### 1. Unreachable Rules

A rule is unreachable when a more general rule already matches:

```json
// PROBLEM: Second rule never matches
{
  "permissions": [
    { "path": "**/*.md", "action": "allow" },
    { "path": "README.md", "action": "deny" }  // Unreachable!
  ]
}
```

**Fix:** Order rules from specific to general:

```json
{
  "permissions": [
    { "path": "README.md", "action": "deny" },
    { "path": "**/*.md", "action": "allow" }
  ]
}
```

### 2. Shadowed Rules

When two rules match the same pattern with different actions:

```json
// PROBLEM: Both match, but first wins
{
  "permissions": [
    { "matcher": "Bash", "action": "allow" },
    { "matcher": "Bash", "commands": ["rm"], "action": "deny" }
  ]
}
```

**Fix:** Use more specific matchers:

```json
{
  "permissions": [
    { "matcher": "Bash", "commands": ["rm", "rm -rf"], "action": "deny" },
    { "matcher": "Bash", "action": "allow" }
  ]
}
```

### 3. Invalid Patterns

Glob patterns that will never match:

```json
// PROBLEM: Typo in pattern
{
  "permissions": [
    { "path": "**.md", "action": "allow" }  // Should be **/*.md
  ]
}
```

## Validation Commands

```bash
# Check for unreachable rules
jq '.permissions // [] | to_entries | map(select(.value.action == "allow"))' \
  .claude/settings.json

# List all permission matchers
jq '.permissions // [] | map(.matcher) | unique' .claude/settings.json
```

## Best Practices

1. Order rules from most specific to least specific
2. Use explicit deny rules before catch-all allow rules
3. Test rules with actual tool invocations
4. Review rules after plugin updates