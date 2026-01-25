# Canvas Workflows Deep Dive

Advanced patterns for chain, group, chord with robust error handling.

## Chain Error Handling (Celery 5.x)

```python
from celery import chain, signature
from celery.exceptions import Reject

@celery_app.task(bind=True, max_retries=3)
def extract_data(self, source_id: str) -> dict:
    """Step 1: Extract with retry on transient failures."""
    try:
        return fetch_from_source(source_id)
    except ConnectionError as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
    except ValidationError as exc:
        # Non-retryable: reject and stop chain
        raise Reject(str(exc), requeue=False)

@celery_app.task(bind=True)
def transform_data(self, raw_data: dict, schema: str = "default") -> dict:
    """Step 2: Transform with schema validation."""
    try:
        return apply_schema(raw_data, schema)
    except SchemaError as exc:
        # Store failed record for manual review
        store_failed_record(raw_data, error=str(exc))
        raise Reject(f"Schema validation failed: {exc}", requeue=False)

@celery_app.task(bind=True, autoretry_for=(IOError,), retry_backoff=True)
def load_data(self, clean_data: dict, destination: str) -> str:
    """Step 3: Load with automatic exponential backoff."""
    record_id = write_to_destination(clean_data, destination)
    return record_id

# Build ETL pipeline
def create_etl_pipeline(source_id: str, destination: str) -> AsyncResult:
    """Create ETL chain with error callbacks."""
    pipeline = chain(
        extract_data.s(source_id),
        transform_data.s(schema="v2"),
        load_data.s(destination=destination),
    )
    return pipeline.apply_async(
        link_error=handle_pipeline_error.s(source_id=source_id)
    )

@celery_app.task
def handle_pipeline_error(request, exc, traceback, source_id: str):
    """Error callback receives failed task info."""
    alert_team(f"ETL failed for {source_id}: {exc}")
    mark_source_failed(source_id, error=str(exc))
```

## Chord with Partial Failures

```python
from celery import chord, group
from celery.result import allow_join_result

@celery_app.task(bind=True)
def process_chunk(self, chunk_id: int, data: list) -> dict:
    """Process chunk, return result or error dict."""
    try:
        result = expensive_computation(data)
        return {"chunk_id": chunk_id, "status": "success", "result": result}
    except Exception as exc:
        # Return error instead of raising to allow chord to complete
        return {"chunk_id": chunk_id, "status": "error", "error": str(exc)}

@celery_app.task
def aggregate_with_errors(results: list[dict]) -> dict:
    """Aggregate results, handling partial failures."""
    successes = [r for r in results if r["status"] == "success"]
    failures = [r for r in results if r["status"] == "error"]

    return {
        "total": len(results),
        "succeeded": len(successes),
        "failed": len(failures),
        "aggregated": sum(r["result"] for r in successes),
        "failed_chunks": [r["chunk_id"] for r in failures],
    }

# Usage: chord that tolerates partial failures
workflow = chord(
    [process_chunk.s(i, chunk) for i, chunk in enumerate(chunks)],
    aggregate_with_errors.s()
)
```

## Nested Workflows

```python
def create_order_workflow(order_id: str) -> AsyncResult:
    """Complex workflow with nested groups."""
    return chain(
        # Step 1: Validate order
        validate_order.s(order_id),

        # Step 2: Parallel inventory checks (group inside chain)
        group(
            check_inventory.s(item_id)
            for item_id in get_order_items(order_id)
        ),

        # Step 3: Aggregate inventory results
        aggregate_inventory.s(),

        # Step 4: Process payment (only if inventory OK)
        process_payment.si(order_id),  # si() = immutable, ignores input

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

def inspect_group_result(group_id: str) -> dict:
    """Get status of all tasks in group."""
    group_result = GroupResult.restore(group_id)
    return {
        "total": len(group_result),
        "completed": sum(1 for r in group_result if r.ready()),
        "successful": sum(1 for r in group_result if r.successful()),
        "failed": sum(1 for r in group_result if r.failed()),
        "results": [
            {"id": r.id, "state": r.state}
            for r in group_result
        ],
    }
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
