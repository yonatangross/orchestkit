# Microsoft Agent Framework

Microsoft Agent Framework (AutoGen + Semantic Kernel merger) patterns for enterprise multi-agent systems.

## AssistantAgent Setup

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_ext.models.openai import OpenAIChatCompletionClient

# Create model client
model_client = OpenAIChatCompletionClient(
    model="gpt-5.2",
    api_key=os.environ["OPENAI_API_KEY"]
)

# Define assistant agent
assistant = AssistantAgent(
    name="assistant",
    description="A helpful AI assistant",
    model_client=model_client,
    system_message="You are a helpful assistant. Answer questions concisely."
)
```

## Team Patterns

### Round Robin Chat

```python
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination

# Define team members
planner = AssistantAgent(
    name="planner",
    description="Plans tasks",
    model_client=model_client,
    system_message="You plan tasks. When done, say 'PLAN_COMPLETE'."
)

executor = AssistantAgent(
    name="executor",
    description="Executes tasks",
    model_client=model_client,
    system_message="You execute the plan. When done, say 'EXECUTION_COMPLETE'."
)

reviewer = AssistantAgent(
    name="reviewer",
    description="Reviews work",
    model_client=model_client,
    system_message="Review the work. Say 'APPROVED' if satisfactory."
)

# Create team with termination
termination = TextMentionTermination("APPROVED")
team = RoundRobinGroupChat(
    participants=[planner, executor, reviewer],
    termination_condition=termination
)

# Run team
result = await team.run(task="Create a marketing strategy")
```

### Selector Group Chat

```python
from autogen_agentchat.teams import SelectorGroupChat

# Selector chooses next speaker based on context
team = SelectorGroupChat(
    participants=[analyst, writer, reviewer],
    model_client=model_client,  # For selection decisions
    termination_condition=termination
)
```

## Tool Integration

```python
from autogen_core.tools import FunctionTool

# Define tool function
def search_database(query: str) -> str:
    """Search the database for information."""
    results = db.search(query)
    return json.dumps(results)

# Create tool
search_tool = FunctionTool(search_database, description="Search the database")

# Agent with tools
researcher = AssistantAgent(
    name="researcher",
    description="Researches information",
    model_client=model_client,
    tools=[search_tool],
    system_message="Use the search tool to find information."
)
```

## Termination Conditions

```python
from autogen_agentchat.conditions import (
    TextMentionTermination,
    MaxMessageTermination,
    TokenUsageTermination,
    TimeoutTermination
)

# Combine termination conditions
from autogen_agentchat.conditions import OrTerminationCondition

termination = OrTerminationCondition(
    TextMentionTermination("DONE"),
    MaxMessageTermination(max_messages=20),
    TimeoutTermination(timeout_seconds=300)
)
```

## Streaming

```python
# Stream team responses
async for message in team.run_stream(task="Analyze this data"):
    print(f"{message.source}: {message.content}")
```

## State Management

```python
from autogen_agentchat.state import TeamState

# Save state
state = await team.save_state()

# Restore state
await team.load_state(state)

# Resume conversation
result = await team.run(task="Continue from where we left off")
```

## Agent-to-Agent Protocol (A2A)

```python
from autogen_agentchat.protocols import A2AProtocol

# Enable A2A for cross-organization agent communication
protocol = A2AProtocol(
    agent=my_agent,
    endpoint="https://api.example.com/agent",
    auth_token=os.environ["A2A_TOKEN"]
)

# Send message to external agent
response = await protocol.send(
    to="external-agent-id",
    message="Process this request"
)
```

## Migration from AutoGen 0.2

```python
# Old AutoGen 0.2 pattern
# from autogen import AssistantAgent, UserProxyAgent

# New AutoGen 0.4+ pattern
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat

# Key differences:
# - No UserProxyAgent needed for simple tasks
# - Teams replace GroupChat
# - Explicit termination conditions required
# - Model client separate from agent
```

## Configuration

- **Model clients**: OpenAI, Azure OpenAI, Anthropic supported
- **Teams**: RoundRobin, Selector, Custom
- **Termination**: Text mention, max messages, timeout, token usage
- **Tools**: FunctionTool wrapper for Python functions
- **State**: Full state serialization for persistence

## Best Practices

1. **Termination conditions**: Always set explicit termination
2. **Team size**: 3-5 agents optimal for most workflows
3. **System messages**: Clear role definitions in system_message
4. **Tool design**: One function per tool, clear descriptions
5. **Error handling**: Use try/except around team.run()
6. **Streaming**: Use run_stream() for real-time feedback
