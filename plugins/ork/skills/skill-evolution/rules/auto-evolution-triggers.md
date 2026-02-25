# Auto-Evolution Safety & Trigger Criteria

## Safety Mechanisms

1. **Version Snapshots**: Always created before changes
2. **Rollback Triggers**: Auto-alert if success rate drops >20%
3. **Human Review**: High-confidence suggestions require approval
4. **Rejection Memory**: Rejected suggestions are never re-suggested

## Health Monitoring

The system monitors skill health and can trigger warnings:

```
WARNING: api-design-framework success rate dropped from 94% to 71%
Consider: /ork:skill-evolution rollback api-design-framework 1.1.0
```

## When Auto-Evolution Activates

- Pattern frequency exceeds the Add Threshold (70%)
- At least Minimum Samples (5) uses recorded
- No prior rejection for the same pattern on the same skill
- Current skill version success rate is stable (no recent drops)

## When Rollback Is Triggered

- Success rate drops more than 20% after an evolution
- Alert is surfaced in the next `report` or `analyze` invocation
- User is prompted to rollback via AskUserQuestion
