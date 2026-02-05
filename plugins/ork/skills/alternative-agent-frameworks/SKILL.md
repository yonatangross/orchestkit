---
name: alternative-agent-frameworks
description: Multi-agent frameworks beyond LangGraph. CrewAI crews, Microsoft Agent Framework, OpenAI Agents SDK, GPT-5.2-Codex. Use when building multi-agent systems, choosing frameworks.
version: 1.1.0
tags: [crewai, autogen, openai-agents, microsoft, multi-agent, orchestration, gpt-5.2-codex]
context: fork
agent: workflow-architect
author: OrchestKit
user-invocable: false
---

# Alternative Agent Frameworks

Multi-agent frameworks beyond LangGraph for specialized use cases.

## Framework Comparison

| Framework | Best For | Key Features |  Status |
|-----------|----------|--------------|-------------|
| LangGraph 1.0.6 | Complex stateful workflows | Persistence, streaming, human-in-loop | Production |
| CrewAI 1.8.x | Role-based collaboration | Flows, hierarchical crews, a2a, HITL | Production |
| OpenAI Agents SDK 0.7.0 | OpenAI ecosystem | Handoffs, guardrails, MCPServerManager, Sessions | Production |
| GPT-5.2-Codex | Long-horizon coding | Context compaction, project-scale, security | Production |
| MS Agent Framework | Enterprise | AutoGen+SK merger, A2A, compliance | Public Preview |
| AG2 | Open-source, flexible | Community fork of AutoGen | Active |

## CrewAI Hierarchical Crew (1.8.x)

```python
from crewai import Agent, Crew, Task, Process
from crewai.flow.flow import Flow, listen, start

# Manager coordinates the team
manager = Agent(
    role="Project Manager",
    goal="Coordinate team efforts and ensure project success",
    backstory="Experienced project manager skilled at delegation",
    allow_delegation=True,
    memory=True,
    verbose=True
)

# Specialist agents
researcher = Agent(
    role="Researcher",
    goal="Provide accurate research and analysis",
    backstory="Expert researcher with deep analytical skills",
    allow_delegation=False,
    verbose=True
)

writer = Agent(
    role="Writer",
    goal="Create compelling content",
    backstory="Skilled writer who creates engaging content",
    allow_delegation=False,
    verbose=True
)

# Manager-led task
project_task = Task(
    description="Create a comprehensive market analysis report",
    expected_output="Executive summary, analysis, recommendations",
    agent=manager
)

# Hierarchical crew
crew = Crew(
    agents=[manager, researcher, writer],
    tasks=[project_task],
    process=Process.hierarchical,
    manager_llm="gpt-5.2",
    memory=True,
    verbose=True
)

result = crew.kickoff()
```

## OpenAI Agents SDK Multi-Agent (0.7.0)

```python
from agents import Agent, Runner, handoff, RunConfig
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX
# Note: v0.7.0 adds MCPServerManager, opt-in nested handoffs, requires openai v2.x

# Define specialized agents
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
You are a content writer. Create compelling content from research.
When done, hand off to orchestrator for final review.""",
    model="gpt-5.2"
)

# Orchestrator with handoffs
orchestrator = Agent(
    name="orchestrator",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You coordinate research and writing tasks.
Hand off to researcher for information gathering.
Hand off to writer for content creation.""",
    model="gpt-5.2",
    handoffs=[
        handoff(agent=researcher_agent),
        handoff(agent=writer_agent)
    ]
)

# Run with handoffs (v0.7.0: nested handoffs are opt-in)
async def run_workflow(task: str):
    runner = Runner()
    config = RunConfig(nest_handoff_history=True)  # Opt-in for history packaging
    result = await runner.run(orchestrator, task, run_config=config)
    return result.final_output
```

## Microsoft Agent Framework ()

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
    system_message="You review work and ensure quality standards."
)

# Create team with termination condition
termination = TextMentionTermination("APPROVED")
team = RoundRobinGroupChat(
    participants=[planner, executor, reviewer],
    termination_condition=termination
)

# Run team
async def run_team(task: str):
    result = await team.run(task=task)
    return result.messages[-1].content
```

## Decision Framework

| Criteria | Choose |
|----------|--------|
| Need persistence & checkpoints | LangGraph |
| Role-based collaboration | CrewAI |
| OpenAI-native ecosystem | OpenAI Agents SDK |
| Long-horizon coding tasks | GPT-5.2-Codex |
| Project-scale refactors | GPT-5.2-Codex |
| Enterprise compliance | Microsoft Agent Framework |
| Open-source flexibility | AG2 |
| Complex state machines | LangGraph |
| Quick prototyping | CrewAI or OpenAI SDK |
| Production observability | LangGraph + Langfuse |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Framework | Match to team expertise + use case |
| Agent count | 3-8 per workflow |
| Communication | Handoffs (OpenAI) or shared state (CrewAI) |
| Memory | Built-in for CrewAI, custom for others |

## Common Mistakes

- Mixing frameworks in one project (complexity explosion)
- Ignoring framework maturity (beta vs production)
- No fallback strategy (framework lock-in)
- Overcomplicating simple tasks (use single agent)

## Reference Documents

- `references/gpt-5-2-codex.md` - GPT-5.2-Codex agentic coding model
- `references/openai-agents-sdk.md` - OpenAI Agents SDK patterns
- `references/crewai-patterns.md` - CrewAI hierarchical crews
- `references/microsoft-agent-framework.md` - Microsoft Agent Framework
- `references/framework-comparison.md` - Decision matrix for framework selection

## Related Skills

- `langgraph-supervisor` - LangGraph supervisor pattern
- `multi-agent-orchestration` - Framework-agnostic patterns
- `agent-loops` - Single agent patterns

## Capability Details

### crewai-patterns
**Keywords:** crewai, crew, hierarchical, delegation, role-based
**Solves:**
- Build role-based agent teams
- Implement hierarchical coordination
- Enable agent delegation

### openai-agents-sdk
**Keywords:** openai, agents sdk, handoffs, guardrails, tracing
**Solves:**
- Use OpenAI Agents SDK patterns
- Implement handoff workflows
- Add guardrails and tracing

### microsoft-agent-framework
**Keywords:** microsoft, autogen, semantic kernel, a2a, enterprise
**Solves:**
- Build enterprise agent systems
- Use AutoGen/SK merged framework
- Implement A2A protocol

### framework-selection
**Keywords:** choose, compare, framework, decision, which
**Solves:**
- Select appropriate framework
- Compare framework capabilities
- Match framework to requirements

### gpt-5-2-codex
**Keywords:** gpt-5.2-codex, codex, openai, agentic, coding, long-horizon, refactor, migration
**Solves:**
- Long-horizon coding sessions
- Project-scale refactors and migrations
- Context compaction for extended tasks
- Security-aware code generation
- IDE integration with Cursor, Windsurf, GitHub
