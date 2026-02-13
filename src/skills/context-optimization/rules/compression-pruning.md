---
title: "Compression: Triggers & Thresholds"
category: compression
impact: HIGH
impactDescription: Proper compression triggers prevent context degradation and unnecessary re-fetching
tags: [compression, triggers, thresholds, context-window, effective-context]
---

# Compression Triggers & Thresholds

## Thresholds

| Threshold | Action |
|-----------|--------|
| 70% capacity | Trigger compression |
| 50% capacity | Target after compression |
| 10 messages minimum | Required before compressing |
| Last 5 messages | Always preserve uncompressed |

## CC 2.1.7: Effective Context Window

Calculate against **effective** context (after system overhead):

| Trigger | Static (CC 2.1.6) | Effective (CC 2.1.7) |
|---------|-------------------|----------------------|
| Warning | 60% of static | 60% of effective |
| Compress | 70% of static | 70% of effective |
| Critical | 90% of static | 90% of effective |

## Configuration

```python
COMPRESSION_CONFIG = {
    "trigger_threshold": 0.70,
    "target_threshold": 0.50,
    "preserve_recent": 5,
    "preserve_system": True,
}
```

## Key Principles

- Use fixed thresholds (not opportunistic compression)
- Preserve system prompts at START
- Keep recent messages uncompressed for context continuity
- Never compress below the point of task completion
