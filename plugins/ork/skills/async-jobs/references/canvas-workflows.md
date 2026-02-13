# Canvas Workflows

Celery canvas primitives for building complex task pipelines with chain, group, chord, and nested workflows.

## Signatures

```python
from celery import signature, chain, group, chord

# Create a reusable task signature
sig = signature("tasks.process_order", args=[order_id], kwargs={"priority": "high"})

# Immutable signature — won't receive results from previous task
sig = process_order.si(order_id)

# Partial signature — curry arguments
partial_sig = send_email.s(subject="Order Update")
# Later: partial_sig.delay(to="user@example.com", body="...")
```

## Chains (Sequential Execution)

```python
from celery import chain

# Tasks execute sequentially, each receiving the previous result
workflow = chain(
    extract_data.s(source_id),      # Returns raw_data
    transform_data.s(),              # Receives raw_data, returns clean_data
    load_data.s(destination_id),     # Receives clean_data
)
result = workflow.apply_async()

# Access results
chain_result = result.get()          # Final result
parent_result = result.parent.get()  # Previous task result
```

### Chain Error Handling

```python
from celery.exceptions import Reject

@celery_app.task(bind=True, max_retries=3)
def extract_data(self, source_id: str) -> dict:
    try:
        return fetch_from_source(source_id)
    except ConnectionError as exc:
        # Retryable: chain pauses, retries this step
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
    except ValidationError as exc:
        # Non-retryable: reject and stop entire chain
        raise Reject(str(exc), requeue=False)

# Error callback for the whole chain
def create_etl_pipeline(source_id: str, dest: str) -> AsyncResult:
    pipeline = chain(
        extract_data.s(source_id),
        transform_data.s(schema="v2"),
        load_data.s(destination=dest),
    )
    return pipeline.apply_async(
        link_error=handle_pipeline_error.s(source_id=source_id)
    )

@celery_app.task
def handle_pipeline_error(request, exc, traceback, source_id: str):
    alert_team(f"ETL failed for {source_id}: {exc}")
```

## Groups (Parallel Execution)

```python
from celery import group

# Execute tasks in parallel
parallel = group(
    process_chunk.s(chunk) for chunk in chunks
)
group_result = parallel.apply_async()

# Wait for all to complete
results = group_result.get()

# Check completion status
group_result.ready()      # All completed?
group_result.successful() # All succeeded?
group_result.failed()     # Any failed?
```

## Chords (Parallel + Callback)

```python
from celery import chord

# Parallel execution with callback when ALL complete
workflow = chord(
    [process_chunk.s(chunk) for chunk in chunks],
    aggregate_results.s()  # Receives list of all results
)
result = workflow.apply_async()

# IMPORTANT: If any header task fails, callback won't run
```

### Chord with Partial Failure Tolerance

```python
@celery_app.task(bind=True)
def process_chunk(self, chunk_id: int, data: list) -> dict:
    """Return error dict instead of raising to allow chord to complete."""
    try:
        result = expensive_computation(data)
        return {"chunk_id": chunk_id, "status": "success", "result": result}
    except Exception as exc:
        return {"chunk_id": chunk_id, "status": "error", "error": str(exc)}

@celery_app.task
def aggregate_with_errors(results: list[dict]) -> dict:
    """Aggregate results, handling partial failures gracefully."""
    successes = [r for r in results if r["status"] == "success"]
    failures = [r for r in results if r["status"] == "error"]
    return {
        "total": len(results),
        "succeeded": len(successes),
        "failed": len(failures),
        "aggregated": sum(r["result"] for r in successes),
        "failed_chunks": [r["chunk_id"] for r in failures],
    }
```

## Map, Starmap, and Chunks

```python
# Map: apply same task to each item
workflow = process_item.map([item1, item2, item3])

# Starmap: unpack args for each call
workflow = send_email.starmap([
    ("user1@example.com", "Subject 1"),
    ("user2@example.com", "Subject 2"),
])

# Chunks: split large list into batches
workflow = process_item.chunks(items, batch_size=100)
```

## Nested Workflows

```python
def create_order_workflow(order_id: str) -> AsyncResult:
    """Complex workflow combining chain, group, and immutable signatures."""
    return chain(
        # Step 1: Validate
        validate_order.s(order_id),

        # Step 2: Parallel inventory checks (group inside chain)
        group(
            check_inventory.s(item_id)
            for item_id in get_order_items(order_id)
        ),

        # Step 3: Aggregate inventory results
        aggregate_inventory.s(),

        # Step 4: Payment (ignores input from aggregate)
        process_payment.si(order_id),

        # Step 5: Parallel notifications
        group(
            send_confirmation_email.si(order_id),
            send_sms_notification.si(order_id),
            update_analytics.si(order_id),
        ),
    ).apply_async()
```

## Result Inspection

```python
from celery.result import AsyncResult, GroupResult

def inspect_chain_result(task_id: str) -> dict:
    """Traverse chain results from leaf to root."""
    result = AsyncResult(task_id)
    chain_results = []

    current = result
    while current is not None:
        chain_results.append({
            "task_id": current.id,
            "state": current.state,
            "result": current.result if current.ready() else None,
        })
        current = current.parent

    return {"results": list(reversed(chain_results))}
```

## Canvas Best Practices

| Pattern | When to Use | Key Consideration |
|---------|-------------|-------------------|
| Chain | Sequential steps | Use `si()` for steps that ignore input |
| Group | Parallel independent tasks | Monitor memory with large groups |
| Chord | Fan-out/fan-in | Callback runs only if ALL succeed |
| Starmap | Same task, different args | More efficient than group |
| Chunks | Large datasets | Balance chunk size vs overhead |

## Error Recovery Strategies

1. **Retry transient**: Use `autoretry_for` with backoff
2. **Reject permanent**: Use `Reject(requeue=False)` to stop chain
3. **Soft fail**: Return error dict instead of raising (for chords)
4. **Link error**: Use `link_error` callback for notifications
