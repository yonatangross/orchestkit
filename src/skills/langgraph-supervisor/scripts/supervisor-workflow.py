"""
Production-ready supervisor-worker workflow template for LangGraph.

Features:
- Supervisor routes to specialized workers
- Round-robin, priority-based, or conditional routing
- Error handling with retries
- Checkpointing for fault tolerance
- Langfuse observability
"""

from operator import add
from typing import Annotated, Literal, TypedDict

import structlog
from langfuse.decorators import langfuse_context, observe
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, StateGraph

logger = structlog.get_logger()


# ============================================================================
# STATE DEFINITION
# ============================================================================

class WorkerResult(TypedDict):
    """Result from a worker node."""
    worker: str
    data: dict
    success: bool
    error: str | None


class WorkflowState(TypedDict):
    """Shared state for supervisor-worker workflow."""

    # Input (immutable)
    input: str
    request_id: str

    # Worker outputs (accumulating)
    results: Annotated[list[WorkerResult], add]

    # Control flow
    next_node: str
    workers_completed: list[str]
    workers_failed: list[str]

    # Error handling
    retry_count: dict[str, int]
    errors: Annotated[list[dict], add]


# ============================================================================
# WORKER DEFINITIONS
# ============================================================================

WorkerName = Literal["security_worker", "performance_worker", "quality_worker"]

ALL_WORKERS: list[WorkerName] = [
    "security_worker",
    "performance_worker",
    "quality_worker"
]

WORKER_PRIORITIES = {
    "security_worker": 1,  # High priority
    "performance_worker": 2,
    "quality_worker": 3
}


# ============================================================================
# WORKER NODES
# ============================================================================

@observe()
def security_worker(state: WorkflowState) -> WorkflowState:
    """Analyze security concerns."""
    logger.info("security_worker started", request_id=state["request_id"])

    try:
        # Simulate security analysis
        result = analyze_security(state["input"])

        langfuse_context.update_current_observation(
            output=result,
            metadata={"worker": "security"}
        )

        return {
            "results": [WorkerResult(
                worker="security_worker",
                data=result,
                success=True,
                error=None
            )],
            "workers_completed": state["workers_completed"] + ["security_worker"]
        }

    except Exception as e:
        logger.error("security_worker failed", error=str(e))
        return {
            "results": [WorkerResult(
                worker="security_worker",
                data={},
                success=False,
                error=str(e)
            )],
            "workers_failed": state["workers_failed"] + ["security_worker"],
            "errors": [{"worker": "security_worker", "error": str(e)}]
        }


@observe()
def performance_worker(state: WorkflowState) -> WorkflowState:
    """Analyze performance characteristics."""
    logger.info("performance_worker started", request_id=state["request_id"])

    try:
        result = analyze_performance(state["input"])

        langfuse_context.update_current_observation(
            output=result,
            metadata={"worker": "performance"}
        )

        return {
            "results": [WorkerResult(
                worker="performance_worker",
                data=result,
                success=True,
                error=None
            )],
            "workers_completed": state["workers_completed"] + ["performance_worker"]
        }

    except Exception as e:
        logger.error("performance_worker failed", error=str(e))
        return {
            "results": [WorkerResult(
                worker="performance_worker",
                data={},
                success=False,
                error=str(e)
            )],
            "workers_failed": state["workers_failed"] + ["performance_worker"],
            "errors": [{"worker": "performance_worker", "error": str(e)}]
        }


@observe()
def quality_worker(state: WorkflowState) -> WorkflowState:
    """Assess quality metrics."""
    logger.info("quality_worker started", request_id=state["request_id"])

    try:
        result = analyze_quality(state["input"])

        langfuse_context.update_current_observation(
            output=result,
            metadata={"worker": "quality"}
        )

        return {
            "results": [WorkerResult(
                worker="quality_worker",
                data=result,
                success=True,
                error=None
            )],
            "workers_completed": state["workers_completed"] + ["quality_worker"]
        }

    except Exception as e:
        logger.error("quality_worker failed", error=str(e))
        return {
            "results": [WorkerResult(
                worker="quality_worker",
                data={},
                success=False,
                error=str(e)
            )],
            "workers_failed": state["workers_failed"] + ["quality_worker"],
            "errors": [{"worker": "quality_worker", "error": str(e)}]
        }


# ============================================================================
# SUPERVISOR NODE
# ============================================================================

@observe()
def supervisor_node(state: WorkflowState) -> WorkflowState:
    """Route to next worker or finish."""
    completed = set(state["workers_completed"])
    failed = set(state["workers_failed"])

    # Check for retry-able failures
    for worker in failed:
        if state["retry_count"].get(worker, 0) < 2:
            state["retry_count"][worker] = state["retry_count"].get(worker, 0) + 1
            logger.info(
                "Retrying failed worker",
                worker=worker,
                retry_count=state["retry_count"][worker]
            )
            state["next_node"] = worker
            return state

    # Get available workers (not completed, not permanently failed)
    available = [
        w for w in ALL_WORKERS
        if w not in completed and (
            w not in failed or state["retry_count"].get(w, 0) < 2
        )
    ]

    if not available:
        # All workers completed or permanently failed
        logger.info(
            "All workers finished",
            completed=len(completed),
            failed=len([w for w in failed if state["retry_count"].get(w, 0) >= 2])
        )
        state["next_node"] = END
        return state

    # ROUTING STRATEGY 1: Round-robin (simple)
    next_worker = available[0]

    # ROUTING STRATEGY 2: Priority-based (uncomment to use)
    # next_worker = min(available, key=lambda w: WORKER_PRIORITIES[w])

    # ROUTING STRATEGY 3: Conditional (uncomment to use)
    # if "security" in state["input"].lower():
    #     next_worker = "security_worker"
    # else:
    #     next_worker = available[0]

    logger.info(
        "Routing to worker",
        worker=next_worker,
        remaining=len(available) - 1
    )

    langfuse_context.update_current_observation(
        output={"next": next_worker},
        metadata={
            "completed_count": len(completed),
            "remaining_count": len(available)
        }
    )

    state["next_node"] = next_worker
    return state


# ============================================================================
# WORKFLOW CONSTRUCTION
# ============================================================================

def create_supervisor_workflow(database_url: str) -> StateGraph:
    """Build supervisor-worker workflow with checkpointing."""

    # Create checkpointer
    checkpointer = PostgresSaver.from_conn_string(database_url)

    # Build graph
    workflow = StateGraph(WorkflowState)

    # Add supervisor
    workflow.add_node("supervisor", supervisor_node)

    # Add workers
    for worker_name in ALL_WORKERS:
        worker_fn = globals()[worker_name]  # Get function by name
        workflow.add_node(worker_name, worker_fn)

        # Workers return to supervisor
        workflow.add_edge(worker_name, "supervisor")

    # Supervisor routes dynamically
    workflow.add_conditional_edges(
        "supervisor",
        lambda s: s["next_node"],
        {
            **{worker: worker for worker in ALL_WORKERS},
            END: END
        }
    )

    # Set entry point
    workflow.set_entry_point("supervisor")

    # Compile with checkpointing
    app = workflow.compile(checkpointer=checkpointer)

    return app


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

@observe()
def run_workflow(input_text: str, request_id: str, database_url: str):
    """Run supervisor-worker workflow."""

    langfuse_context.update_current_trace(
        name="supervisor_workflow",
        metadata={"request_id": request_id}
    )

    app = create_supervisor_workflow(database_url)

    initial_state = WorkflowState(
        input=input_text,
        request_id=request_id,
        results=[],
        next_node="supervisor",
        workers_completed=[],
        workers_failed=[],
        retry_count={},
        errors=[]
    )

    config = {"configurable": {"thread_id": request_id}}

    try:
        result = app.invoke(initial_state, config=config)

        langfuse_context.update_current_observation(
            output=result,
            metadata={
                "workers_completed": len(result["workers_completed"]),
                "workers_failed": len(result["workers_failed"])
            }
        )

        return result

    except Exception as e:
        logger.error("Workflow failed", error=str(e), request_id=request_id)

        # Try to resume from checkpoint
        logger.info("Attempting to resume from checkpoint")
        result = app.invoke(None, config=config)
        return result


# ============================================================================
# PLACEHOLDER ANALYSIS FUNCTIONS (Replace with real implementations)
# ============================================================================

def analyze_security(input_text: str) -> dict:
    """Placeholder security analysis."""
    return {"security_score": 0.85, "issues": []}


def analyze_performance(input_text: str) -> dict:
    """Placeholder performance analysis."""
    return {"performance_score": 0.92, "bottlenecks": []}


def analyze_quality(input_text: str) -> dict:
    """Placeholder quality analysis."""
    return {"quality_score": 0.88, "suggestions": []}


if __name__ == "__main__":
    # Test the workflow
    result = run_workflow(
        input_text="Check this code for security and performance issues",
        request_id="test-123",
        database_url="postgresql://localhost:5432/test"
    )
    print(f"Workflow completed: {len(result['results'])} workers ran")
