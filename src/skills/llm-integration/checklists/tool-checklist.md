# Function Calling Checklist

## Tool Definition

- [ ] Clear, concise description (1-2 sentences)
- [ ] All parameters documented
- [ ] Use strict mode (`strict: true`) for reliability
- [ ] All properties in `required` (when strict)
- [ ] Set `additionalProperties: false` (when strict)

## Schema Design

- [ ] Use specific types (not just `string`)
- [ ] Add enum constraints where applicable
- [ ] Provide examples in descriptions
- [ ] Limit to 5-15 tools per request
- [ ] On Claude, keep the `tools` array stable across turns; add tools via inline `tool_addition` or `defer_loading` rather than swapping the array
- [ ] No forced `tool_choice` (`any` or named) on Opus 5.5 or Fable 5.1; use `auto` plus `strict: true`

## Tool Execution

- [ ] Validate input parameters (Pydantic/Zod)
- [ ] Handle errors gracefully
- [ ] Return errors as tool results (don't crash)
- [ ] Log tool calls for debugging

## Execution Loop

- [ ] Check for tool calls in response
- [ ] Execute all requested tools
- [ ] Add results to conversation
- [ ] Continue until final answer

## Parallel Tool Calls

- [ ] Disable parallel calls with strict mode
- [ ] Use asyncio.gather for parallel execution
- [ ] Handle partial failures

## Structured Output

- [ ] Use Pydantic for type safety
- [ ] Validate output schema
- [ ] Handle parse errors
- [ ] Provide fallback behavior

## Testing

- [ ] Test each tool independently
- [ ] Test tool selection (right tool for task)
- [ ] Test error handling
- [ ] Test with invalid inputs
