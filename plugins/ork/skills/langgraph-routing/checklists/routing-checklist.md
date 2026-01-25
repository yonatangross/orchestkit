# LangGraph Routing Checklist

## Design

- [ ] Define routing conditions clearly
- [ ] Cover all possible routes
- [ ] Plan default/fallback route
- [ ] Document routing logic

## Implementation

- [ ] Use conditional edges
- [ ] Return route name from router function
- [ ] Handle edge cases
- [ ] Validate route targets exist

## Router Function

```python
def router(state: State) -> str:
    if condition_a:
        return "node_a"
    elif condition_b:
        return "node_b"
    else:
        return "default_node"
```

## Testing

- [ ] Test each route independently
- [ ] Test boundary conditions
- [ ] Test default/fallback
- [ ] Test with invalid states
