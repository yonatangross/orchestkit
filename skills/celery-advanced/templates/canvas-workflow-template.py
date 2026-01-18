"""
ETL Pipeline Template Using Celery Canvas (Celery 5.x)

A production-ready ETL pipeline demonstrating:
- Chain for sequential processing
- Group for parallel chunk processing
- Chord for fan-out/fan-in aggregation
- Proper error handling and retries
- Progress tracking with custom states

Usage:
    from templates.canvas_workflow_template import create_etl_pipeline
    result = create_etl_pipeline(source_id="src-123", destination="warehouse")
"""

from celery import chain, group, chord, signature
from celery.exceptions import Reject, MaxRetriesExceededError
from celery.result import AsyncResult
from datetime import datetime, timezone
from typing import Any
import structlog

from app.celery import celery_app

logger = structlog.get_logger()

# =============================================================================
# CUSTOM TASK STATES
# =============================================================================

EXTRACTING = "EXTRACTING"
TRANSFORMING = "TRANSFORMING"
LOADING = "LOADING"
AGGREGATING = "AGGREGATING"


# =============================================================================
# EXTRACTION TASKS
# =============================================================================


@celery_app.task(
    bind=True,
    max_retries=3,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=300,
)
def extract_data(self, source_id: str) -> dict:
    """
    Extract raw data from source system.

    Args:
        source_id: Identifier for the data source

    Returns:
        dict with raw_data and metadata

    Raises:
        Reject: For non-retryable errors (invalid source)
    """
    self.update_state(
        state=EXTRACTING,
        meta={"source_id": source_id, "step": "extract", "progress": 0},
    )

    log = logger.bind(task_id=self.request.id, source_id=source_id)
    log.info("starting_extraction")

    try:
        # Simulate extraction (replace with actual logic)
        raw_data = fetch_from_source(source_id)

        log.info("extraction_complete", record_count=len(raw_data.get("records", [])))

        return {
            "source_id": source_id,
            "raw_data": raw_data,
            "metadata": {
                "extracted_at": datetime.now(timezone.utc).isoformat(),
                "record_count": len(raw_data.get("records", [])),
            },
        }

    except SourceNotFoundError as exc:
        log.error("source_not_found", error=str(exc))
        raise Reject(f"Source not found: {source_id}", requeue=False)


@celery_app.task(bind=True)
def split_into_chunks(self, extraction_result: dict, chunk_size: int = 1000) -> list[dict]:
    """
    Split extracted data into chunks for parallel processing.

    Args:
        extraction_result: Output from extract_data
        chunk_size: Records per chunk

    Returns:
        List of chunk dictionaries
    """
    records = extraction_result["raw_data"].get("records", [])
    source_id = extraction_result["source_id"]

    chunks = []
    for i in range(0, len(records), chunk_size):
        chunk_records = records[i : i + chunk_size]
        chunks.append(
            {
                "chunk_id": i // chunk_size,
                "source_id": source_id,
                "records": chunk_records,
                "total_chunks": (len(records) + chunk_size - 1) // chunk_size,
            }
        )

    logger.info(
        "data_chunked",
        source_id=source_id,
        total_records=len(records),
        chunk_count=len(chunks),
    )

    return chunks


# =============================================================================
# TRANSFORMATION TASKS
# =============================================================================


@celery_app.task(
    bind=True,
    max_retries=2,
    soft_time_limit=300,
    time_limit=360,
)
def transform_chunk(self, chunk: dict, schema_version: str = "v2") -> dict:
    """
    Transform a single chunk of data.

    Args:
        chunk: Chunk dictionary with records
        schema_version: Target schema version

    Returns:
        dict with transformed records and stats
    """
    self.update_state(
        state=TRANSFORMING,
        meta={
            "chunk_id": chunk["chunk_id"],
            "total_chunks": chunk["total_chunks"],
            "progress": chunk["chunk_id"] / chunk["total_chunks"] * 100,
        },
    )

    log = logger.bind(
        task_id=self.request.id,
        chunk_id=chunk["chunk_id"],
        schema_version=schema_version,
    )

    try:
        transformed_records = []
        errors = []

        for record in chunk["records"]:
            try:
                transformed = apply_schema_transformation(record, schema_version)
                transformed_records.append(transformed)
            except ValidationError as e:
                errors.append({"record_id": record.get("id"), "error": str(e)})

        log.info(
            "chunk_transformed",
            success_count=len(transformed_records),
            error_count=len(errors),
        )

        return {
            "chunk_id": chunk["chunk_id"],
            "source_id": chunk["source_id"],
            "status": "success" if not errors else "partial",
            "records": transformed_records,
            "errors": errors,
            "stats": {
                "input_count": len(chunk["records"]),
                "output_count": len(transformed_records),
                "error_count": len(errors),
            },
        }

    except Exception as exc:
        log.error("transform_failed", error=str(exc))
        # Return error result instead of raising (allows chord to complete)
        return {
            "chunk_id": chunk["chunk_id"],
            "source_id": chunk["source_id"],
            "status": "error",
            "error": str(exc),
            "records": [],
            "errors": [],
            "stats": {"input_count": len(chunk["records"]), "output_count": 0, "error_count": 1},
        }


# =============================================================================
# AGGREGATION & LOADING TASKS
# =============================================================================


@celery_app.task(bind=True)
def aggregate_transform_results(self, results: list[dict]) -> dict:
    """
    Aggregate results from parallel transform tasks.

    Args:
        results: List of transform_chunk results

    Returns:
        Aggregated result with all records and combined stats
    """
    self.update_state(state=AGGREGATING, meta={"step": "aggregating"})

    all_records = []
    all_errors = []
    total_stats = {"input_count": 0, "output_count": 0, "error_count": 0}

    for result in results:
        if result["status"] in ("success", "partial"):
            all_records.extend(result["records"])
            all_errors.extend(result["errors"])

        for key in total_stats:
            total_stats[key] += result["stats"].get(key, 0)

    source_id = results[0]["source_id"] if results else "unknown"

    logger.info(
        "aggregation_complete",
        source_id=source_id,
        total_records=len(all_records),
        total_errors=len(all_errors),
    )

    return {
        "source_id": source_id,
        "records": all_records,
        "errors": all_errors,
        "stats": total_stats,
        "chunk_statuses": {r["chunk_id"]: r["status"] for r in results},
    }


@celery_app.task(
    bind=True,
    max_retries=3,
    autoretry_for=(IOError, ConnectionError),
    retry_backoff=True,
)
def load_to_destination(self, aggregated_result: dict, destination: str) -> dict:
    """
    Load transformed data to destination.

    Args:
        aggregated_result: Output from aggregate_transform_results
        destination: Target destination identifier

    Returns:
        Load result with record IDs
    """
    self.update_state(
        state=LOADING,
        meta={"destination": destination, "record_count": len(aggregated_result["records"])},
    )

    log = logger.bind(
        task_id=self.request.id,
        destination=destination,
        record_count=len(aggregated_result["records"]),
    )

    log.info("starting_load")

    # Simulate loading (replace with actual logic)
    loaded_ids = write_to_destination(aggregated_result["records"], destination)

    log.info("load_complete", loaded_count=len(loaded_ids))

    return {
        "source_id": aggregated_result["source_id"],
        "destination": destination,
        "loaded_ids": loaded_ids,
        "stats": aggregated_result["stats"],
        "errors": aggregated_result["errors"],
    }


# =============================================================================
# ERROR HANDLING
# =============================================================================


@celery_app.task
def handle_pipeline_error(
    request,
    exc,
    traceback,
    source_id: str,
    destination: str,
):
    """
    Error callback for pipeline failures.

    Args:
        request: Original task request
        exc: Exception that was raised
        traceback: Exception traceback
        source_id: Pipeline source ID
        destination: Pipeline destination
    """
    logger.error(
        "pipeline_failed",
        source_id=source_id,
        destination=destination,
        error=str(exc),
        task_id=request.id,
    )

    # Store failure for manual review
    store_pipeline_failure(
        source_id=source_id,
        destination=destination,
        error=str(exc),
        traceback=traceback,
    )

    # Send alert
    send_alert(
        f"ETL Pipeline Failed: {source_id} -> {destination}",
        severity="error",
        details={"error": str(exc)},
    )


# =============================================================================
# PIPELINE ORCHESTRATION
# =============================================================================


def create_etl_pipeline(
    source_id: str,
    destination: str,
    chunk_size: int = 1000,
    schema_version: str = "v2",
) -> AsyncResult:
    """
    Create and execute the full ETL pipeline.

    Args:
        source_id: Data source identifier
        destination: Target destination
        chunk_size: Records per chunk for parallel processing
        schema_version: Target schema version

    Returns:
        AsyncResult for tracking pipeline progress

    Example:
        result = create_etl_pipeline("src-123", "warehouse")
        print(result.state)  # EXTRACTING, TRANSFORMING, etc.
        final = result.get()  # Wait for completion
    """
    pipeline = chain(
        # Step 1: Extract data
        extract_data.s(source_id),
        # Step 2: Split into chunks
        split_into_chunks.s(chunk_size=chunk_size),
        # Step 3: Transform chunks in parallel, then aggregate
        parallel_transform_with_aggregation.s(schema_version=schema_version),
        # Step 4: Load to destination
        load_to_destination.s(destination=destination),
    )

    return pipeline.apply_async(
        link_error=handle_pipeline_error.s(
            source_id=source_id,
            destination=destination,
        )
    )


@celery_app.task(bind=True)
def parallel_transform_with_aggregation(
    self,
    chunks: list[dict],
    schema_version: str = "v2",
) -> dict:
    """
    Execute parallel transforms using chord, then aggregate.

    This is a dynamic chord - the number of parallel tasks
    depends on the number of chunks.

    Uses self.replace() to avoid blocking - the chord replaces this task
    and its callback's return value becomes the result. This is the
    correct pattern for executing canvas primitives inside tasks.
    """
    if not chunks:
        return {"records": [], "errors": [], "stats": {}}

    # Create the chord: parallel tasks -> callback with aggregated results
    workflow = chord(
        [transform_chunk.s(chunk, schema_version=schema_version) for chunk in chunks],
        aggregate_transform_results.s(),
    )

    # Replace this task with the chord - non-blocking pattern
    # The chord's callback result becomes this task's result
    raise self.replace(workflow)


# =============================================================================
# PROGRESS TRACKING
# =============================================================================


def get_pipeline_status(task_id: str) -> dict:
    """
    Get current status of a pipeline execution.

    Args:
        task_id: Root task ID from create_etl_pipeline

    Returns:
        Status dictionary with state and progress
    """
    result = AsyncResult(task_id)

    return {
        "task_id": task_id,
        "state": result.state,
        "info": result.info if result.info else {},
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None,
    }


# =============================================================================
# HELPER FUNCTIONS (Replace with actual implementations)
# =============================================================================


def fetch_from_source(source_id: str) -> dict:
    """Fetch data from source system."""
    raise NotImplementedError("Implement fetch_from_source")


def apply_schema_transformation(record: dict, schema_version: str) -> dict:
    """Apply schema transformation to record."""
    raise NotImplementedError("Implement apply_schema_transformation")


def write_to_destination(records: list[dict], destination: str) -> list[str]:
    """Write records to destination, return IDs."""
    raise NotImplementedError("Implement write_to_destination")


def store_pipeline_failure(source_id: str, destination: str, error: str, traceback: str):
    """Store failure record for review."""
    raise NotImplementedError("Implement store_pipeline_failure")


def send_alert(message: str, severity: str, details: dict):
    """Send alert notification."""
    raise NotImplementedError("Implement send_alert")


class SourceNotFoundError(Exception):
    """Raised when source is not found."""

    pass


class ValidationError(Exception):
    """Raised when record validation fails."""

    pass
