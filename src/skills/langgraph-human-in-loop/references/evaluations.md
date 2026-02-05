# Evaluation Test Cases

## Test 1: Approval Gate

```json
{
  "skills": ["langgraph-human-in-loop"],
  "query": "Add human approval before executing a dangerous operation",
  "expected_behavior": [
    "Uses interrupt() function from langgraph.types",
    "Passes approval request data to interrupt()",
    "Resumes with Command(resume=response)",
    "Handles approval and rejection cases"
  ]
}
```

## Test 2: Edit Before Continue

```json
{
  "skills": ["langgraph-human-in-loop"],
  "query": "Let human edit AI-generated content before proceeding",
  "expected_behavior": [
    "Shows generated content in interrupt payload",
    "Human can modify or approve",
    "Resume uses human-edited version",
    "Original preserved if human approves as-is"
  ]
}
```

## Test 3: Validation Loop

```json
{
  "skills": ["langgraph-human-in-loop"],
  "query": "Implement review loop until human approves quality",
  "expected_behavior": [
    "Tracks review_count in state",
    "interrupt() on each review cycle",
    "Routes back to generation if rejected",
    "Proceeds to next step when approved"
  ]
}
```
