---
title: Build role-based agent collaboration with CrewAI Flows, hierarchical crews, and structured outputs
category: frameworks
impact: HIGH
impactDescription: "Ensures role-based agent collaboration with Flows architecture, hierarchical crews, and structured outputs"
tags: crewai, flows, hierarchical, mcp, guardrails
---

# CrewAI Patterns (v1.8+)

Role-based multi-agent collaboration with Flows architecture, hierarchical crews, MCP tools, and async execution.

## Hierarchical Crew

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

## Flows Architecture (1.8+)

Event-driven orchestration with state management:

```python
from crewai.flow.flow import Flow, listen, start, router

class ResearchFlow(Flow):
    @start()
    def generate_topic(self):
        return "AI Safety"

    @listen(generate_topic)
    def research_topic(self, topic):
        return f"Research findings on {topic}"

    @router(research_topic)
    def route_result(self, result):
        if "sufficient" in result:
            return "success"
        return "retry"

    @listen("success")
    def handle_success(self):
        return "Workflow completed"

    @listen("retry")
    def handle_retry(self):
        return "Retrying..."

flow = ResearchFlow()
result = flow.kickoff()
```

### Parallel Execution with and_/or_

```python
from crewai.flow.flow import Flow, listen, start, and_, or_

class ParallelFlow(Flow):
    @start()
    def task_a(self):
        return "Result A"

    @start()
    def task_b(self):
        return "Result B"

    @listen(and_(task_a, task_b))
    def combine_results(self):
        """Triggers when BOTH complete"""
        return "Combined results"
```

## Structured Output

```python
from pydantic import BaseModel

class ReportOutput(BaseModel):
    title: str
    summary: str
    findings: list[str]
    confidence: float

task = Task(
    description="Analyze market trends",
    expected_output="Structured market analysis",
    agent=analyst,
    output_pydantic=ReportOutput
)

result = crew.kickoff()
report = result.pydantic
```

## Task Guardrails

```python
from crewai.tasks import TaskOutput

def validate_length(result: TaskOutput) -> tuple[bool, any]:
    if len(result.raw.split()) < 100:
        return (False, "Content too brief, expand analysis")
    return (True, result.raw)

task = Task(
    description="Write comprehensive analysis",
    expected_output="Detailed analysis (100+ words)",
    agent=writer,
    guardrail=validate_length,
    guardrail_max_retries=3
)
```

## MCP Tool Support (1.8+)

```python
from crewai import Agent

agent = Agent(
    role="Research Analyst",
    goal="Research and analyze information",
    backstory="Expert analyst",
    mcps=[
        "https://mcp.example.com/mcp?api_key=your_key",
        "crewai-amp:financial-data",
    ]
)
```

## Decorator-Based Crew (Recommended)

```python
from crewai import Agent, Crew, Task, CrewBase, agent, task, crew

@CrewBase
class ResearchCrew:
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def researcher(self) -> Agent:
        return Agent(config=self.agents_config['researcher'], tools=[search_tool])

    @task
    def research_task(self) -> Task:
        return Task(config=self.tasks_config['research'])

    @crew
    def crew(self) -> Crew:
        return Crew(agents=self.agents, tasks=self.tasks, process=Process.sequential)

result = ResearchCrew().crew().kickoff(inputs={"topic": "AI Safety"})
```

## Best Practices

1. Use Flows for complex multi-step workflows
2. Prefer `@CrewBase` decorator-based definition
3. Enable structured outputs with `output_pydantic`
4. Add guardrails for output validation
5. Use `async_execution=True` for independent tasks
6. Role clarity: each agent has distinct, non-overlapping role
7. One clear deliverable per task

**Incorrect — sequential process without hierarchical manager:**
```python
crew = Crew(
    agents=[researcher, writer, reviewer],
    tasks=[research_task, write_task, review_task],
    process=Process.sequential  # No delegation, rigid order
)
```

**Correct — hierarchical process with manager delegation:**
```python
crew = Crew(
    agents=[manager, researcher, writer, reviewer],
    tasks=[project_task],
    process=Process.hierarchical,  # Manager delegates dynamically
    manager_llm="gpt-5.2"
)
```
