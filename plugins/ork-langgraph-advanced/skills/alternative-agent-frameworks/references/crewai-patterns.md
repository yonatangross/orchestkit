# CrewAI Patterns

CrewAI patterns for role-based multi-agent collaboration with hierarchical crews, memory, and delegation.

## Hierarchical Process

```python
from crewai import Agent, Crew, Task, Process

# Hierarchical crew with manager
crew = Crew(
    agents=[manager, researcher, writer, reviewer],
    tasks=[research_task, write_task, review_task],
    process=Process.hierarchical,
    manager_llm="gpt-4o",  # Manager uses this LLM for coordination
    memory=True,           # Enable shared memory
    verbose=True
)
```

## Agent Delegation

```python
# Agent that can delegate
manager = Agent(
    role="Project Manager",
    goal="Coordinate team and ensure deliverables",
    backstory="Senior PM with 10 years experience",
    allow_delegation=True,  # Can assign tasks to others
    memory=True,
    verbose=True
)

# Agent that cannot delegate
specialist = Agent(
    role="Data Analyst",
    goal="Analyze data and provide insights",
    backstory="Expert data scientist",
    allow_delegation=False,  # Must complete own tasks
    verbose=True
)
```

## Task Dependencies

```python
from crewai import Task

# Task with context from other tasks
research_task = Task(
    description="Research market trends for AI assistants",
    expected_output="Detailed market analysis report",
    agent=researcher
)

analysis_task = Task(
    description="Analyze research findings and identify opportunities",
    expected_output="Opportunity assessment with recommendations",
    agent=analyst,
    context=[research_task]  # Receives output from research_task
)
```

## Custom Tools

```python
from crewai.tools import tool

@tool("Search Database")
def search_database(query: str) -> str:
    """Search the internal database for relevant information.

    Args:
        query: The search query string
    """
    # Implementation
    results = db.search(query)
    return json.dumps(results)

# Assign tools to agent
researcher = Agent(
    role="Researcher",
    goal="Find accurate information",
    backstory="Expert researcher",
    tools=[search_database],
    verbose=True
)
```

## Memory Configuration

```python
from crewai.memory import ShortTermMemory, LongTermMemory, EntityMemory

crew = Crew(
    agents=[agent1, agent2],
    tasks=[task1, task2],
    memory=True,  # Enable all memory types

    # Or configure specific memory
    short_term_memory=ShortTermMemory(),
    long_term_memory=LongTermMemory(
        storage=ChromaStorage(collection_name="crew_memory")
    ),
    entity_memory=EntityMemory()
)
```

## Async Execution

```python
import asyncio

# Async crew execution
async def run_crew_async():
    crew = Crew(
        agents=[agent1, agent2],
        tasks=[task1, task2],
        process=Process.sequential
    )

    # Async kickoff
    result = await crew.kickoff_async()
    return result

# Run with asyncio
result = asyncio.run(run_crew_async())
```

## Configuration

- **Process types**: `sequential`, `hierarchical`
- **Manager LLM**: Required for hierarchical process
- **Memory**: Enable for context sharing between agents
- **Verbose**: Enable for debugging agent decisions
- **Max RPM**: Rate limit API calls across crew

## Best Practices

1. **Role clarity**: Each agent has distinct, non-overlapping role
2. **Task granularity**: One clear deliverable per task
3. **Delegation limits**: Only managers should delegate
4. **Memory scope**: Use short-term for session, long-term for persistent knowledge
5. **Error handling**: Use `max_retries` on tasks for resilience
