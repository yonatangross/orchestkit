---
title: "Frameworks: Microsoft Agent Framework / AutoGen"
category: frameworks
impact: HIGH
impactDescription: "Ensures enterprise multi-agent systems use RoundRobin/Selector teams with proper termination conditions and A2A protocol"
tags: autogen, microsoft, teams, termination, a2a
---

# Microsoft Agent Framework (AutoGen + Semantic Kernel)

Enterprise multi-agent systems with RoundRobin/Selector teams, termination conditions, A2A protocol, and tool integration.

## Team Setup

```python
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient

# Create model client
model_client = OpenAIChatCompletionClient(model="gpt-5.2")

# Define agents
planner = AssistantAgent(
    name="planner",
    description="Plans complex tasks and breaks them into steps",
    model_client=model_client,
    system_message="You are a planning expert. Break tasks into actionable steps."
)

executor = AssistantAgent(
    name="executor",
    description="Executes planned tasks",
    model_client=model_client,
    system_message="You execute tasks according to the plan."
)

reviewer = AssistantAgent(
    name="reviewer",
    description="Reviews work and provides feedback",
    model_client=model_client,
    system_message="You review work. Say 'APPROVED' if satisfactory."
)

# Create team with termination condition
termination = TextMentionTermination("APPROVED")
team = RoundRobinGroupChat(
    participants=[planner, executor, reviewer],
    termination_condition=termination
)

# Run team
result = await team.run(task="Create a marketing strategy")
```

## Selector Group Chat

```python
from autogen_agentchat.teams import SelectorGroupChat

# Selector chooses next speaker based on context
team = SelectorGroupChat(
    participants=[analyst, writer, reviewer],
    model_client=model_client,
    termination_condition=termination
)
```

## Termination Conditions

```python
from autogen_agentchat.conditions import (
    TextMentionTermination,
    MaxMessageTermination,
    TokenUsageTermination,
    TimeoutTermination,
    OrTerminationCondition,
)

termination = OrTerminationCondition(
    TextMentionTermination("DONE"),
    MaxMessageTermination(max_messages=20),
    TimeoutTermination(timeout_seconds=300)
)
```

## Tool Integration

```python
from autogen_core.tools import FunctionTool

def search_database(query: str) -> str:
    """Search the database for information."""
    results = db.search(query)
    return json.dumps(results)

search_tool = FunctionTool(search_database, description="Search the database")

researcher = AssistantAgent(
    name="researcher",
    description="Researches information",
    model_client=model_client,
    tools=[search_tool],
    system_message="Use the search tool to find information."
)
```

## State Management

```python
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

protocol = A2AProtocol(
    agent=my_agent,
    endpoint="https://api.example.com/agent",
    auth_token=os.environ["A2A_TOKEN"]
)

response = await protocol.send(
    to="external-agent-id",
    message="Process this request"
)
```

## Streaming

```python
async for message in team.run_stream(task="Analyze this data"):
    print(f"{message.source}: {message.content}")
```

## OpenAI Agents SDK (0.7.0)

Alternative for OpenAI-native ecosystems:

```python
from agents import Agent, Runner, handoff, RunConfig
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX

researcher_agent = Agent(
    name="researcher",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are a research specialist. Gather information and facts.
When research is complete, hand off to the writer.""",
    model="gpt-5.2"
)

writer_agent = Agent(
    name="writer",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are a content writer. Create compelling content from research.""",
    model="gpt-5.2"
)

orchestrator = Agent(
    name="orchestrator",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You coordinate research and writing tasks.""",
    model="gpt-5.2",
    handoffs=[handoff(agent=researcher_agent), handoff(agent=writer_agent)]
)

async def run_workflow(task: str):
    runner = Runner()
    config = RunConfig(nest_handoff_history=True)
    result = await runner.run(orchestrator, task, run_config=config)
    return result.final_output
```

## Migration from AutoGen 0.2

```python
# Old AutoGen 0.2
# from autogen import AssistantAgent, UserProxyAgent

# New AutoGen 0.4+
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat

# Key differences:
# - No UserProxyAgent needed for simple tasks
# - Teams replace GroupChat
# - Explicit termination conditions required
# - Model client separate from agent
```

## Best Practices

1. Always set explicit termination conditions
2. Team size: 3-5 agents optimal
3. Clear role definitions in system_message
4. One function per tool with clear descriptions
5. Use try/except around team.run()
6. Use run_stream() for real-time feedback
