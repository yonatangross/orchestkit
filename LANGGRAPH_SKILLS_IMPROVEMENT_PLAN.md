# LangGraph Skills & Agents Improvement Plan

**Generated:** February 5, 2026
**LangGraph Version Target:** 1.0.7+
**Assessment Score:** 7.4/10 → Target: 9.0/10

---

## Executive Summary

This plan addresses all gaps identified in the assessment and aligns OrchestKit's LangGraph skills with the latest 2026 best practices from official LangGraph 1.0 documentation.

**Key Changes:**
1. Add 3 missing skills (streaming, subgraphs, tools)
2. Update all 7 existing skills with LangGraph 1.0 patterns
3. Modernize workflow-architect agent
4. Add runnable tests for code examples
5. Resolve vaporware production example

---

## Part 1: New Skills to Create

### 1.1 `langgraph-streaming` (NEW)

**Priority:** HIGH
**Effort:** 2 days
**Impact:** Fills critical gap for real-time applications

**Content Structure:**
```
src/skills/langgraph-streaming/
├── SKILL.md
└── references/
    ├── stream-modes.md
    ├── custom-events.md
    ├── llm-token-streaming.md
    └── subgraph-streaming.md
```

**Core Content (SKILL.md):**

```yaml
---
name: langgraph-streaming
description: LangGraph streaming patterns for real-time updates. Use when implementing progress indicators, token streaming, custom events, or real-time user feedback.
tags: [langgraph, streaming, real-time, events]
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---
```

**Key Patterns to Include:**

| Pattern | Code |
|---------|------|
| **5 Stream Modes** | `stream_mode=["values", "updates", "messages", "custom", "debug"]` |
| **Custom Events** | `get_stream_writer()` for progress updates |
| **LLM Token Streaming** | `stream_mode="messages"` with metadata filtering |
| **Subgraph Streaming** | `subgraphs=True` parameter |
| **Non-LangChain LLMs** | Custom mode for arbitrary APIs |

**Code Examples:**

```python
# 5 Stream Modes
from langgraph.config import get_stream_writer

def node_with_progress(state):
    writer = get_stream_writer()
    for i in range(10):
        writer({"progress": i * 10, "status": "processing"})
    return {"result": "done"}

# Multiple modes simultaneously
for mode, chunk in graph.stream(inputs, stream_mode=["updates", "custom"]):
    if mode == "custom":
        print(f"Progress: {chunk.get('progress')}%")
    elif mode == "updates":
        print(f"State updated: {chunk}")

# LLM token streaming with metadata filtering
for message_chunk, metadata in graph.stream(
    {"topic": "AI safety"},
    stream_mode="messages"
):
    if metadata["langgraph_node"] == "writer_agent":
        print(message_chunk.content, end="", flush=True)

# Subgraph streaming
for namespace, chunk in graph.stream(
    inputs,
    subgraphs=True,
    stream_mode="updates"
):
    print(f"[{namespace}] {chunk}")
```

---

### 1.2 `langgraph-subgraphs` (NEW)

**Priority:** HIGH
**Effort:** 2 days
**Impact:** Critical for modular, team-based development

**Content Structure:**
```
src/skills/langgraph-subgraphs/
├── SKILL.md
└── references/
    ├── invoke-pattern.md
    ├── add-as-node-pattern.md
    ├── state-mapping.md
    └── checkpointing-subgraphs.md
```

**Key Patterns:**

| Pattern | When to Use |
|---------|-------------|
| **Invoke from Node** | Different schemas, isolated state |
| **Add as Node** | Shared state keys, message passing |
| **Multi-level Nesting** | Parent → Child → Grandchild |
| **Independent Checkpointing** | `compile(checkpointer=True)` for isolated histories |

**Code Examples:**

```python
# Pattern 1: Invoke (Different Schemas)
def call_subgraph(state: ParentState):
    """Transform state at boundaries."""
    subgraph_output = subgraph.invoke({"bar": state["foo"]})
    return {"foo": subgraph_output["bar"]}

builder.add_node("subgraph_node", call_subgraph)

# Pattern 2: Add as Node (Shared State)
subgraph = subgraph_builder.compile()
builder.add_node("agent_team", subgraph)  # Direct embedding

# Checkpointing: Parent-only (propagates automatically)
parent = parent_builder.compile(checkpointer=PostgresSaver(...))

# Checkpointing: Independent subgraph memory
agent_subgraph = agent_builder.compile(checkpointer=True)

# Inspect subgraph state (only works when interrupted)
state = graph.get_state(config, subgraphs=True)
```

---

### 1.3 `langgraph-tools` (NEW)

**Priority:** MEDIUM
**Effort:** 1.5 days
**Impact:** Common pattern not currently documented

**Content Structure:**
```
src/skills/langgraph-tools/
├── SKILL.md
└── references/
    ├── bind-tools.md
    ├── toolnode.md
    ├── dynamic-tools.md
    └── tool-interrupts.md
```

**Key Patterns:**

```python
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode

# Define tools
@tool
def search_database(query: str) -> str:
    """Search the database."""
    return db.search(query)

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email (requires approval)."""
    # Interrupt for approval
    response = interrupt({
        "action": "send_email",
        "to": to,
        "message": "Approve sending this email?"
    })
    if response.get("approved"):
        return f"Email sent to {to}"
    return "Email cancelled"

# Bind tools to model
tools = [search_database, send_email]
model_with_tools = model.bind_tools(tools)

# Agent node with tools
def agent_node(state: State):
    response = model_with_tools.invoke(state["messages"])
    return {"messages": [response]}

# Tool execution node
tool_node = ToolNode(tools)

# Dynamic tool binding (many tools)
def agent_with_dynamic_tools(state: State):
    relevant_tools = select_tools(state["query"], all_tools)
    model_bound = model.bind_tools(relevant_tools)
    return {"messages": [model_bound.invoke(state["messages"])]}

# Force tool calling
model.bind_tools(tools, tool_choice="any")  # Must call at least one
model.bind_tools(tools, tool_choice="search_database")  # Specific tool
```

---

## Part 2: Updates to Existing Skills

### 2.1 `langgraph-supervisor` Updates

**Changes Required:**

| Section | Current | Update To |
|---------|---------|-----------|
| Entry point | `workflow.set_entry_point()` | `workflow.add_edge(START, "supervisor")` |
| Routing | Conditional edges only | Add Command API pattern |
| Imports | `from langgraph.graph import StateGraph, END` | Add `START`, `Command` |
| LLM Supervisor | Good | Add confidence fallback |

**New Code to Add:**

```python
# Command API for routing + state update (2026 best practice)
from langgraph.types import Command
from typing import Literal

def supervisor_with_command(state: WorkflowState) -> Command[Literal["analyzer", "validator", "END"]]:
    """Use Command for combined state update + routing."""
    if state["needs_analysis"]:
        return Command(
            update={"current_agent": "analyzer"},
            goto="analyzer"
        )
    elif state["needs_validation"]:
        return Command(
            update={"current_agent": "validator"},
            goto="validator"
        )
    return Command(goto="END")

# Updated graph construction
from langgraph.graph import START, END

workflow.add_edge(START, "supervisor")  # Not set_entry_point()
```

**Add to Key Decisions:**

| Decision | Recommendation |
|----------|----------------|
| Command vs Conditional | Use Command when updating state + routing together |
| Entry point | Use `add_edge(START, node)` (set_entry_point deprecated) |

---

### 2.2 `langgraph-state` Updates

**Changes Required:**

| Section | Update |
|---------|--------|
| context_schema | NEW: Runtime configuration pattern |
| Node caching | NEW: CachePolicy pattern |
| RemainingSteps | NEW: Proactive recursion handling |

**New Code to Add:**

```python
# context_schema for runtime configuration (NEW in 1.0)
from dataclasses import dataclass

@dataclass
class ContextSchema:
    llm_provider: str = "anthropic"
    temperature: float = 0.7
    max_retries: int = 3

graph = StateGraph(State, context_schema=ContextSchema)

# Use in nodes
def my_node(state: State, context: ContextSchema):
    if context.llm_provider == "anthropic":
        return call_claude(state, context.temperature)
    return call_openai(state, context.temperature)

# Invoke with context
graph.invoke(inputs, context={"llm_provider": "openai", "temperature": 0.5})

# Node caching (NEW in 1.0)
from langgraph.cache.memory import InMemoryCache
from langgraph.types import CachePolicy

builder.add_node(
    "expensive_embedding",
    embed_content,
    cache_policy=CachePolicy(ttl=300)  # 5 minute cache
)
graph = builder.compile(cache=InMemoryCache())

# RemainingSteps for proactive recursion handling
from langgraph.types import RemainingSteps

def agent_node(state: State, remaining: RemainingSteps):
    if remaining.steps < 5:
        # Wrap up instead of continuing
        return {"action": "summarize_and_exit"}
    return {"action": "continue_processing"}
```

---

### 2.3 `langgraph-checkpoints` Updates

**Changes Required:**

| Section | Update |
|---------|--------|
| Store patterns | Promote to main content (not just reference) |
| Checkpoint cleanup | NEW: Retention strategies |
| Graph migrations | NEW: Handle topology changes |

**New Code to Add:**

```python
# Graph migrations (topology changes)
# LangGraph automatically handles:
# - Adding/removing nodes
# - Renaming nodes
# - Adding/removing state keys
# Works for both active and completed threads

# Checkpoint cleanup strategies
from langgraph.checkpoint.postgres import PostgresSaver

# Option 1: TTL-based cleanup (configure at DB level)
# Option 2: Manual cleanup
async def cleanup_old_checkpoints(days: int = 30):
    cutoff = datetime.now() - timedelta(days=days)
    await db.execute(
        "DELETE FROM langgraph_checkpoints WHERE created_at < $1",
        cutoff
    )

# Thread management
def get_thread_history(thread_id: str):
    """Get all checkpoints for debugging."""
    config = {"configurable": {"thread_id": thread_id}}
    history = list(graph.get_state_history(config))
    return [
        {
            "step": cp.metadata.get("step"),
            "node": cp.metadata.get("source"),
            "timestamp": cp.metadata.get("created_at"),
            "values": cp.values
        }
        for cp in history
    ]
```

---

### 2.4 `langgraph-routing` Updates

**Changes Required:**

| Section | Update |
|---------|--------|
| Command API | NEW: Command vs conditional edges |
| Semantic routing | Add implementation (currently just referenced) |

**New Code to Add:**

```python
# When to use Command vs Conditional Edges
#
# Use COMMAND when:
# - Updating state AND routing in same node
# - Multi-agent handoffs
# - Human-in-the-loop responses
#
# Use CONDITIONAL EDGES when:
# - Pure routing based on state (no updates needed)
# - Simple branching logic

# Command pattern
from langgraph.types import Command

def router_with_update(state: State) -> Command[Literal["a", "b", "END"]]:
    if state["score"] > 0.8:
        return Command(update={"route_reason": "high score"}, goto="a")
    return Command(update={"route_reason": "low score"}, goto="b")

# Semantic routing implementation
from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer("all-MiniLM-L6-v2")

ROUTE_EMBEDDINGS = {
    "technical": embedder.encode("technical implementation code programming"),
    "business": embedder.encode("business strategy revenue customers"),
    "support": embedder.encode("help troubleshoot error problem fix"),
}

def semantic_router(state: State) -> str:
    query_embedding = embedder.encode(state["query"])
    similarities = {
        route: cosine_similarity(query_embedding, emb)
        for route, emb in ROUTE_EMBEDDINGS.items()
    }
    return max(similarities, key=similarities.get)
```

---

### 2.5 `langgraph-parallel` Updates

**Changes Required:**

| Section | Update |
|---------|--------|
| Send API | Complete workflow example |
| Map-reduce | Fix to actually be parallel |

**New Code to Add:**

```python
# Complete Send API example
from langgraph.constants import Send
from langgraph.graph import StateGraph, START, END

class OverallState(TypedDict):
    subjects: list[str]
    jokes: Annotated[list[str], add]

class JokeState(TypedDict):
    subject: str

def generate_topics(state: OverallState):
    return {"subjects": ["cats", "dogs", "programming"]}

def continue_to_jokes(state: OverallState) -> list[Send]:
    """Fan-out: create parallel branches."""
    return [
        Send("generate_joke", {"subject": s})
        for s in state["subjects"]
    ]

def generate_joke(state: JokeState) -> dict:
    joke = llm.invoke(f"Tell a joke about {state['subject']}")
    return {"jokes": [joke.content]}

# Build graph
builder = StateGraph(OverallState)
builder.add_node("generate_topics", generate_topics)
builder.add_node("generate_joke", generate_joke)

builder.add_edge(START, "generate_topics")
builder.add_conditional_edges("generate_topics", continue_to_jokes)
builder.add_edge("generate_joke", END)  # All branches converge

graph = builder.compile()

# Actually parallel map-reduce
import asyncio

async def parallel_map_reduce(items: list, process_fn, reduce_fn):
    """True parallel execution."""
    tasks = [asyncio.create_task(process_fn(item)) for item in items]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    successes = [r for r in results if not isinstance(r, Exception)]
    return reduce_fn(successes)
```

---

### 2.6 `langgraph-human-in-loop` Updates

**Changes Required:**

| Section | Update |
|---------|--------|
| interrupt() | Modern function-based pattern (not just compile-time) |
| Command(resume=) | Complete resume patterns |
| Tool interrupts | NEW: Approval in tool definitions |
| Validation loops | NEW: Repeated prompting pattern |

**New Code to Add:**

```python
# Modern interrupt() function (2026 best practice)
from langgraph.types import interrupt, Command

def approval_node(state: State):
    """Dynamic interrupt within node logic."""
    if state["risk_level"] == "high":
        approved = interrupt({
            "question": "High-risk action detected. Approve?",
            "details": state["action_details"],
            "risk_level": state["risk_level"]
        })
        if not approved:
            return {"status": "rejected", "action": None}
    return {"status": "approved", "action": state["proposed_action"]}

# Resume with Command
config = {"configurable": {"thread_id": "approval-123"}}
result = graph.invoke(initial_state, config)

if "__interrupt__" in result:
    # Show interrupt to user
    interrupt_info = result["__interrupt__"][0].value
    user_decision = get_user_approval(interrupt_info)

    # Resume with decision
    final = graph.invoke(Command(resume=user_decision), config)

# Tool with embedded interrupt
@tool
def delete_user(user_id: str) -> str:
    """Delete a user account (requires approval)."""
    response = interrupt({
        "action": "delete_user",
        "user_id": user_id,
        "message": f"Confirm deletion of user {user_id}?"
    })
    if response.get("approved"):
        db.delete_user(user_id)
        return f"User {user_id} deleted"
    return "Deletion cancelled"

# Validation loop pattern
def get_valid_age(state: State):
    """Repeatedly prompt until valid input."""
    prompt = "What is your age?"
    while True:
        answer = interrupt(prompt)
        if isinstance(answer, int) and 0 < answer < 150:
            return {"age": answer}
        prompt = f"'{answer}' is not valid. Please enter a number between 1 and 150."

# CRITICAL: Do's and Don'ts
# DO: Place side effects AFTER interrupt
# DON'T: Wrap interrupt in try/except (breaks the mechanism)
# DO: Make pre-interrupt side effects idempotent (upsert vs create)
# DON'T: Conditionally skip interrupt calls (breaks determinism)
```

---

### 2.7 `langgraph-functional` Updates

**Changes Required:**

| Section | Update |
|---------|--------|
| Reference docs | ADD: 4 reference files |
| Injectable parameters | NEW: store, config, previous patterns |
| Determinism rules | NEW: Critical for resumption |
| Side effects | NEW: Task encapsulation rules |

**New Reference Docs:**

```
src/skills/langgraph-functional/references/
├── injectable-parameters.md
├── determinism-rules.md
├── side-effects.md
└── migration-guide.md
```

**New Code to Add:**

```python
# Injectable parameters (full signature)
from langgraph.store.base import BaseStore
from langchain_core.runnables import RunnableConfig

@entrypoint(checkpointer=checkpointer, store=store)
def workflow(
    input: dict,
    *,
    previous: Any = None,      # Last return value for this thread
    store: BaseStore,          # Cross-thread memory
    config: RunnableConfig     # Runtime configuration
) -> dict:
    # Access long-term memory
    user_prefs = await store.aget(
        namespace=("users", input["user_id"]),
        key="preferences"
    )

    # Use previous state
    if previous and previous.get("completed"):
        return previous

    return {"result": "done", "completed": True}

# Determinism rules (CRITICAL)
@task
def get_current_time() -> float:
    """Non-deterministic ops MUST be in tasks."""
    return time.time()

@entrypoint(checkpointer=checkpointer)
def workflow(input: dict) -> dict:
    # CORRECT: Time captured in task, consistent on resume
    t1 = get_current_time().result()

    # WRONG: Would return different value on resume
    # t1 = time.time()

    return {"timestamp": t1}

# Side effects in tasks
@task
def send_notification(user_id: str, message: str):
    """Side effects in tasks prevent re-execution on resume."""
    email_service.send(user_id, message)

@entrypoint(checkpointer=checkpointer)
def workflow(input: dict):
    # Notification sent once, checkpoint prevents re-send
    send_notification(input["user_id"], "Started processing").result()

    # Human approval
    approved = interrupt("Approve?")

    # On resume, notification NOT re-sent (task result cached)
    return {"approved": approved}
```

---

## Part 3: Workflow-Architect Agent Updates

**File:** `src/agents/workflow-architect.md`

### Changes Required:

| Section | Update |
|---------|--------|
| Skills list | Add new skills |
| Example output | Add streaming config |
| Workflow patterns | Update to LangGraph 1.0 |
| Remove | Custom XML tags (not standard) |

**Updated Skills List:**

```yaml
skills:
  - langgraph-supervisor
  - langgraph-routing
  - langgraph-parallel
  - langgraph-state
  - langgraph-checkpoints
  - langgraph-human-in-loop
  - langgraph-functional
  - langgraph-streaming      # NEW
  - langgraph-subgraphs      # NEW
  - langgraph-tools          # NEW
  - multi-agent-orchestration
  - agent-loops
  - langfuse-observability
  - task-dependency-patterns
```

**Updated Example Output:**

```json
{
  "workflow": {
    "name": "content_analysis_v2",
    "type": "supervisor_worker",
    "version": "2.0.0",
    "langgraph_version": "1.0.7"
  },
  "graph": {
    "nodes": [...],
    "edges": [...],
    "uses_command_api": true,
    "uses_subgraphs": false
  },
  "streaming": {
    "modes": ["updates", "custom"],
    "custom_events": ["progress", "agent_complete"]
  },
  "checkpointing": {
    "backend": "postgres",
    "store_enabled": true,
    "retention_days": 7
  }
}
```

**Remove These Custom Tags:**

```markdown
<!-- REMOVE - not standard Claude behavior -->
<investigate_before_answering>
<use_parallel_tool_calls>
<avoid_overengineering>
```

Replace with standard directive format.

---

## Part 4: Production Example Resolution

### Option A: Implement Actual Code (RECOMMENDED)

Create real implementation in `src/examples/` directory:

```
src/examples/content-analysis-workflow/
├── README.md
├── requirements.txt
├── workflow.py
├── state.py
├── nodes/
│   ├── supervisor.py
│   ├── quality_gate.py
│   └── agents/
│       ├── security_agent.py
│       └── ... (8 agents)
├── tests/
│   └── test_workflow.py
└── run.py
```

**Effort:** 5 days
**Impact:** Transforms vaporware into proof of value

### Option B: Mark as Reference Architecture

If implementation not feasible, update the document:

```markdown
# OrchestKit Content Analysis Workflow

> **Note:** This is a **reference architecture** demonstrating production patterns.
> The code examples are illustrative and not deployed in this repository.
> Use these patterns as templates for your own implementations.

## Architecture (Reference)
...
```

**Effort:** 30 minutes
**Impact:** Sets correct expectations

---

## Part 5: Testing Strategy

### Add Skill Code Validation

Create `tests/skills/test-skill-code.py`:

```python
import ast
import pytest
from pathlib import Path

SKILLS_DIR = Path("src/skills")

def extract_python_blocks(markdown: str) -> list[str]:
    """Extract ```python blocks from markdown."""
    blocks = []
    in_block = False
    current = []
    for line in markdown.split("\n"):
        if line.startswith("```python"):
            in_block = True
            continue
        elif line.startswith("```") and in_block:
            blocks.append("\n".join(current))
            current = []
            in_block = False
        elif in_block:
            current.append(line)
    return blocks

@pytest.mark.parametrize("skill_path", list(SKILLS_DIR.glob("langgraph-*/SKILL.md")))
def test_skill_python_syntax(skill_path):
    """Verify all Python code blocks parse correctly."""
    content = skill_path.read_text()
    blocks = extract_python_blocks(content)

    for i, block in enumerate(blocks):
        try:
            ast.parse(block)
        except SyntaxError as e:
            pytest.fail(f"{skill_path.name} block {i}: {e}")

@pytest.mark.parametrize("skill_path", list(SKILLS_DIR.glob("langgraph-*/SKILL.md")))
def test_skill_imports_valid(skill_path):
    """Check that imports reference real modules."""
    content = skill_path.read_text()
    blocks = extract_python_blocks(content)

    invalid_imports = [
        "from langgraph.graph import StateGraph, END",  # END should come from constants
    ]

    for block in blocks:
        for invalid in invalid_imports:
            if invalid in block:
                pytest.fail(f"{skill_path.name}: Outdated import '{invalid}'")
```

---

## Part 6: Implementation Timeline

### Week 1: Foundation

| Day | Task | Owner |
|-----|------|-------|
| 1 | Create `langgraph-streaming` skill | - |
| 2 | Create `langgraph-subgraphs` skill | - |
| 3 | Create `langgraph-tools` skill | - |
| 4 | Update `langgraph-supervisor` with Command API | - |
| 5 | Update `langgraph-state` with context_schema, caching | - |

### Week 2: Completion

| Day | Task | Owner |
|-----|------|-------|
| 1 | Update `langgraph-routing` with semantic routing | - |
| 2 | Update `langgraph-parallel` with complete Send example | - |
| 3 | Update `langgraph-human-in-loop` with interrupt() patterns | - |
| 4 | Update `langgraph-functional` with reference docs | - |
| 5 | Update `workflow-architect` agent | - |

### Week 3: Quality

| Day | Task | Owner |
|-----|------|-------|
| 1-2 | Add code validation tests | - |
| 3-5 | Implement actual content-analysis-workflow (Option A) | - |

---

## Part 7: Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Assessment score | 7.4/10 | 9.0/10 |
| Skills count | 7 | 10 |
| Reference docs | 21 | 35+ |
| Code tests | 0 | 100% syntax validation |
| Vaporware docs | 1 | 0 |

---

## Sources

- [LangGraph 1.0 Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Functional API](https://docs.langchain.com/oss/python/langgraph/functional-api)
- [LangGraph Streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LangGraph Subgraphs](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)
- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph 1.0 Release](https://changelog.langchain.com/announcements/langgraph-1-0-is-now-generally-available)
- [LangGraph Best Practices](https://www.swarnendu.de/blog/langgraph-best-practices/)
- [LangGraph Explained 2026 Edition](https://medium.com/@dewasheesh.rana/langgraph-explained-2026-edition-ea8f725abff3)
- [LangGraph GitHub Releases](https://github.com/langchain-ai/langgraph/releases)

---

**Next Steps:** Review this plan and confirm which parts to implement first.
