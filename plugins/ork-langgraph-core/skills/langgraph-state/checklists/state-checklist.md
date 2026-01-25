# LangGraph State Checklist

## State Definition

- [ ] Use TypedDict for state schema
- [ ] Define all required fields
- [ ] Use appropriate types (str, list, dict)
- [ ] Add Annotated reducers for list fields

## State Channels

- [ ] Use `add_messages` for message lists
- [ ] Use `operator.add` for list concatenation
- [ ] Use `last` for override behavior
- [ ] Document reducer behavior

## Implementation

- [ ] Initialize state properly
- [ ] Return only changed fields from nodes
- [ ] Handle missing keys gracefully
- [ ] Validate state transitions

## Subgraphs

- [ ] Define clear input/output schema
- [ ] Map parent state to subgraph state
- [ ] Handle errors in subgraph
- [ ] Test subgraph independently

## Testing

- [ ] Test state initialization
- [ ] Test each reducer
- [ ] Test state validation
- [ ] Test error handling
