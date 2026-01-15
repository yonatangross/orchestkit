# Statusline Fields Reference

## Context Window Fields (CC 2.1.6)

### context_window.used_percentage

Returns the percentage of context window currently in use.

```json
{
  "field": "context_window.used_percentage",
  "type": "number",
  "range": "0-100",
  "update_frequency": "per_turn"
}
```

**Usage in template:**
```
{{context_window.used_percentage}}%
```

### context_window.remaining_percentage

Returns the percentage of context window still available.

```json
{
  "field": "context_window.remaining_percentage",
  "type": "number",
  "range": "0-100",
  "update_frequency": "per_turn"
}
```

**Usage in template:**
```
{{context_window.remaining_percentage}}% remaining
```

## Session Fields

### session.cost

Current session API cost.

```json
{
  "field": "session.cost",
  "type": "currency",
  "format": "$X.XX"
}
```

### session.duration

Time since session started.

```json
{
  "field": "session.duration",
  "type": "duration",
  "format": "Xm or Xh Ym"
}
```

## Threshold Configuration

```json
{
  "elements": {
    "context_bar": {
      "field": "context_window.used_percentage",
      "format": "bar",
      "thresholds": {
        "normal": 60,    // Green: < 60%
        "warning": 80,   // Yellow: 60-80%
        "critical": 95   // Red: > 95%
      }
    }
  }
}
```

## Complete Example

```json
{
  "statusline": {
    "enabled": true,
    "template": "[CTX: {{context_window.used_percentage}}%] {{session.cost}} ({{session.duration}})",
    "elements": {
      "context_bar": {
        "field": "context_window.used_percentage",
        "format": "bar",
        "width": 20,
        "thresholds": {
          "normal": 60,
          "warning": 80,
          "critical": 95
        },
        "colors": {
          "normal": "green",
          "warning": "yellow",
          "critical": "red"
        }
      }
    }
  }
}
```