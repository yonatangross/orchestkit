"""
Parallel Agent Fan-Out Template for LangGraph

Implements dynamic fan-out/fan-in with proper completion tracking.
Uses LangGraph's Send() API for parallel execution.

Usage:
    graph = build_parallel_analysis_graph()
    result = await graph.ainvoke({"content": "...", "url": "..."})
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, Send, StateGraph

logger = logging.getLogger(__name__)


# Custom reducer for counting completions
def add_counts(a: int, b: int) -> int:
    """Reducer for completion counting."""
    return a + b


def merge_lists(a: list, b: list) -> list:
    """Reducer for merging lists."""
    return a + b


# State definitions
class Finding(TypedDict):
    """Individual finding from an agent."""
    agent_type: str
    category: str
    content: str
    confidence: float


class AnalysisState(TypedDict):
    """Main workflow state with fan-in tracking."""
    # Input
    url: str
    raw_content: str
    title: str | None

    # Fan-out tracking (set by supervisor)
    expected_agent_count: int
    agents_to_run: list[str]

    # Fan-in tracking (updated by agents)
    completed_agent_count: Annotated[int, add_counts]
    successful_agents: Annotated[list[str], merge_lists]
    failed_agents: Annotated[list[str], merge_lists]
    skipped_agents: Annotated[list[str], merge_lists]

    # Agent outputs
    findings: Annotated[list[Finding], merge_lists]

    # Workflow control
    current_phase: str
    synthesis_result: str | None
    error: str | None


class AgentState(TypedDict):
    """State passed to individual agent execution."""
    agent_type: str
    content: str
    context: str | None


@dataclass
class AgentResult:
    """Result from agent execution."""
    agent_type: str
    findings: list[Finding]
    success: bool
    error: str | None = None


# Agent registry (customize with your agents)
AVAILABLE_AGENTS = [
    "security_auditor",
    "implementation_planner",
    "tech_comparator",
    "learning_synthesizer",
    "prerequisite_mapper",
    "codebase_analyzer",
    "practical_applicator",
    "complexity_assessor",
]


async def run_agent(agent_type: str, content: str) -> AgentResult:
    """
    Execute a single agent.

    Replace this with your actual agent implementation.
    """
    # Simulate agent work
    await asyncio.sleep(0.1)

    # Mock finding
    finding = Finding(
        agent_type=agent_type,
        category="analysis",
        content=f"Analysis from {agent_type}",
        confidence=0.85,
    )

    return AgentResult(
        agent_type=agent_type,
        findings=[finding],
        success=True,
    )


# Node implementations
async def supervisor_node(state: AnalysisState) -> dict[str, Any]:
    """
    Supervisor: select agents and prepare fan-out.

    This node:
    1. Selects relevant agents (use SemanticRouter in production)
    2. Sets expected_agent_count for fan-in validation
    3. Returns agents_to_run for routing
    """
    logger.info("Supervisor selecting agents")

    # In production, use SemanticRouter here
    # selected = await semantic_router.route(state["raw_content"])
    selected = ["security_auditor", "implementation_planner", "tech_comparator"]

    logger.info(f"Selected {len(selected)} agents: {selected}")

    return {
        "expected_agent_count": len(selected),
        "agents_to_run": selected,
        "current_phase": "parallel_analysis",
    }


def route_to_agents(state: AnalysisState) -> list[Send]:
    """
    Router: fan-out to selected agents using Send() API.

    Returns list of Send() commands for parallel execution.
    """
    agents = state.get("agents_to_run", [])

    sends = [
        Send(
            agent_type,
            {
                "agent_type": agent_type,
                "content": state["raw_content"],
                "context": state.get("title"),
            },
        )
        for agent_type in agents
    ]

    logger.info(f"Routing to {len(sends)} agents in parallel")
    return sends


async def agent_node(state: AgentState) -> dict[str, Any]:
    """
    Generic agent node: executes agent and returns results.

    Each agent:
    1. Runs its analysis
    2. Increments completed_agent_count (always, even on failure)
    3. Reports success/failure
    """
    agent_type = state["agent_type"]
    logger.info(f"Agent {agent_type} starting")

    try:
        result = await run_agent(agent_type, state["content"])

        if result.success:
            return {
                "findings": result.findings,
                "completed_agent_count": 1,
                "successful_agents": [agent_type],
            }
        else:
            return {
                "completed_agent_count": 1,
                "failed_agents": [agent_type],
            }

    except Exception as e:
        logger.error(f"Agent {agent_type} failed: {e}")
        return {
            "completed_agent_count": 1,
            "failed_agents": [agent_type],
        }


async def aggregate_node(state: AnalysisState) -> dict[str, Any]:
    """
    Aggregate: fan-in validation and logging.

    This node:
    1. Validates all expected agents completed
    2. Logs completion status
    3. Prepares for synthesis
    """
    expected = state.get("expected_agent_count", 0)
    completed = state.get("completed_agent_count", 0)
    successful = state.get("successful_agents", [])
    failed = state.get("failed_agents", [])

    logger.info(
        f"Fan-in complete: {completed}/{expected} agents "
        f"({len(successful)} success, {len(failed)} failed)"
    )

    # Validation
    if completed < expected:
        logger.warning(f"Missing agent results: expected {expected}, got {completed}")

    return {
        "current_phase": "synthesis",
    }


async def synthesis_node(state: AnalysisState) -> dict[str, Any]:
    """
    Synthesis: combine findings into coherent output.
    """
    findings = state.get("findings", [])

    logger.info(f"Synthesizing {len(findings)} findings")

    # In production, use LLM to synthesize
    synthesis = f"Synthesis of {len(findings)} findings from agents"

    return {
        "synthesis_result": synthesis,
        "current_phase": "complete",
    }


def build_parallel_analysis_graph() -> StateGraph:
    """
    Build the parallel analysis graph.

    Structure:
        supervisor -> [agent1, agent2, ...] -> aggregate -> synthesis
    """
    workflow = StateGraph(AnalysisState)

    # Add supervisor
    workflow.add_node("supervisor", supervisor_node)

    # Add all possible agent nodes
    for agent_type in AVAILABLE_AGENTS:
        workflow.add_node(agent_type, agent_node)
        # All agents converge to aggregate
        workflow.add_edge(agent_type, "aggregate")

    # Add aggregate and synthesis
    workflow.add_node("aggregate", aggregate_node)
    workflow.add_node("synthesis", synthesis_node)

    # Define flow
    workflow.set_entry_point("supervisor")

    # Supervisor fans out using conditional edges
    workflow.add_conditional_edges(
        "supervisor",
        route_to_agents,
    )

    # Aggregate to synthesis
    workflow.add_edge("aggregate", "synthesis")

    # Synthesis to end
    workflow.add_edge("synthesis", END)

    return workflow.compile()


class ParallelAnalysisRunner:
    """
    Runner for parallel analysis with timeout safety.
    """

    def __init__(
        self,
        graph: StateGraph,
        timeout: float = 300.0,
    ):
        self.graph = graph
        self.timeout = timeout

    async def run(
        self,
        url: str,
        content: str,
        title: str | None = None,
    ) -> AnalysisState:
        """Run analysis with timeout."""

        initial_state: AnalysisState = {
            "url": url,
            "raw_content": content,
            "title": title,
            "expected_agent_count": 0,
            "agents_to_run": [],
            "completed_agent_count": 0,
            "successful_agents": [],
            "failed_agents": [],
            "skipped_agents": [],
            "findings": [],
            "current_phase": "starting",
            "synthesis_result": None,
            "error": None,
        }

        try:
            result = await asyncio.wait_for(
                self.graph.ainvoke(initial_state),
                timeout=self.timeout,
            )
            return result

        except TimeoutError:
            logger.error(f"Analysis timed out after {self.timeout}s")
            initial_state["error"] = f"Timeout after {self.timeout}s"
            initial_state["current_phase"] = "timeout"
            return initial_state


# Example usage
if __name__ == "__main__":

    async def main():
        # Build graph
        graph = build_parallel_analysis_graph()

        # Create runner
        runner = ParallelAnalysisRunner(graph, timeout=60.0)

        # Run analysis
        result = await runner.run(
            url="https://example.com/tutorial",
            content="This is a tutorial about OAuth 2.0 authentication...",
            title="OAuth Tutorial",
        )

        # Print results
        print(f"Phase: {result['current_phase']}")
        print(f"Expected: {result['expected_agent_count']}")
        print(f"Completed: {result['completed_agent_count']}")
        print(f"Successful: {result['successful_agents']}")
        print(f"Failed: {result['failed_agents']}")
        print(f"Findings: {len(result['findings'])}")
        print(f"Synthesis: {result['synthesis_result']}")

    asyncio.run(main())
