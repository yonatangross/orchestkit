# CrewAI Patterns (v1.8+)

CrewAI patterns for role-based multi-agent collaboration with Flows architecture, hierarchical crews, MCP tools, and async execution.

> **Version**: This document covers CrewAI 1.8.x - 1.9.x (2026). For earlier versions, patterns may differ.

## Table of Contents

- [Flows Architecture (1.8+)](#flows-architecture-18)
- [MCP Tool Support (1.8+)](#mcp-tool-support-18)
- [Hierarchical Process](#hierarchical-process)
- [Agent Configuration (1.8+)](#agent-configuration-18)
- [Task Configuration (1.8+)](#task-configuration-18)
- [Async Execution](#async-execution)
- [Streaming Output](#streaming-output)
- [Knowledge Sources (1.8+)](#knowledge-sources-18)
- [Memory Configuration](#memory-configuration)
- [Custom Tools](#custom-tools)
- [Decorator-Based Crew Definition](#decorator-based-crew-definition-recommended)
- [Human-in-the-Loop (Flows)](#human-in-the-loop-flows)
- [Configuration Summary](#configuration-summary)
- [Best Practices](#best-practices)
- [Migration from 0.x](#migration-from-0x)

---

## Flows Architecture (1.8+)

Flows provide event-driven orchestration with state management. This is the major 1.x feature for complex multi-step workflows.

### Basic Flow

```python
from crewai.flow.flow import Flow, listen, start

class ResearchFlow(Flow):
    @start()
    def generate_topic(self):
        """Entry point - marked with @start()"""
        return "AI Safety"

    @listen(generate_topic)
    def research_topic(self, topic):
        """Triggered when generate_topic completes"""
        return f"Research findings on {topic}"

    @listen(research_topic)
    def summarize(self, findings):
        """Chain multiple listeners"""
        return f"Summary: {findings[:100]}..."

# Execute flow
flow = ResearchFlow()
result = flow.kickoff()
```

### Structured State (Pydantic)

```python
from pydantic import BaseModel
from crewai.flow.flow import Flow, listen, start

class WorkflowState(BaseModel):
    topic: str = ""
    research: str = ""
    summary: str = ""
    iteration: int = 0

class StatefulFlow(Flow[WorkflowState]):
    @start()
    def initialize(self):
        self.state.topic = "Machine Learning"
        self.state.iteration = 1

    @listen(initialize)
    def process(self):
        self.state.research = f"Research on {self.state.topic}"
        self.state.iteration += 1
        return self.state.research
```

### Router for Conditional Branching

```python
from crewai.flow.flow import Flow, listen, start, router

class ConditionalFlow(Flow):
    @start()
    def evaluate(self):
        # Returns condition result
        return {"score": 85, "passed": True}

    @router(evaluate)
    def route_result(self, result):
        """Route based on evaluation"""
        if result["passed"]:
            return "success"
        return "retry"

    @listen("success")
    def handle_success(self):
        return "Workflow completed successfully"

    @listen("retry")
    def handle_retry(self):
        return "Retrying workflow..."
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

    @listen(or_(task_a, task_b))
    def first_result(self):
        """Triggers when EITHER completes"""
        return "First result received"
```

### Integrating Crews with Flows

```python
from crewai.flow.flow import Flow, listen, start
from crewai import Crew, Agent, Task

class CrewFlow(Flow):
    @start()
    def prepare_inputs(self):
        return {"topic": "AI Agents", "depth": "detailed"}

    @listen(prepare_inputs)
    def run_research_crew(self, inputs):
        researcher = Agent(
            role="Researcher",
            goal="Research the given topic thoroughly",
            backstory="Expert researcher with domain knowledge"
        )

        task = Task(
            description=f"Research {inputs['topic']} at {inputs['depth']} level",
            expected_output="Comprehensive research report",
            agent=researcher
        )

        crew = Crew(agents=[researcher], tasks=[task])
        result = crew.kickoff()
        return result.raw
```

---

## MCP Tool Support (1.8+)

CrewAI supports Model Context Protocol (MCP) for external tool integration.

### Simple DSL (Recommended)

```python
from crewai import Agent

# URL-based MCP server
agent = Agent(
    role="Research Analyst",
    goal="Research and analyze information",
    backstory="Expert analyst",
    mcps=[
        "https://mcp.example.com/mcp?api_key=your_key",
        "crewai-amp:financial-data",  # CrewAI marketplace
        "crewai-amp:research-tools#pubmed_search"  # Specific tool
    ]
)
```

### Transport-Specific Configuration

```python
from crewai import Agent
from crewai.mcp import MCPServerStdio, MCPServerHTTP, MCPServerSSE
from crewai.mcp.tool_filter import create_static_tool_filter

# Local server via stdio
agent = Agent(
    role="File Analyst",
    goal="Analyze local files",
    backstory="File processing expert",
    mcps=[
        MCPServerStdio(
            command="npx",
            args=["-y", "@modelcontextprotocol/server-filesystem"],
            tool_filter=create_static_tool_filter(
                allowed_tool_names=["read_file", "list_directory"]
            )
        )
    ]
)

# Remote HTTP server
agent = Agent(
    role="API Analyst",
    goal="Query external APIs",
    backstory="Integration specialist",
    mcps=[
        MCPServerHTTP(
            url="https://api.example.com/mcp",
            headers={"Authorization": "Bearer token"},
            connect_timeout=60
        )
    ]
)

# Server-Sent Events (streaming)
agent = Agent(
    role="Real-time Analyst",
    goal="Monitor streaming data",
    backstory="Real-time data specialist",
    mcps=[
        MCPServerSSE(
            url="https://stream.example.com/mcp",
            headers={"Authorization": "Bearer token"}
        )
    ]
)
```

### MCPServerAdapter (Advanced)

```python
from crewai import Agent, Crew, Task
from crewai_tools import MCPServerAdapter

# Context manager for manual connection management
with MCPServerAdapter(server_params, connect_timeout=60) as mcp_tools:
    agent = Agent(
        role="MCP Tool User",
        goal="Use MCP tools effectively",
        backstory="Tool specialist",
        tools=mcp_tools,
        verbose=True
    )

    # Or filter specific tools
    filtered_tools = mcp_tools["specific_tool_name"]
```

---

## Hierarchical Process

```python
from crewai import Agent, Crew, Task, Process

manager = Agent(
    role="Project Manager",
    goal="Coordinate team and ensure deliverables",
    backstory="Senior PM with 10 years experience",
    allow_delegation=True,
    verbose=True
)

researcher = Agent(
    role="Researcher",
    goal="Find accurate information",
    backstory="Expert researcher",
    allow_delegation=False
)

writer = Agent(
    role="Content Writer",
    goal="Create compelling content",
    backstory="Professional writer"
)

crew = Crew(
    agents=[manager, researcher, writer],
    tasks=[research_task, write_task, review_task],
    process=Process.hierarchical,
    manager_llm="gpt-4o",  # Required for hierarchical
    memory=True,
    verbose=True
)
```

---

## Agent Configuration (1.8+)

```python
from crewai import Agent

agent = Agent(
    # Core identity
    role="Senior Data Scientist",
    goal="Analyze data and provide insights",
    backstory="Expert with 10 years experience",

    # LLM configuration
    llm="gpt-4o",
    function_calling_llm="gpt-4o-mini",  # Cheaper model for tools
    use_system_prompt=True,

    # Execution control
    max_iter=20,
    max_rpm=100,
    max_execution_time=300,  # seconds
    max_retry_limit=2,

    # Advanced features (1.8+)
    reasoning=True,  # Enable reflection before tasks
    max_reasoning_attempts=3,
    multimodal=True,  # Text and visual processing
    inject_date=True,
    date_format="%Y-%m-%d",

    # Memory and context
    memory=True,
    respect_context_window=True,  # Auto-summarize on limit

    # Tools
    tools=[tool1, tool2],
    cache=True,

    # Delegation
    allow_delegation=True,
    verbose=True
)
```

---

## Task Configuration (1.8+)

### Structured Output

```python
from pydantic import BaseModel
from crewai import Task

class ReportOutput(BaseModel):
    title: str
    summary: str
    findings: list[str]
    confidence: float

task = Task(
    description="Analyze market trends and create report",
    expected_output="Structured market analysis report",
    agent=analyst,
    output_pydantic=ReportOutput  # Structured output
)

# Access structured result
result = crew.kickoff()
report = result.pydantic
print(report.title, report.confidence)
```

### Async Task Execution

```python
from crewai import Task

# Parallel research tasks
research_task1 = Task(
    description="Research topic A",
    expected_output="Research findings",
    agent=researcher,
    async_execution=True  # Non-blocking
)

research_task2 = Task(
    description="Research topic B",
    expected_output="Research findings",
    agent=researcher,
    async_execution=True
)

# Dependent task waits for async tasks
synthesis_task = Task(
    description="Synthesize all research",
    expected_output="Integrated analysis",
    agent=analyst,
    context=[research_task1, research_task2]  # Waits for completion
)
```

### Task Guardrails (Validation)

```python
from crewai import Task
from crewai.tasks import TaskOutput

def validate_length(result: TaskOutput) -> tuple[bool, any]:
    """Validate output meets requirements"""
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

# Multiple guardrails
task = Task(
    description="Generate report",
    expected_output="Validated report",
    agent=analyst,
    guardrails=[
        validate_length,
        validate_sources,
        "Content must be objective and data-driven"  # LLM-based
    ]
)
```

### Human Input Tasks

```python
task = Task(
    description="Review and approve recommendations",
    expected_output="Approved recommendations",
    agent=reviewer,
    human_input=True  # Pauses for human verification
)
```

### Task Callbacks

```python
from crewai.tasks import TaskOutput

def task_callback(output: TaskOutput):
    print(f"Task completed: {output.description}")
    print(f"Result: {output.raw[:100]}...")
    # Send notifications, log metrics, etc.

task = Task(
    description="Analyze data",
    expected_output="Analysis results",
    agent=analyst,
    callback=task_callback
)
```

---

## Async Execution

### Async Crew Kickoff

```python
import asyncio
from crewai import Crew

async def run_crews_parallel():
    crew1 = Crew(agents=[agent1], tasks=[task1])
    crew2 = Crew(agents=[agent2], tasks=[task2])

    # Run multiple crews in parallel
    results = await asyncio.gather(
        crew1.kickoff_async(),
        crew2.kickoff_async()
    )
    return results

# Execute
results = asyncio.run(run_crews_parallel())
```

### Async Flow Kickoff

```python
from crewai.flow.flow import Flow, start, listen

class AsyncFlow(Flow):
    @start()
    async def fetch_data(self):
        # Async operations supported
        data = await external_api.fetch()
        return data

    @listen(fetch_data)
    async def process_data(self, data):
        result = await process_async(data)
        return result

# Async execution
async def main():
    flow = AsyncFlow()
    result = await flow.kickoff_async()
    return result

asyncio.run(main())
```

---

## Streaming Output

```python
from crewai import Crew

# Enable streaming on crew
crew = Crew(
    agents=[agent1, agent2],
    tasks=[task1, task2],
    stream=True  # Enable real-time output
)

# Stream results
result = crew.kickoff()

# Flow streaming
flow = ExampleFlow()
flow.stream = True
streaming = flow.kickoff()

for chunk in streaming:
    print(chunk.content, end="", flush=True)

final_result = streaming.result
```

---

## Knowledge Sources (1.8+)

```python
from crewai import Agent, Crew
from crewai.knowledge.source.string_knowledge_source import StringKnowledgeSource
from crewai.knowledge.source.pdf_knowledge_source import PDFKnowledgeSource
from crewai.knowledge.source.crew_docling_source import CrewDoclingSource
from crewai.knowledge.knowledge_config import KnowledgeConfig

# String knowledge
company_info = StringKnowledgeSource(
    content="Company policies and guidelines..."
)

# PDF knowledge
docs = PDFKnowledgeSource(file_paths=["manual.pdf", "guide.pdf"])

# Web knowledge
web_source = CrewDoclingSource(
    file_paths=["https://example.com/docs"]
)

# Configure retrieval
config = KnowledgeConfig(
    results_limit=10,      # Documents returned (default: 3)
    score_threshold=0.5    # Relevance minimum (default: 0.35)
)

# Agent-level knowledge
agent = Agent(
    role="Support Agent",
    goal="Answer questions using company knowledge",
    backstory="Expert support representative",
    knowledge_sources=[company_info]
)

# Crew-level knowledge (all agents)
crew = Crew(
    agents=[agent1, agent2],
    tasks=[task1, task2],
    knowledge_sources=[docs, web_source]
)
```

---

## Memory Configuration

```python
from crewai import Crew
from crewai.memory import ShortTermMemory, LongTermMemory, EntityMemory

# Simple memory
crew = Crew(
    agents=[agent1, agent2],
    tasks=[task1, task2],
    memory=True  # Enable all memory types
)

# Custom memory configuration
crew = Crew(
    agents=[agent1, agent2],
    tasks=[task1, task2],
    short_term_memory=ShortTermMemory(),
    long_term_memory=LongTermMemory(
        storage=ChromaStorage(collection_name="crew_memory")
    ),
    entity_memory=EntityMemory()
)
```

---

## Custom Tools

```python
from crewai.tools import tool

@tool("Search Database")
def search_database(query: str) -> str:
    """Search the internal database for relevant information.

    Args:
        query: The search query string
    """
    results = db.search(query)
    return json.dumps(results)

# Async tool
@tool("Fetch API Data")
async def fetch_api_data(endpoint: str) -> str:
    """Fetch data from external API asynchronously.

    Args:
        endpoint: API endpoint to query
    """
    async with aiohttp.ClientSession() as session:
        async with session.get(endpoint) as response:
            return await response.text()

# Assign tools to agent
researcher = Agent(
    role="Researcher",
    goal="Find accurate information",
    backstory="Expert researcher",
    tools=[search_database, fetch_api_data],
    verbose=True
)
```

---

## Decorator-Based Crew Definition (Recommended)

```python
from crewai import Agent, Crew, Task, CrewBase, agent, task, crew

@CrewBase
class ResearchCrew:
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def researcher(self) -> Agent:
        return Agent(
            config=self.agents_config['researcher'],
            tools=[search_tool]
        )

    @agent
    def analyst(self) -> Agent:
        return Agent(config=self.agents_config['analyst'])

    @task
    def research_task(self) -> Task:
        return Task(config=self.tasks_config['research'])

    @task
    def analysis_task(self) -> Task:
        return Task(
            config=self.tasks_config['analysis'],
            context=[self.research_task()]
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,  # Auto-collected
            tasks=self.tasks,    # Auto-collected
            process=Process.sequential
        )

# Execute
result = ResearchCrew().crew().kickoff(inputs={"topic": "AI Safety"})
```

---

## Human-in-the-Loop (Flows)

```python
from crewai.flow.flow import Flow, listen, start
from crewai.flow.human_feedback import human_feedback, HumanFeedbackResult

class ReviewFlow(Flow):
    @start()
    @human_feedback(
        message="Do you approve this content?",
        emit=["approved", "rejected"],
        llm="gpt-4o-mini"
    )
    def generate_content(self):
        return "Content for human review..."

    @listen("approved")
    def handle_approval(self, result: HumanFeedbackResult):
        print(f"Approved with feedback: {result.feedback}")
        return "Processing approved content"

    @listen("rejected")
    def handle_rejection(self, result: HumanFeedbackResult):
        print(f"Rejected: {result.feedback}")
        return "Revising content"
```

---

## Configuration Summary

| Feature | Parameter | Default |
|---------|-----------|---------|
| Process types | `process` | `sequential`, `hierarchical` |
| Manager LLM | `manager_llm` | Required for hierarchical |
| Memory | `memory` | `False` |
| Streaming | `stream` | `False` |
| Verbose | `verbose` | `False` |
| Max RPM | `max_rpm` | Unlimited |
| Planning | `planning` | `False` |

---

## Best Practices

1. **Use Flows for complex workflows**: Multi-step processes benefit from Flows architecture
2. **Prefer decorator-based definition**: Use `@CrewBase` for maintainable crew definitions
3. **Leverage MCP for external tools**: Use the simple DSL for quick MCP integration
4. **Enable structured outputs**: Use `output_pydantic` for type-safe results
5. **Add guardrails**: Validate outputs with function or LLM-based guardrails
6. **Use async for parallel work**: `async_execution=True` for independent tasks
7. **Configure knowledge sources**: Add crew/agent-level knowledge for context
8. **Role clarity**: Each agent has distinct, non-overlapping role
9. **Task granularity**: One clear deliverable per task
10. **Memory scope**: Use short-term for session, long-term for persistent knowledge

---

## Migration from 0.x

| 0.x Pattern | 1.8+ Pattern |
|-------------|--------------|
| Manual agent/task lists | `@CrewBase` with `@agent`, `@task` decorators |
| Synchronous only | Async support with `kickoff_async()` |
| No streaming | `stream=True` parameter |
| Basic tools | MCP integration with `mcps` parameter |
| No validation | Task guardrails |
| No flow control | Flows with `@start`, `@listen`, `@router` |
