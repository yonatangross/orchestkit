"""
Production-ready CrewAI hierarchical crew template.

Features:
- Manager-led hierarchical process
- Specialized role-based agents
- Task dependencies and context sharing
- Memory for knowledge retention
- Custom tools integration
- Error handling and retries
"""

import json
import os
from typing import Any

import structlog
from crewai import Agent, Crew, Process, Task
from crewai.tools import tool
from langfuse.decorators import langfuse_context, observe

logger = structlog.get_logger()


# ============================================================================
# CUSTOM TOOLS
# ============================================================================

@tool("Search Database")
def search_database(query: str) -> str:
    """Search the internal database for relevant information.

    Args:
        query: The search query string to find relevant documents
    """
    # Replace with actual database search
    logger.info("Searching database", query=query)
    results = [
        {"title": "Result 1", "content": "Sample content for query"},
        {"title": "Result 2", "content": "More relevant information"},
    ]
    return json.dumps(results)


@tool("Analyze Data")
def analyze_data(data: str, analysis_type: str) -> str:
    """Analyze data with specified analysis type.

    Args:
        data: The data to analyze (JSON string)
        analysis_type: Type of analysis (summary, trends, insights)
    """
    logger.info("Analyzing data", analysis_type=analysis_type)
    # Replace with actual analysis logic
    return json.dumps({
        "analysis_type": analysis_type,
        "findings": ["Finding 1", "Finding 2"],
        "confidence": 0.85
    })


@tool("Generate Report")
def generate_report(title: str, sections: str) -> str:
    """Generate a formatted report.

    Args:
        title: Report title
        sections: JSON array of section objects with title and content
    """
    logger.info("Generating report", title=title)
    sections_data = json.loads(sections)
    report = f"# {title}\n\n"
    for section in sections_data:
        report += f"## {section['title']}\n{section['content']}\n\n"
    return report


# ============================================================================
# AGENT DEFINITIONS
# ============================================================================

def create_manager_agent() -> Agent:
    """Create the project manager agent that coordinates the team."""
    return Agent(
        role="Project Manager",
        goal="Coordinate team efforts to deliver high-quality research reports",
        backstory="""You are an experienced project manager with 10+ years
        leading research teams. You excel at breaking down complex projects
        into manageable tasks, delegating effectively, and ensuring quality
        deliverables. You know when to delegate and when to provide guidance.""",
        allow_delegation=True,
        memory=True,
        verbose=True,
        max_iter=15,  # Maximum iterations for task completion
        max_retry_limit=2  # Retries on failure
    )


def create_researcher_agent() -> Agent:
    """Create the researcher agent for data gathering."""
    return Agent(
        role="Senior Researcher",
        goal="Gather comprehensive and accurate research data",
        backstory="""You are a meticulous researcher with expertise in
        finding and synthesizing information from multiple sources. You
        verify facts and provide well-structured research outputs.""",
        allow_delegation=False,
        memory=True,
        verbose=True,
        tools=[search_database],
        max_iter=10
    )


def create_analyst_agent() -> Agent:
    """Create the analyst agent for data analysis."""
    return Agent(
        role="Data Analyst",
        goal="Analyze research data and extract actionable insights",
        backstory="""You are a skilled data analyst who transforms raw
        research into meaningful insights. You identify trends, patterns,
        and provide data-driven recommendations.""",
        allow_delegation=False,
        memory=True,
        verbose=True,
        tools=[analyze_data],
        max_iter=10
    )


def create_writer_agent() -> Agent:
    """Create the writer agent for report generation."""
    return Agent(
        role="Technical Writer",
        goal="Create clear, compelling, and well-structured reports",
        backstory="""You are an expert technical writer who transforms
        complex information into accessible, professional documents.
        You ensure clarity, proper formatting, and engaging narratives.""",
        allow_delegation=False,
        memory=True,
        verbose=True,
        tools=[generate_report],
        max_iter=10
    )


# ============================================================================
# TASK DEFINITIONS
# ============================================================================

def create_research_task(researcher: Agent, topic: str) -> Task:
    """Create the research gathering task."""
    return Task(
        description=f"""Research the following topic thoroughly: {topic}

        Your research should cover:
        1. Current state and key players
        2. Recent developments and trends
        3. Challenges and opportunities
        4. Future outlook

        Use the search_database tool to gather information.
        Provide well-organized findings with sources.""",
        expected_output="""A comprehensive research document with:
        - Executive summary
        - Key findings organized by theme
        - Supporting data and sources
        - Initial observations""",
        agent=researcher
    )


def create_analysis_task(analyst: Agent, research_task: Task) -> Task:
    """Create the analysis task with dependency on research."""
    return Task(
        description="""Analyze the research findings and extract insights.

        Your analysis should:
        1. Identify key trends and patterns
        2. Highlight opportunities and risks
        3. Provide data-driven recommendations
        4. Quantify findings where possible

        Use the analyze_data tool for structured analysis.""",
        expected_output="""An analysis report with:
        - Trend analysis
        - SWOT summary
        - Top 3-5 recommendations
        - Confidence scores for findings""",
        agent=analyst,
        context=[research_task]  # Receives research output
    )


def create_report_task(writer: Agent, analysis_task: Task, topic: str) -> Task:
    """Create the final report writing task."""
    return Task(
        description=f"""Create a professional report on: {topic}

        The report should:
        1. Start with an executive summary
        2. Present findings clearly with data visualization descriptions
        3. Include actionable recommendations
        4. End with next steps and timeline

        Use the generate_report tool for proper formatting.""",
        expected_output="""A polished report with:
        - Executive summary (1 page)
        - Detailed findings (3-5 pages)
        - Recommendations with priorities
        - Appendix with supporting data""",
        agent=writer,
        context=[analysis_task]  # Receives analysis output
    )


# ============================================================================
# CREW ASSEMBLY
# ============================================================================

@observe()
def create_research_crew(topic: str) -> tuple[Crew, list[Task]]:
    """Assemble the research crew with hierarchical process."""

    # Create agents
    manager = create_manager_agent()
    researcher = create_researcher_agent()
    analyst = create_analyst_agent()
    writer = create_writer_agent()

    # Create tasks with dependencies
    research_task = create_research_task(researcher, topic)
    analysis_task = create_analysis_task(analyst, research_task)
    report_task = create_report_task(writer, analysis_task, topic)

    tasks = [research_task, analysis_task, report_task]

    # Assemble crew
    crew = Crew(
        agents=[manager, researcher, analyst, writer],
        tasks=tasks,
        process=Process.hierarchical,
        manager_llm="gpt-5.2",  # Manager uses GPT-5.2 for coordination
        memory=True,  # Enable shared memory
        verbose=True,
        max_rpm=20,  # Rate limit API calls
        share_crew=False  # Don't share crew state between runs
    )

    return crew, tasks


# ============================================================================
# EXECUTION
# ============================================================================

@observe()
def run_research_crew(topic: str) -> dict[str, Any]:
    """Execute the research crew on a topic.

    Args:
        topic: The research topic to investigate

    Returns:
        Dictionary with crew results and metadata
    """
    langfuse_context.update_current_trace(
        name="crewai_research",
        metadata={"topic": topic}
    )

    logger.info("Starting research crew", topic=topic)

    try:
        crew, tasks = create_research_crew(topic)

        # Execute crew
        result = crew.kickoff()

        # Collect task outputs
        task_outputs = {}
        for task in tasks:
            task_outputs[task.agent.role] = task.output.raw if task.output else None

        logger.info(
            "Research crew completed",
            topic=topic,
            tasks_completed=len(tasks)
        )

        langfuse_context.update_current_observation(
            output={"status": "success", "tasks_completed": len(tasks)},
            metadata={"topic": topic}
        )

        return {
            "status": "success",
            "topic": topic,
            "final_report": result.raw if hasattr(result, 'raw') else str(result),
            "task_outputs": task_outputs,
            "tokens_used": result.token_usage if hasattr(result, 'token_usage') else None
        }

    except Exception as e:
        logger.error("Research crew failed", topic=topic, error=str(e))

        langfuse_context.update_current_observation(
            output={"status": "error", "error": str(e)},
            level="error"
        )

        return {
            "status": "error",
            "topic": topic,
            "error": str(e)
        }


# ============================================================================
# ASYNC EXECUTION (Alternative)
# ============================================================================

@observe()
async def run_research_crew_async(topic: str) -> dict[str, Any]:
    """Execute the research crew asynchronously.

    Args:
        topic: The research topic to investigate

    Returns:
        Dictionary with crew results and metadata
    """
    logger.info("Starting async research crew", topic=topic)

    try:
        crew, tasks = create_research_crew(topic)

        # Async execution
        result = await crew.kickoff_async()

        return {
            "status": "success",
            "topic": topic,
            "final_report": result.raw if hasattr(result, 'raw') else str(result)
        }

    except Exception as e:
        logger.error("Async research crew failed", error=str(e))
        return {
            "status": "error",
            "topic": topic,
            "error": str(e)
        }


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

if __name__ == "__main__":
    # Example: Run research on AI assistants
    topic = "AI-powered code assistants and their impact on developer productivity"

    result = run_research_crew(topic)

    if result["status"] == "success":
        print("=" * 60)
        print("FINAL REPORT")
        print("=" * 60)
        print(result["final_report"])
    else:
        print(f"Error: {result['error']}")
