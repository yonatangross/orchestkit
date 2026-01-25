# LangGraph Supervisor Checklist

## Design

- [ ] Define supervisor responsibilities
- [ ] List available agents/workers
- [ ] Plan delegation strategy
- [ ] Set termination conditions

## Supervisor Implementation

- [ ] Clear system prompt for supervisor
- [ ] Define worker capabilities
- [ ] Implement routing logic
- [ ] Handle completion signal

## Worker Agents

- [ ] Focused, single-purpose agents
- [ ] Clear input/output schemas
- [ ] Independent operation
- [ ] Error handling

## Communication

- [ ] Structured message passing
- [ ] Context sharing
- [ ] Result aggregation
- [ ] Status reporting

## Termination

- [ ] Maximum iterations limit
- [ ] Success conditions
- [ ] Failure handling
- [ ] Timeout handling

## Testing

- [ ] Test supervisor decisions
- [ ] Test worker execution
- [ ] Test multi-step workflows
- [ ] Test error recovery
