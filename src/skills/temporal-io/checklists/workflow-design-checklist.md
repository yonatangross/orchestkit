# Workflow Design Checklist

Best practices for designing and implementing Temporal workflows.

## Pre-Implementation

### Requirements Analysis

- [ ] **Identify durability needs**: Does this process need to survive crashes/restarts?
- [ ] **Define SLAs**: What are the timeout requirements for each step?
- [ ] **Map failure scenarios**: What happens when each step fails?
- [ ] **Plan compensations**: For each action, what's the rollback?
- [ ] **Identify idempotency requirements**: Which operations must be idempotent?
- [ ] **Define consistency model**: Eventual or strong consistency needed?

### Workflow Boundaries

- [ ] **Single responsibility**: Does this workflow do one logical thing?
- [ ] **Reasonable duration**: Will this complete in a reasonable time (< 30 days typical)?
- [ ] **State size**: Is the workflow state < 50KB serialized?
- [ ] **Event history**: Will history stay < 10K events?

## Workflow Definition

### Determinism Rules

```python
# NEVER use in workflows:
# - random.random()       -> workflow.random()
# - datetime.now()        -> workflow.now()
# - uuid.uuid4()          -> workflow.uuid4()
# - time.sleep()          -> asyncio.sleep() or workflow.sleep()
# - os.environ            -> Pass as workflow input
# - threading/multiprocessing -> Use activities
# - Direct I/O (files, network, DB) -> Use activities
```

- [ ] **No non-deterministic operations** in workflow code
- [ ] **No side effects** (I/O, network, etc.) in workflow code
- [ ] **All external calls** go through activities
- [ ] **Use workflow APIs** for time, random, uuid
- [ ] **Immutable inputs**: Don't modify workflow input objects

### State Management

- [ ] **Initialize state** in `__init__` or at start of `run`
- [ ] **Private state fields**: Use `_` prefix for internal state
- [ ] **Queries for read access**: Expose state via `@workflow.query`
- [ ] **Signals for write access**: Modify state via `@workflow.signal`
- [ ] **Validate state transitions**: Check valid state before changing

### Error Handling

- [ ] **Distinguish retryable vs non-retryable** errors
- [ ] **Use ApplicationError** for non-retryable business errors
- [ ] **Log with workflow.logger**: Not standard logging
- [ ] **Handle ContinueAsNew** for long-running workflows
- [ ] **Graceful degradation**: What happens if an activity permanently fails?

## Activity Definition

### Idempotency

```python
@activity.defn
async def create_order(order_id: str, data: dict) -> Order:
    # WRONG: Creates duplicate on retry
    # return await db.insert(Order(id=generate_id(), ...))

    # CORRECT: Idempotent upsert
    return await db.upsert(Order(id=order_id, ...))
```

- [ ] **Idempotency key**: Use business-meaningful ID, not generated
- [ ] **Upsert over insert**: Prefer upsert for creates
- [ ] **Check before mutate**: Verify state before making changes
- [ ] **Idempotent external calls**: Use idempotency keys for APIs

### Timeouts and Retries

| Timeout Type | When to Use | Example |
|--------------|-------------|---------|
| `start_to_close` | Max execution time | Database query: 30s |
| `schedule_to_close` | Include queue wait time | Batch job: 1 hour |
| `schedule_to_start` | Max queue wait | Alert if delayed: 5min |
| `heartbeat` | Long-running activities | File processing: 60s |

- [ ] **Always set timeouts**: Never use default infinite
- [ ] **start_to_close for most cases**: Simple timeout semantics
- [ ] **Heartbeat for long activities**: > 60 seconds
- [ ] **Retry policy configured**: Attempts, backoff, max interval
- [ ] **Non-retryable errors specified**: Business logic failures

### Heartbeating

```python
@activity.defn
async def process_large_file(file_id: str) -> dict:
    lines_processed = 0
    with open(file_path) as f:
        for line in f:
            process_line(line)
            lines_processed += 1

            # Heartbeat every 100 lines
            if lines_processed % 100 == 0:
                activity.heartbeat(f"Processed {lines_processed} lines")

    return {"lines": lines_processed}
```

- [ ] **Heartbeat progress** for long activities
- [ ] **Heartbeat frequency**: At least every `heartbeat_timeout/3`
- [ ] **Include checkpoint data**: Enable resume from heartbeat
- [ ] **Handle cancellation**: Check `activity.is_cancelled()` if needed

## Saga Pattern

### Compensation Design

- [ ] **Every action has compensation**: Or explicit decision why not
- [ ] **Compensations are idempotent**: Can run multiple times safely
- [ ] **Compensations always succeed**: Retry until they do
- [ ] **Reverse order**: Run compensations in reverse
- [ ] **Log compensation failures**: For manual intervention

### Compensation Testing

- [ ] **Test happy path**: All steps succeed
- [ ] **Test each failure point**: Fail at step 1, 2, 3, etc.
- [ ] **Test compensation failures**: What if compensation fails?
- [ ] **Test concurrent modifications**: Race conditions

## Testing

### Unit Tests

```python
@pytest.mark.asyncio
async def test_workflow_happy_path(workflow_env):
    async with Worker(
        workflow_env.client,
        task_queue="test",
        workflows=[MyWorkflow],
        activities=[my_activity],
    ):
        result = await workflow_env.client.execute_workflow(
            MyWorkflow.run,
            test_input,
            id="test-1",
            task_queue="test",
        )
        assert result.status == "completed"
```

- [ ] **Use WorkflowEnvironment**: Local testing without server
- [ ] **Mock activities**: Test workflow logic in isolation
- [ ] **Test signals and queries**: Verify external interactions
- [ ] **Time skipping tests**: For timer-heavy workflows
- [ ] **Test error scenarios**: Activity failures, cancellations

### Integration Tests

- [ ] **Real Temporal server**: Use dev server or test cluster
- [ ] **Real activities**: With test databases/services
- [ ] **End-to-end flows**: Start to completion
- [ ] **Concurrent workflows**: Multiple simultaneous executions
- [ ] **Long-running scenarios**: Timer and schedule testing

## Versioning and Updates

### Workflow Versioning

```python
# Safe code evolution
version = workflow.patched("add-notification-step")
if version:
    await workflow.execute_activity(send_notification, ...)
```

- [ ] **Use workflow.patched()** for breaking changes
- [ ] **Version new code paths**: Not old ones
- [ ] **Plan deprecation**: When to remove old code
- [ ] **Test both paths**: Old and new workflows

### Workflow Updates

- [ ] **Use @workflow.update** for runtime modifications
- [ ] **Validate update requests**: Check preconditions
- [ ] **Document update behavior**: What can be updated when

## Observability

### Logging

- [ ] **Use workflow.logger**: Not standard logging
- [ ] **Structured logging**: Key-value pairs
- [ ] **Log step transitions**: Entry/exit of major steps
- [ ] **Include workflow ID**: For correlation

### Metrics

- [ ] **Workflow started/completed counters**: By type
- [ ] **Activity duration histograms**: By type
- [ ] **Error counters**: By type and reason
- [ ] **Queue depth**: Pending tasks

### Tracing

- [ ] **Trace context propagation**: Across activities
- [ ] **Custom spans**: For logical operations
- [ ] **Link to parent traces**: From client to workflow

## Security

### Input Validation

- [ ] **Validate workflow inputs**: Type and value checks
- [ ] **Validate activity inputs**: Before processing
- [ ] **Sanitize outputs**: No sensitive data in results
- [ ] **Size limits**: Prevent oversized payloads

### Access Control

- [ ] **Namespace isolation**: Separate test/prod
- [ ] **Task queue permissions**: Restrict who can process
- [ ] **Workflow start permissions**: Who can initiate
- [ ] **Query/signal permissions**: Who can interact

## Pre-Deployment

### Performance

- [ ] **Load tested**: Expected throughput achieved
- [ ] **Resource limits set**: Worker concurrency
- [ ] **Timeout tuning**: Based on actual performance
- [ ] **History size check**: Events stay manageable

### Operational Readiness

- [ ] **Runbook created**: Common operations documented
- [ ] **Alerts configured**: For failures and delays
- [ ] **Dashboards ready**: Visibility into operations
- [ ] **Rollback plan**: How to revert if needed
