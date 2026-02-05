# OrchestKit Content Analysis Workflow

> **Note:** This is a **reference architecture** demonstrating production LangGraph patterns.
> The code examples are illustrative templates, not deployed code in this repository.
> Use these patterns as blueprints for building your own workflows.

## Overview

This reference architecture shows a production LangGraph pipeline that coordinates 8 specialist agents to analyze technical content (URLs, documents, repositories).

**Architecture:**
```
User Content
    ↓
[Supervisor] → Routes to 8 specialist agents (round-robin)
    ↓
[Security Agent]  ──┐
[Tech Comparator] ──┤
[Implementation]  ──┤
[Tutorial]        ──┼→ [Supervisor] → [Quality Gate]
[Depth Analyzer]  ──┤                        ↓
[Prerequisites]   ──┤                   Pass: Compress
[Best Practices]  ──┤                   Fail: Retry or END
[Code Examples]   ──┘                        ↓
                                        [Artifact Storage]
```

---

## Recommended File Structure

This is the suggested project structure for implementing this architecture:

```
your_project/
├── app/
│   ├── workflows/
│   │   ├── content_analysis_workflow.py     # Main workflow
│   │   ├── state.py                         # State schema
│   │   ├── checkpoints.py                   # PostgreSQL checkpointer
│   │   └── nodes/
│   │       ├── supervisor_node.py           # Routing logic
│   │       ├── quality_gate_node.py         # Quality assessment
│   │       ├── compress_findings_node.py    # Summarization
│   │       └── agents/
│   │           ├── security_agent.py        # 8 specialist agents
│   │           ├── tech_comparator.py
│   │           ├── implementation_planner.py
│   │           ├── tutorial_analyzer.py
│   │           ├── depth_analyzer.py
│   │           ├── prerequisites_extractor.py
│   │           ├── best_practices.py
│   │           └── code_examples.py
│   └── api/
│       └── v1/
│           └── analysis.py                  # API endpoint
```

---

## State Schema

```python
# backend/app/workflows/state.py
from typing import TypedDict, Annotated
from operator import add
from pydantic import BaseModel, Field

class Finding(BaseModel):
    """A finding from an analysis agent."""
    agent: str = Field(description="Agent that produced this finding")
    category: str = Field(description="security, performance, tutorial, etc.")
    content: str = Field(description="Finding content")
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)

class AnalysisState(TypedDict):
    """State for content analysis workflow."""

    # === Input (immutable) ===
    analysis_id: str
    url: str
    raw_content: str
    content_type: str  # "article", "tutorial", "documentation"

    # === Agent Outputs (accumulating) ===
    findings: Annotated[list[Finding], add]
    embeddings: Annotated[list[dict], add]

    # === Control Flow ===
    current_agent: str
    agents_completed: list[str]
    next_node: str

    # === Quality Control ===
    quality_score: float
    quality_passed: bool
    retry_count: int
    quality_details: dict

    # === Final Output ===
    compressed_summary: str
    artifact_id: str
    artifact_data: dict

    # === Metadata ===
    started_at: str  # ISO timestamp
    total_tokens: int
    total_cost: float
```

---

## Supervisor Node

```python
# backend/app/workflows/nodes/supervisor_node.py
from langfuse.decorators import observe, langfuse_context
import structlog

logger = structlog.get_logger()

ALL_AGENTS = [
    "security_agent",
    "tech_comparator",
    "implementation_planner",
    "tutorial_analyzer",
    "depth_analyzer",
    "prerequisites_extractor",
    "best_practices",
    "code_examples"
]

@observe()
def supervisor_node(state: AnalysisState) -> AnalysisState:
    """Route to next available agent or quality gate."""

    completed = set(state["agents_completed"])
    available = [a for a in ALL_AGENTS if a not in completed]

    if not available:
        # All agents finished → quality gate
        logger.info(
            "All agents completed",
            analysis_id=state["analysis_id"],
            total_findings=len(state["findings"])
        )
        state["next_node"] = "quality_gate"
    else:
        # Round-robin routing
        next_agent = available[0]
        logger.info(
            "Routing to agent",
            analysis_id=state["analysis_id"],
            agent=next_agent,
            remaining=len(available) - 1
        )
        state["next_node"] = next_agent

    langfuse_context.update_current_observation(
        output={"next": state["next_node"]},
        metadata={
            "completed_count": len(completed),
            "remaining_count": len(available)
        }
    )

    return state
```

---

## Specialist Agent Example

```python
# backend/app/workflows/nodes/agents/security_agent.py
from langfuse.decorators import observe, langfuse_context
from anthropic import Anthropic
import structlog

logger = structlog.get_logger()
anthropic = Anthropic()

SECURITY_AGENT_PROMPT = """
Analyze the following technical content for security considerations:

Content:
{content}

Identify:
1. Security vulnerabilities mentioned or implied
2. Authentication/authorization patterns
3. Data protection practices
4. Common security pitfalls
5. Security best practices

Provide findings in this format:
- Category: [vulnerability/auth/data/pitfall/practice]
- Content: [detailed finding]
- Confidence: [0.0-1.0]
- Evidence: [quotes from content]
"""

@observe()
def security_agent_node(state: AnalysisState) -> AnalysisState:
    """Analyze security aspects of content."""

    logger.info("security_agent started", analysis_id=state["analysis_id"])

    try:
        # Call Claude with prompt caching
        response = anthropic.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2000,
            system=[
                {
                    "type": "text",
                    "text": "You are a security expert analyzing technical content.",
                    "cache_control": {"type": "ephemeral"}  # Cache system prompt
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": SECURITY_AGENT_PROMPT.format(
                        content=state["raw_content"][:5000]  # First 5k chars
                    )
                }
            ]
        )

        # Parse findings from response
        findings = parse_security_findings(
            response.content[0].text,
            agent="security_agent"
        )

        # Track usage
        state["total_tokens"] += response.usage.input_tokens + response.usage.output_tokens

        langfuse_context.update_current_observation(
            output={"findings_count": len(findings)},
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            },
            metadata={"agent": "security"}
        )

        return {
            "findings": findings,
            "agents_completed": state["agents_completed"] + ["security_agent"],
            "total_tokens": state["total_tokens"]
        }

    except Exception as e:
        logger.error("security_agent failed", error=str(e))
        return {
            "findings": [],
            "agents_completed": state["agents_completed"] + ["security_agent"]
        }
```

---

## Quality Gate

```python
# backend/app/workflows/nodes/quality_gate_node.py
from app.shared.services.g_eval import GEvalScorer
from langfuse.decorators import observe, langfuse_context

scorer = GEvalScorer()

@observe()
def quality_gate_node(state: AnalysisState) -> AnalysisState:
    """Evaluate analysis quality using G-Eval."""

    findings = state["findings"]

    # Calculate quality metrics
    depth_score = scorer.score_depth(findings)
    coverage_score = scorer.score_coverage(findings, expected_categories=8)
    confidence_score = sum(f.confidence for f in findings) / len(findings)

    # Weighted average
    quality_score = (
        depth_score * 0.4 +
        coverage_score * 0.4 +
        confidence_score * 0.2
    )

    state["quality_score"] = quality_score
    state["quality_details"] = {
        "depth": depth_score,
        "coverage": coverage_score,
        "confidence": confidence_score
    }

    QUALITY_THRESHOLD = 0.7

    if quality_score >= QUALITY_THRESHOLD:
        logger.info(
            "Quality gate passed",
            analysis_id=state["analysis_id"],
            score=quality_score
        )
        state["quality_passed"] = True
    else:
        logger.warning(
            "Quality gate failed",
            analysis_id=state["analysis_id"],
            score=quality_score,
            threshold=QUALITY_THRESHOLD
        )
        state["quality_passed"] = False

    langfuse_context.update_current_observation(
        output={
            "passed": state["quality_passed"],
            "score": quality_score,
            "details": state["quality_details"]
        }
    )

    return state

def route_after_quality_gate(state: AnalysisState) -> str:
    """Route based on quality assessment."""
    if state["quality_passed"]:
        return "compress_findings"
    elif state["retry_count"] < 2:
        state["retry_count"] += 1
        return "supervisor"  # Run more agents
    else:
        return END  # Give up, return partial results
```

---

## Workflow Construction

```python
# backend/app/workflows/content_analysis_workflow.py
from langgraph.graph import StateGraph, END
from app.workflows.checkpoints import create_checkpointer
from app.workflows.nodes.supervisor_node import supervisor_node
from app.workflows.nodes.quality_gate_node import (
    quality_gate_node,
    route_after_quality_gate
)
from app.workflows.nodes.compress_findings_node import compress_findings_node
from app.workflows.nodes.agents import (
    security_agent_node,
    tech_comparator_node,
    implementation_planner_node,
    tutorial_analyzer_node,
    depth_analyzer_node,
    prerequisites_extractor_node,
    best_practices_node,
    code_examples_node
)

ALL_AGENTS = [
    "security_agent",
    "tech_comparator",
    "implementation_planner",
    "tutorial_analyzer",
    "depth_analyzer",
    "prerequisites_extractor",
    "best_practices",
    "code_examples"
]

AGENT_NODES = {
    "security_agent": security_agent_node,
    "tech_comparator": tech_comparator_node,
    "implementation_planner": implementation_planner_node,
    "tutorial_analyzer": tutorial_analyzer_node,
    "depth_analyzer": depth_analyzer_node,
    "prerequisites_extractor": prerequisites_extractor_node,
    "best_practices": best_practices_node,
    "code_examples": code_examples_node
}

def create_analysis_workflow():
    """Build content analysis workflow."""

    workflow = StateGraph(AnalysisState)

    # Add supervisor
    workflow.add_node("supervisor", supervisor_node)

    # Add 8 specialist agents
    for agent_name, agent_fn in AGENT_NODES.items():
        workflow.add_node(agent_name, agent_fn)
        workflow.add_edge(agent_name, "supervisor")  # Return to supervisor

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

    # Compile with PostgreSQL checkpointing
    app = workflow.compile(checkpointer=create_checkpointer())

    return app
```

---

## API Integration

```python
# backend/app/api/v1/analysis.py
from fastapi import APIRouter, HTTPException
from app.workflows.content_analysis_workflow import create_analysis_workflow
from app.workflows.state import AnalysisState
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/v1/analysis")

@router.post("/analyze")
async def analyze_content(url: str, content: str, db: AsyncSession = Depends(get_db)):
    """Start content analysis workflow."""

    # Create analysis record - PostgreSQL 18 generates UUID v7 via server_default
    analysis = Analysis(url=url, content_type="article", status="pending")
    db.add(analysis)
    await db.flush()  # Get DB-generated UUID v7
    analysis_id = str(analysis.id)

    app = create_analysis_workflow()

    initial_state = AnalysisState(
        analysis_id=analysis_id,
        url=url,
        raw_content=content,
        content_type="article",  # Detect automatically
        findings=[],
        embeddings=[],
        current_agent="",
        agents_completed=[],
        next_node="supervisor",
        quality_score=0.0,
        quality_passed=False,
        retry_count=0,
        quality_details={},
        compressed_summary="",
        artifact_id="",
        artifact_data={},
        started_at=datetime.now(timezone.utc).isoformat(),
        total_tokens=0,
        total_cost=0.0
    )

    config = {"configurable": {"thread_id": analysis_id}}

    try:
        result = app.invoke(initial_state, config=config)

        return {
            "analysis_id": analysis_id,
            "status": "completed" if result["quality_passed"] else "partial",
            "quality_score": result["quality_score"],
            "agents_used": len(result["agents_completed"]),
            "total_findings": len(result["findings"]),
            "summary": result["compressed_summary"],
            "artifact_id": result["artifact_id"]
        }

    except Exception as e:
        # Try to resume from checkpoint
        result = app.invoke(None, config=config)

        if result:
            return {
                "analysis_id": analysis_id,
                "status": "recovered",
                "quality_score": result["quality_score"],
                "agents_used": len(result["agents_completed"]),
                "summary": result["compressed_summary"]
            }
        else:
            raise HTTPException(status_code=500, detail=str(e))
```

---

## Monitoring & Observability

### Langfuse Dashboard

**Trace Structure:**
```
content_analysis (trace)
├── supervisor (span)
├── security_agent (generation)
│   ├── input_tokens: 4500
│   ├── output_tokens: 800
│   └── cost: $0.015
├── supervisor (span)
├── tech_comparator (generation)
│   ├── input_tokens: 4500
│   ├── output_tokens: 750
│   └── cost: $0.014
├── ... (6 more agents)
├── supervisor (span)
├── quality_gate (span)
│   ├── depth_score: 0.82
│   ├── coverage_score: 0.91
│   └── confidence_score: 0.87
└── compress_findings (generation)
    ├── input_tokens: 15000
    ├── output_tokens: 500
    └── cost: $0.050
```

**Metrics to Track:**
- **Per-agent latency:** Which agents are slowest?
- **Per-agent costs:** Which agents are most expensive?
- **Quality gate pass rate:** What % of analyses pass?
- **Token usage:** Are we optimizing prompt caching?
- **Retry rate:** How often do we retry after quality gate failure?

---

## Performance Optimizations

### 1. Prompt Caching (90% cost savings)

```python
# Cache system prompts across agent calls
response = anthropic.messages.create(
    model="claude-sonnet-4-5-20250929",
    system=[
        {
            "type": "text",
            "text": LONG_SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"}  # Cache for 5 minutes
        }
    ],
    messages=[{"role": "user", "content": user_content}]
)
```

### 2. Parallel Agent Execution (Future)

```python
# Currently sequential (supervisor pattern)
# Future: Independent agents run in parallel

from langgraph.graph import Send

def supervisor_parallel(state):
    """Dispatch all agents in parallel."""
    return [
        Send(agent, state)
        for agent in ALL_AGENTS
    ]

# Aggregator waits for all agents
workflow.add_edge(ALL_AGENTS, "aggregator")
```

**Expected speedup:** 8x (if agents are independent)

### 3. Incremental Compression

```python
# Instead of compressing all findings at end:
# Compress incrementally as agents complete

def agent_with_compression(state):
    findings = run_agent(state["content"])
    compressed = compress_findings(findings)  # Compress immediately
    return {
        "compressed_findings": [compressed],  # Only store compressed
        "findings": []  # Clear raw findings
    }
```

**Storage savings:** 80% (compressed findings vs. raw)

---

## Implementation Notes

This reference architecture demonstrates:
- Supervisor-worker pattern with round-robin routing
- Quality gates with G-Eval scoring
- PostgreSQL checkpointing for fault tolerance
- Langfuse observability integration
- Prompt caching for cost optimization

To implement this architecture in your project, adapt the code templates above to your specific requirements.

## References

- LangGraph Docs: [Multi-Agent Systems](https://langchain-ai.github.io/langgraph/tutorials/multi_agent/)
- Langfuse Docs: [LangGraph Integration](https://langfuse.com/docs/integrations/langgraph)
- OrchestKit Skills: `langgraph-supervisor`, `langgraph-checkpoints`, `langfuse-observability`
