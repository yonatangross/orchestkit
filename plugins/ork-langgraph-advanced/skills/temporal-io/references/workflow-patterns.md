# Advanced Workflow Patterns

## Child Workflows

Use child workflows for modularity and isolation.

```python
from temporalio import workflow
from datetime import timedelta

@workflow.defn
class ParentWorkflow:
    @workflow.run
    async def run(self, items: list[str]) -> list[dict]:
        # Start children in parallel
        handles = []
        for item in items:
            handle = await workflow.start_child_workflow(
                ProcessItemWorkflow.run,
                item,
                id=f"process-{item}",
                # Inherit parent's task queue by default
            )
            handles.append(handle)

        # Wait for all to complete
        return await asyncio.gather(*[h.result() for h in handles])
```

**When to use child workflows:**
- Separate failure domains
- Different retry policies per sub-process
- Modular, reusable workflow components
- Need independent workflow history

## Continue-As-New

Prevent unbounded history for long-running workflows.

```python
@workflow.defn
class LongRunningWorkflow:
    @workflow.run
    async def run(self, state: WorkflowState) -> WorkflowState:
        iteration = 0
        max_iterations = 1000  # Prevent unbounded history

        while not state.is_complete:
            await workflow.execute_activity(
                process_batch,
                state.current_batch,
                start_to_close_timeout=timedelta(minutes=5),
            )
            state.advance()
            iteration += 1

            # Continue-as-new before history grows too large
            if iteration >= max_iterations:
                workflow.continue_as_new(state)

        return state
```

**Key points:**
- Workflow history is capped (~50K events)
- `continue_as_new` starts fresh history with current state
- Use for polling loops, scheduled tasks, batch processing

## Dynamic Workflow Selection

Route to workflows at runtime.

```python
@workflow.defn
class DispatcherWorkflow:
    @workflow.run
    async def run(self, request: Request) -> Result:
        workflow_type = self._select_workflow(request.type)

        return await workflow.execute_child_workflow(
            workflow_type,
            request.payload,
            id=f"dynamic-{request.id}",
        )

    def _select_workflow(self, type: str) -> str:
        mapping = {
            "order": "OrderWorkflow",
            "refund": "RefundWorkflow",
            "subscription": "SubscriptionWorkflow",
        }
        return mapping.get(type, "DefaultWorkflow")
```

## Related

- saga-compensation - Full saga implementation
- signals-queries-updates - External interaction
