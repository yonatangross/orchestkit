# Human-in-the-Loop Checklist

## Design

- [ ] Identify approval points
- [ ] Define what requires human input
- [ ] Plan timeout handling
- [ ] Design approval UI/interface

## Implementation

- [ ] Use interrupt_before or interrupt_after
- [ ] Save state before interrupt
- [ ] Resume from checkpoint
- [ ] Handle approval/rejection

## Interruption Points

```python
graph.add_node("sensitive_action", action_node)
graph.add_edge("analysis", "sensitive_action")  # Interrupt here

# In config
config = {"interrupt_before": ["sensitive_action"]}
```

## User Experience

- [ ] Clear prompt for human
- [ ] Show relevant context
- [ ] Provide approve/reject options
- [ ] Allow modification if needed

## Timeout Handling

- [ ] Set reasonable timeout
- [ ] Notify on timeout approach
- [ ] Define default action
- [ ] Log abandoned workflows

## Testing

- [ ] Test approval flow
- [ ] Test rejection flow
- [ ] Test timeout behavior
- [ ] Test resume from checkpoint
