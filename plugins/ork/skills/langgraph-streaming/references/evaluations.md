# Evaluation Test Cases

## Test 1: Custom Progress Events

```json
{
  "skills": ["langgraph-streaming"],
  "query": "Stream progress updates showing percentage complete",
  "expected_behavior": [
    "Uses get_stream_writer() in node",
    "Writes custom event with progress data",
    "Client receives via stream_mode='custom'",
    "Events have type and payload"
  ]
}
```

## Test 2: LLM Token Streaming

```json
{
  "skills": ["langgraph-streaming"],
  "query": "Stream LLM tokens to the client in real-time",
  "expected_behavior": [
    "Uses stream_mode='messages'",
    "LLM node uses streaming API",
    "Tokens appear as they're generated",
    "Final message assembled from chunks"
  ]
}
```

## Test 3: Multi-Mode Streaming

```json
{
  "skills": ["langgraph-streaming"],
  "query": "Get both state updates and custom events in single stream",
  "expected_behavior": [
    "Passes list to stream_mode=['updates', 'custom']",
    "Filters events by mode in client",
    "Updates show state changes",
    "Custom shows progress events"
  ]
}
```
