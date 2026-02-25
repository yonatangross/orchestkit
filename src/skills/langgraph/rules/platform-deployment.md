---
title: Configure LangGraph Platform for local dev, Docker builds, and cloud deployment
impact: HIGH
impactDescription: "Missing langgraph.json config or wrong CLI command prevents deployment — graph never reaches production"
tags: platform, deployment, langgraph-cli, assistants, authentication, webhooks, entrypoint
---

## Platform Deployment

LangGraph Platform provides infrastructure for deploying graphs as APIs with persistence, streaming, and multi-tenancy built in.

**Incorrect — no configuration file:**
```python
# Running graph directly without Platform config
python my_graph.py  # No API server, no persistence, no multi-tenancy
```

**Correct — langgraph.json + CLI:**
```json
{
  "dependencies": ["langchain_openai", "./my_package"],
  "graphs": {
    "my_agent": "./my_package/agent.py:graph",
    "my_workflow": "./my_package/workflow.py:app"
  },
  "env": "./.env"
}
```

```bash
# Local development (hot reload, in-memory)
langgraph dev

# Build Docker image for self-hosted deployment
langgraph build -t my-agent:latest

# Deploy to LangGraph Cloud
langgraph deploy
```

**Assistants API — multiple configs from one graph:**
```python
from langgraph_sdk import get_client

client = get_client(url="http://localhost:2024")

# Create assistants with different configs from the same graph
creative = await client.assistants.create(
    graph_id="my_agent",
    config={"configurable": {"temperature": 0.9, "model": "claude-sonnet-4-5-20250929"}},
    name="creative-writer",
)

precise = await client.assistants.create(
    graph_id="my_agent",
    config={"configurable": {"temperature": 0.1, "model": "claude-sonnet-4-5-20250929"}},
    name="precise-analyst",
)
```

**Background runs and webhooks:**
```python
# Fire-and-forget with webhook callback
run = await client.runs.create(
    thread_id=thread["thread_id"],
    assistant_id=creative["assistant_id"],
    input={"messages": [{"role": "user", "content": "Write a story"}]},
    webhook="https://myapp.com/api/langgraph-callback",
    background=True,
)
```

**@entrypoint for Platform deployments:**
```python
from langgraph.func import entrypoint, task
from langgraph.checkpoint.memory import MemorySaver

@entrypoint(path="my_workflow", checkpointer=MemorySaver())
def my_workflow(inputs: dict) -> dict:
    result = analyze_task(inputs["query"]).result()
    return {"answer": result}
```

**Authentication middleware:**
```python
from langgraph_sdk import Auth

auth = Auth()

@auth.authenticate
async def authenticate(authorization: str) -> str:
    # Validate token, return user_id
    user = await verify_token(authorization)
    return user["id"]

@auth.on
async def authorize(params, user_id: str):
    # Filter resources by user ownership
    params["metadata"] = {"owner": user_id}
```

**Key rules:**
- `langgraph.json` is required — defines graphs, dependencies, and env vars
- Use `langgraph dev` for local development (hot reload, in-memory state)
- Use `langgraph build` for Docker images, `langgraph deploy` for cloud
- Assistants API creates multiple configurations from a single deployed graph
- `@entrypoint(path=...)` registers functional API workflows with Platform
- Background runs return immediately; use webhooks for completion callbacks
- Add authentication middleware for multi-tenant deployments

Reference: [LangGraph Platform](https://langchain-ai.github.io/langgraph/concepts/langgraph_platform/)
