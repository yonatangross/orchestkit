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
- [ ] On Claude, keep `tools` fixed as first sent; a changed top-level array breaks the cached prefix (and, on Opus 5.5 and Fable 5.1, invalidates later thinking blocks)
- [ ] Add tools mid-conversation with the inline `tool_addition` pattern (beta header `inline-tools-2026-09-15`; not on Sonnet 5) instead of rewriting the array
- [ ] For large tool sets, use a non-deferred tool search tool with `defer_loading: true`, or add tools with `tool_addition`, rather than a per-request subset
- [ ] No forced `tool_choice` (`any` or named) on Opus 5.5, Fable 5.1, or Mythos 5.1 (400); use `auto` plus `strict: true`, or structured outputs

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
