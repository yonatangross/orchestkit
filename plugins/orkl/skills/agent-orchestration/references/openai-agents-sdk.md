# OpenAI Agents SDK

OpenAI Agents SDK (v0.7.0) patterns for handoffs, guardrails, agents-as-tools, sessions, MCP servers, and tracing.

## Requirements

```bash
# Install (requires Python 3.9+, supports up to 3.14)
pip install openai-agents>=0.7.0

# Note: Requires openai v2.x (v1.x no longer supported)
# openai>=2.9.0,<3 is required
```

## Basic Agent Definition

```python
from agents import Agent, Runner

agent = Agent(
    name="assistant",
    instructions="You are a helpful assistant that answers questions.",
    model="gpt-5.2"
)

# Synchronous run
runner = Runner()
result = runner.run_sync(agent, "What is the capital of France?")
print(result.final_output)
```

## Sessions (v0.6.6+)

Sessions provide automatic conversation history management across agent runs.

```python
from agents import Agent, Runner
from agents.sessions import SQLiteSession

# Create a session store
session = SQLiteSession(db_path="conversations.db")

# Agent with automatic history management
agent = Agent(
    name="assistant",
    instructions="You are a helpful assistant.",
    model="gpt-5.2"
)

runner = Runner()

# Sessions automatically:
# - Retrieve conversation history before each run
# - Store new messages after each run
result = await runner.run(
    agent,
    "Remember my name is Alice",
    session=session,
    session_id="user-123"
)

# Later conversation - history is automatic
result = await runner.run(
    agent,
    "What is my name?",  # Agent recalls "Alice"
    session=session,
    session_id="user-123"
)
```

### Session Types

```python
from agents.sessions import (
    SQLiteSession,          # File-based persistence
    AsyncSQLiteSession,     # Async SQLite (v0.6.6+)
    SQLAlchemySession,      # Database-agnostic ORM
    RedisSession,           # Redis-backed sessions
    EncryptedSession,       # Encrypted storage
)

# AsyncSQLiteSession for async workflows
async_session = AsyncSQLiteSession(db_path="async_conversations.db")

# Auto-compaction for long conversations (v0.6.6+)
# Use responses.compact: "auto" to manage context length
```

## Handoffs Between Agents

```python
from agents import Agent, handoff, RunConfig
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX

# Specialist agents
billing_agent = Agent(
    name="billing",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You handle billing inquiries. Check account status and payment issues.
Hand back to triage when billing issue is resolved.""",
    model="gpt-5.2"
)

support_agent = Agent(
    name="support",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You handle technical support. Troubleshoot issues and provide solutions.
Hand back to triage when support issue is resolved.""",
    model="gpt-5.2"
)

# Triage agent with handoffs
triage_agent = Agent(
    name="triage",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are the first point of contact. Determine the nature of inquiries.
- Billing questions: hand off to billing
- Technical issues: hand off to support
- General questions: answer directly""",
    model="gpt-5.2",
    handoffs=[
        handoff(agent=billing_agent),
        handoff(agent=support_agent)
    ]
)
```

### Handoff History Packaging (v0.7.0)

In v0.7.0, nested handoffs are **opt-in** (previously enabled by default). When enabled, conversation history is collapsed into a single assistant message wrapped in a `<CONVERSATION HISTORY>` block.

```python
from agents import RunConfig

# Enable nested handoff history (opt-in in v0.7.0)
config = RunConfig(nest_handoff_history=True)

result = await runner.run(
    triage_agent,
    "I have a billing question",
    run_config=config
)

# History is packaged as a single assistant message:
# <CONVERSATION HISTORY>
# [collapsed prior transcript]
# </CONVERSATION HISTORY>
```

### Handoff Input Filters

```python
from agents import handoff
from agents.extensions.handoff_filters import remove_all_tools

# Filter what the receiving agent sees
billing_handoff = handoff(
    agent=billing_agent,
    input_filter=remove_all_tools  # Strip tool calls from history
)

# Custom input filter
def custom_filter(data):
    # Modify HandoffInputData before passing to receiving agent
    return data

support_handoff = handoff(
    agent=support_agent,
    input_filter=custom_filter,
    nest_handoff_history=True  # Per-handoff override
)
```

## MCPServerManager (v0.7.0)

Manage multiple MCP server instances with improved lifecycle safety.

```python
from agents import Agent
from agents.mcp import MCPServerManager, MCPServerStdio, MCPServerStreamableHTTP

# Create MCP server manager for multiple servers
async with MCPServerManager() as manager:
    # Add stdio-based MCP server
    filesystem_server = await manager.add_server(
        MCPServerStdio(
            name="filesystem",
            command="npx",
            args=["-y", "@anthropic/mcp-filesystem", "/path/to/dir"]
        )
    )

    # Add HTTP-based MCP server
    api_server = await manager.add_server(
        MCPServerStreamableHTTP(
            name="api-tools",
            url="http://localhost:8080/mcp"
        )
    )

    # Get tools from all servers
    all_tools = await manager.list_tools()

    # Create agent with MCP tools
    agent = Agent(
        name="mcp_agent",
        instructions="Use available tools to help the user.",
        model="gpt-5.2",
        mcp_servers=[filesystem_server, api_server]
    )

    runner = Runner()
    result = await runner.run(agent, "List files in the current directory")
```

### Single MCP Server

```python
from agents import Agent
from agents.mcp import MCPServerStdio

# Single MCP server (simpler pattern)
async with MCPServerStdio(
    name="filesystem",
    command="npx",
    args=["-y", "@anthropic/mcp-filesystem", "/tmp"]
) as server:
    agent = Agent(
        name="file_agent",
        instructions="Help with file operations.",
        model="gpt-5.2",
        mcp_servers=[server]
    )
    result = await runner.run(agent, "What files are available?")
```

## Agents as Tools

```python
from agents import Agent, tool

# Define tool functions
@tool
def search_knowledge_base(query: str) -> str:
    """Search the knowledge base for relevant information."""
    # Implementation
    return search_results

@tool
def create_ticket(title: str, description: str, priority: str) -> str:
    """Create a support ticket in the system."""
    ticket_id = ticket_system.create(title, description, priority)
    return f"Created ticket {ticket_id}"

# Agent with tools
support_agent = Agent(
    name="support",
    instructions="Help users with technical issues. Search knowledge base first.",
    model="gpt-5.2",
    tools=[search_knowledge_base, create_ticket]
)
```

## Guardrails

```python
from agents import Agent, InputGuardrail, OutputGuardrail
from agents.exceptions import InputGuardrailException

# Input guardrail
class ContentFilter(InputGuardrail):
    async def check(self, input_text: str) -> str:
        if contains_pii(input_text):
            raise InputGuardrailException("PII detected in input")
        return input_text

# Output guardrail
class ResponseValidator(OutputGuardrail):
    async def check(self, output_text: str) -> str:
        if contains_harmful_content(output_text):
            return "I cannot provide that information."
        return output_text

# Agent with guardrails
agent = Agent(
    name="safe_assistant",
    instructions="You are a helpful assistant.",
    model="gpt-5.2",
    input_guardrails=[ContentFilter()],
    output_guardrails=[ResponseValidator()]
)
```

### Tool Guardrails (v0.6.5+)

```python
from agents import tool, tool_guardrail

@tool_guardrail
def validate_ticket_priority(priority: str) -> str:
    """Validate ticket priority before creation."""
    valid = ["low", "medium", "high", "critical"]
    if priority.lower() not in valid:
        raise ValueError(f"Priority must be one of: {valid}")
    return priority

@tool
@validate_ticket_priority
def create_ticket(title: str, description: str, priority: str) -> str:
    """Create a support ticket."""
    return f"Created ticket with priority {priority}"
```

## Tracing and Observability

```python
from agents import Agent, Runner, trace

# Enable tracing
runner = Runner(trace=True)

# Custom trace spans
async def complex_workflow(task: str):
    with trace.span("research_phase"):
        research = await runner.run(researcher, task)

    with trace.span("writing_phase"):
        content = await runner.run(writer, research.final_output)

    return content

# Access trace data
result = await runner.run(agent, "Process this request")
print(result.trace_id)  # For debugging

# Per-run tracing API key (v0.6.5+)
config = RunConfig(tracing={"api_key": "sk-tracing-123"})
result = await runner.run(agent, "Task", run_config=config)
```

## Streaming Responses

```python
from agents import Agent, Runner

agent = Agent(
    name="streamer",
    instructions="Provide detailed explanations.",
    model="gpt-5.2"
)

runner = Runner()

# Stream response chunks
async for chunk in runner.run_streamed(agent, "Explain quantum computing"):
    print(chunk.content, end="", flush=True)
```

## Multi-Agent Conversation

```python
from agents import Agent, Runner

# Manual conversation management
runner = Runner()

# Initial run
result1 = await runner.run(triage_agent, "I need help with my account")

# Continue with result's input list
result2 = await runner.run(
    result1.handoff_to or triage_agent,
    "Can you check my billing?",
    input=result1.to_input_list()  # Carries conversation history
)

# Or use Sessions for automatic management (recommended)
from agents.sessions import SQLiteSession

session = SQLiteSession(db_path="conversations.db")
result = await runner.run(
    triage_agent,
    "I need help",
    session=session,
    session_id="conv-123"
)
```

## Realtime and Voice

```python
from agents import Agent
from agents.realtime import RealtimeRunner, OpenAIRealtimeWebSocketModel

# WebSocket-based realtime agent
model = OpenAIRealtimeWebSocketModel(
    model="gpt-5.2-realtime",
    # Custom WebSocket options (v0.7.0+)
    websocket_options={"ping_interval": 30}
)

agent = Agent(
    name="voice_assistant",
    instructions="You are a voice assistant.",
    model=model
)

# Realtime runner for voice interactions
realtime_runner = RealtimeRunner()
await realtime_runner.run(agent, audio_stream)
```

## Configuration

### Model Settings (v0.7.0)

```python
from agents import Agent, RunConfig

# Note: Default reasoning.effort for gpt-5.1/5.2 is now "none"
# (previously "low"). Set explicitly if needed:
config = RunConfig(
    model_settings={
        "reasoning": {"effort": "low"}  # Restore previous behavior
    }
)

agent = Agent(
    name="assistant",
    instructions="You are helpful.",
    model="gpt-5.2"
)

result = await runner.run(agent, "Complex task", run_config=config)
```

### Provider Support

The SDK supports 100+ LLMs via LiteLLM integration:

```python
from agents import Agent, set_default_openai_api

# Use Chat Completions API (for non-OpenAI providers)
set_default_openai_api("chat_completions")

# Or use LiteLLM for other providers
# pip install openai-agents[litellm]
from agents.extensions.litellm import LiteLLMModel

agent = Agent(
    name="claude_agent",
    instructions="You are helpful.",
    model=LiteLLMModel(model="anthropic/claude-sonnet-4-20250514")
)
```

## Best Practices

1. **Handoff clarity**: Use `RECOMMENDED_PROMPT_PREFIX` for reliable handoffs
2. **Tool documentation**: Clear docstrings improve tool selection accuracy
3. **Guardrail layers**: Combine input + output guardrails for defense-in-depth
4. **Tracing**: Always enable in production for debugging
5. **Error handling**: Catch guardrail exceptions gracefully
6. **Sessions**: Use for multi-turn conversations instead of manual history
7. **MCP servers**: Use `MCPServerManager` for multiple servers with proper lifecycle

## Breaking Changes in v0.7.0

| Change | Previous | v0.7.0 |
|--------|----------|--------|
| Nested handoffs | Enabled by default | Opt-in via `nest_handoff_history=True` |
| Reasoning effort | Default "low" | Default "none" for gpt-5.1/5.2 |
| Session input | Required callback | Auto-append (callback optional) |
| OpenAI library | v1.x supported | Requires v2.x (>=2.9.0) |

## Version History

- **v0.7.0** (Jan 2026): MCPServerManager, opt-in nested handoffs, session input auto-append
- **v0.6.6** (Jan 2026): Auto-compaction, AsyncSQLiteSession
- **v0.6.5** (Jan 2026): Per-run tracing, tool guardrails decorator
- **v0.6.0**: Sessions feature, improved handoff history
