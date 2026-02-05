# Evaluation Test Cases

## Test 1: PostgreSQL Checkpointing

```json
{
  "skills": ["langgraph-checkpoints"],
  "query": "Add PostgreSQL checkpointing to persist workflow state",
  "expected_behavior": [
    "Uses PostgresSaver.from_conn_string()",
    "Passes checkpointer to compile()",
    "Sets thread_id in config for resumption",
    "Uses async connection for async workflows"
  ]
}
```

## Test 2: Resume from Checkpoint

```json
{
  "skills": ["langgraph-checkpoints"],
  "query": "Resume a workflow that was interrupted",
  "expected_behavior": [
    "Uses same thread_id as original run",
    "Calls invoke/ainvoke with None as input",
    "Workflow continues from last checkpoint",
    "Handles case where no checkpoint exists"
  ]
}
```

## Test 3: Checkpoint Debugging

```json
{
  "skills": ["langgraph-checkpoints"],
  "query": "List all checkpoints for debugging a failed workflow",
  "expected_behavior": [
    "Uses get_state_history() method",
    "Iterates through StateSnapshot objects",
    "Accesses values, next, and config from snapshots",
    "Can identify which node failed"
  ]
}
```
