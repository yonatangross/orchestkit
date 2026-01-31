"""
OrchestKit-style content analysis workflow template.

8-agent pipeline with supervisor coordination, quality gate, and compression.

Architecture:
    Content → Supervisor → 8 Specialist Agents → Quality Gate → Compress → Artifact
"""

from operator import add
from typing import Annotated, Literal, TypedDict

import structlog
from langfuse.decorators import langfuse_context, observe
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

logger = structlog.get_logger()


# ============================================================================
# DOMAIN MODELS
# ============================================================================

class Finding(BaseModel):
    """A finding from an analysis agent."""
    agent: str = Field(description="Agent that produced this finding")
    category: str = Field(description="Category (security, performance, etc.)")
    content: str = Field(description="Finding content")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score")
    metadata: dict = Field(default_factory=dict)


class AnalysisState(TypedDict):
    """State for content analysis workflow."""

    # === Input (immutable) ===
    analysis_id: str
    url: str
    raw_content: str

    # === Agent Outputs (accumulating) ===
    findings: Annotated[list[Finding], add]

    # === Control Flow ===
    current_agent: str
    agents_completed: list[str]
    next_node: str

    # === Quality Control ===
    quality_score: float
    quality_passed: bool
    retry_count: int

    # === Final Output ===
    compressed_summary: str
    artifact_data: dict


# ============================================================================
# AGENT DEFINITIONS
# ============================================================================

AgentName = Literal[
    "security_agent",
    "tech_comparator",
    "implementation_planner",
    "tutorial_analyzer",
    "depth_analyzer",
    "prerequisites_extractor",
    "best_practices",
    "code_examples"
]

ALL_AGENTS: list[AgentName] = [
    "security_agent",
    "tech_comparator",
    "implementation_planner",
    "tutorial_analyzer",
    "depth_analyzer",
    "prerequisites_extractor",
    "best_practices",
    "code_examples"
]


# ============================================================================
# AGENT NODES (8 Specialist Agents)
# ============================================================================

def create_agent_node(agent_name: AgentName):
    """Factory to create agent nodes with consistent error handling."""

    @observe(name=agent_name)
    def agent_node(state: AnalysisState) -> AnalysisState:
        logger.info(
            f"{agent_name} started",
            analysis_id=state["analysis_id"],
            agent=agent_name
        )

        try:
            # Call agent-specific analysis function
            findings = analyze_with_agent(agent_name, state["raw_content"])

            langfuse_context.update_current_observation(
                output={"findings_count": len(findings)},
                metadata={"agent": agent_name}
            )

            return {
                "findings": findings,
                "agents_completed": state["agents_completed"] + [agent_name]
            }

        except Exception as e:
            logger.error(
                f"{agent_name} failed",
                error=str(e),
                analysis_id=state["analysis_id"]
            )
            # Return empty findings, mark as completed anyway
            return {
                "findings": [],
                "agents_completed": state["agents_completed"] + [agent_name]
            }

    return agent_node


# ============================================================================
# SUPERVISOR NODE
# ============================================================================

@observe()
def supervisor_node(state: AnalysisState) -> AnalysisState:
    """Route to next agent or quality gate."""

    completed = set(state["agents_completed"])
    available = [a for a in ALL_AGENTS if a not in completed]

    if not available:
        # All agents finished → quality gate
        logger.info(
            "All agents completed, routing to quality gate",
            analysis_id=state["analysis_id"],
            total_findings=len(state["findings"])
        )
        state["next_node"] = "quality_gate"
    else:
        # Route to next agent (round-robin)
        next_agent = available[0]
        logger.info(
            "Routing to next agent",
            analysis_id=state["analysis_id"],
            agent=next_agent,
            remaining=len(available) - 1
        )
        state["next_node"] = next_agent

    langfuse_context.update_current_observation(
        output={"next": state["next_node"]},
        metadata={
            "completed": len(completed),
            "remaining": len(available)
        }
    )

    return state


# ============================================================================
# QUALITY GATE NODE
# ============================================================================

@observe()
def quality_gate_node(state: AnalysisState) -> AnalysisState:
    """Evaluate analysis quality."""

    logger.info(
        "Quality gate evaluation",
        analysis_id=state["analysis_id"],
        findings_count=len(state["findings"])
    )

    # Calculate quality score
    quality_score = calculate_quality_score(state["findings"])
    state["quality_score"] = quality_score

    # Quality threshold
    QUALITY_THRESHOLD = 0.7

    if quality_score >= QUALITY_THRESHOLD:
        logger.info(
            "Quality gate passed",
            analysis_id=state["analysis_id"],
            score=quality_score
        )
        state["quality_passed"] = True
        state["next_node"] = "compress_findings"
    else:
        logger.warning(
            "Quality gate failed",
            analysis_id=state["analysis_id"],
            score=quality_score,
            threshold=QUALITY_THRESHOLD
        )
        state["quality_passed"] = False
        # Could route back to supervisor for more agents or END
        state["next_node"] = END

    langfuse_context.update_current_observation(
        output={"passed": state["quality_passed"], "score": quality_score},
        metadata={"threshold": QUALITY_THRESHOLD}
    )

    return state


def route_after_quality_gate(state: AnalysisState) -> str:
    """Route based on quality gate result."""
    if state["quality_passed"]:
        return "compress_findings"
    elif state["retry_count"] < 2:
        # Retry with more agents (if needed)
        state["retry_count"] += 1
        return "supervisor"
    else:
        # Give up, return partial results
        return END


# ============================================================================
# COMPRESSION NODE
# ============================================================================

@observe()
def compress_findings_node(state: AnalysisState) -> AnalysisState:
    """Compress findings into summary."""

    logger.info(
        "Compressing findings",
        analysis_id=state["analysis_id"],
        findings_count=len(state["findings"])
    )

    # Compress findings into a summary
    summary = compress_findings(state["findings"])
    state["compressed_summary"] = summary

    # Build artifact
    artifact = {
        "summary": summary,
        "findings_count": len(state["findings"]),
        "agents_used": state["agents_completed"],
        "quality_score": state["quality_score"]
    }
    state["artifact_data"] = artifact

    logger.info(
        "Compression complete",
        analysis_id=state["analysis_id"],
        summary_length=len(summary)
    )

    langfuse_context.update_current_observation(
        output=artifact,
        metadata={"summary_length": len(summary)}
    )

    state["next_node"] = END
    return state


# ============================================================================
# WORKFLOW CONSTRUCTION
# ============================================================================

def create_analysis_workflow(database_url: str) -> StateGraph:
    """Build content analysis workflow."""

    # Create checkpointer
    checkpointer = PostgresSaver.from_conn_string(database_url)

    # Build graph
    workflow = StateGraph(AnalysisState)

    # Add supervisor
    workflow.add_node("supervisor", supervisor_node)

    # Add 8 specialist agents
    for agent_name in ALL_AGENTS:
        agent_fn = create_agent_node(agent_name)
        workflow.add_node(agent_name, agent_fn)
        # Agents return to supervisor
        workflow.add_edge(agent_name, "supervisor")

    # Add quality gate
    workflow.add_node("quality_gate", quality_gate_node)

    # Add compressor
    workflow.add_node("compress_findings", compress_findings_node)

    # Supervisor routes dynamically
    workflow.add_conditional_edges(
        "supervisor",
        lambda s: s["next_node"],
        {
            **{agent: agent for agent in ALL_AGENTS},
            "quality_gate": "quality_gate"
        }
    )

    # Quality gate routes conditionally
    workflow.add_conditional_edges(
        "quality_gate",
        route_after_quality_gate,
        {
            "compress_findings": "compress_findings",
            "supervisor": "supervisor",
            END: END
        }
    )

    # Compress routes to END
    workflow.add_edge("compress_findings", END)

    # Set entry point
    workflow.set_entry_point("supervisor")

    # Compile with checkpointing
    app = workflow.compile(
        checkpointer=checkpointer,
        interrupt_before=["quality_gate"]  # Optional: manual review
    )

    return app


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

@observe()
def run_content_analysis(
    url: str,
    raw_content: str,
    analysis_id: str,
    database_url: str
):
    """Run content analysis workflow."""

    langfuse_context.update_current_trace(
        name="content_analysis",
        metadata={
            "analysis_id": analysis_id,
            "url": url,
            "content_length": len(raw_content)
        }
    )

    app = create_analysis_workflow(database_url)

    initial_state = AnalysisState(
        analysis_id=analysis_id,
        url=url,
        raw_content=raw_content,
        findings=[],
        current_agent="",
        agents_completed=[],
        next_node="supervisor",
        quality_score=0.0,
        quality_passed=False,
        retry_count=0,
        compressed_summary="",
        artifact_data={}
    )

    config = {"configurable": {"thread_id": analysis_id}}

    try:
        result = app.invoke(initial_state, config=config)

        langfuse_context.update_current_observation(
            output=result["artifact_data"],
            metadata={
                "agents_completed": len(result["agents_completed"]),
                "quality_passed": result["quality_passed"]
            }
        )

        return result

    except Exception as e:
        logger.error(
            "Analysis workflow failed",
            error=str(e),
            analysis_id=analysis_id
        )

        # Try to resume from checkpoint
        logger.info("Attempting to resume from checkpoint")
        result = app.invoke(None, config=config)
        return result


# ============================================================================
# PLACEHOLDER ANALYSIS FUNCTIONS (Replace with real implementations)
# ============================================================================

def analyze_with_agent(agent_name: str, content: str) -> list[Finding]:
    """Placeholder for agent-specific analysis."""
    # In real implementation, this would call your LLM agent
    return [
        Finding(
            agent=agent_name,
            category=agent_name.replace("_", " ").title(),
            content=f"Findings from {agent_name}",
            confidence=0.85,
            metadata={}
        )
    ]


def calculate_quality_score(findings: list[Finding]) -> float:
    """Calculate quality score from findings."""
    if not findings:
        return 0.0

    # Simple average of confidence scores
    avg_confidence = sum(f.confidence for f in findings) / len(findings)

    # Penalize if too few findings
    finding_penalty = min(len(findings) / 20.0, 1.0)  # Expect ~20 findings

    return avg_confidence * finding_penalty


def compress_findings(findings: list[Finding]) -> str:
    """Compress findings into a summary."""
    # In real implementation, use LLM to summarize
    categories = {}
    for finding in findings:
        if finding.category not in categories:
            categories[finding.category] = []
        categories[finding.category].append(finding.content)

    summary = []
    for category, contents in categories.items():
        summary.append(f"**{category}**: {len(contents)} findings")

    return "\n".join(summary)


if __name__ == "__main__":
    # Test the workflow
    result = run_content_analysis(
        url="https://example.com/article",
        raw_content="Sample content to analyze...",
        analysis_id="test-456",
        database_url="postgresql://localhost:5432/test"
    )
    print(f"Analysis completed: {result['quality_passed']}")
    print(f"Agents used: {len(result['agents_completed'])}")
    print(f"Summary: {result['compressed_summary']}")
