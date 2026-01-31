"""
Client Streaming Batch Processing Service Example

Demonstrates gRPC client streaming for efficient batch operations.
Features:
- Client streams items for bulk processing
- Server processes in batches for efficiency
- Progress tracking and partial failure handling
- Backpressure awareness

Use Cases:
- Bulk data import
- Batch updates
- File upload in chunks
- Log ingestion

Proto Definition (batch.proto):
```protobuf
syntax = "proto3";
package batch.v1;

import "google/protobuf/timestamp.proto";

service BatchService {
  // Client streams items for bulk creation
  rpc BulkCreate(stream CreateItemRequest) returns (BulkCreateResponse);

  // Client streams items for bulk update
  rpc BulkUpdate(stream UpdateItemRequest) returns (BulkUpdateResponse);

  // Client streams file chunks for upload
  rpc UploadFile(stream FileChunk) returns (UploadResponse);

  // Client streams with progress updates (bidirectional)
  rpc BulkCreateWithProgress(stream CreateItemRequest) returns (stream ProgressEvent);
}

message CreateItemRequest {
  string name = 1;
  string description = 2;
  map<string, string> metadata = 3;
  bytes data = 4;
}

message UpdateItemRequest {
  string id = 1;
  optional string name = 2;
  optional string description = 3;
}

message FileChunk {
  string filename = 1;
  bytes data = 2;
  int64 offset = 3;
  bool is_last = 4;
}

message BulkCreateResponse {
  int32 total_received = 1;
  int32 created_count = 2;
  int32 failed_count = 3;
  repeated string created_ids = 4;
  repeated ItemError errors = 5;
  google.protobuf.Timestamp completed_at = 6;
}

message BulkUpdateResponse {
  int32 total_received = 1;
  int32 updated_count = 2;
  int32 failed_count = 3;
  repeated ItemError errors = 4;
}

message UploadResponse {
  string file_id = 1;
  string filename = 2;
  int64 total_bytes = 3;
  string checksum = 4;
}

message ItemError {
  int32 index = 1;
  string code = 2;
  string message = 3;
}

message ProgressEvent {
  oneof event {
    Progress progress = 1;
    ItemResult result = 2;
    BatchComplete complete = 3;
  }
}

message Progress {
  int32 processed = 1;
  int32 total_estimate = 2;
  float percent = 3;
}

message ItemResult {
  int32 index = 1;
  bool success = 2;
  string id = 3;
  string error = 4;
}

message BatchComplete {
  int32 total = 1;
  int32 succeeded = 2;
  int32 failed = 3;
}
```

Requirements:
    pip install grpcio>=1.60.0 grpcio-tools structlog
"""

import asyncio
import hashlib
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import uuid4

import grpc
import structlog
from grpc import aio

logger = structlog.get_logger()


# =============================================================================
# Domain Models
# =============================================================================

@dataclass
class Item:
    id: str
    name: str
    description: str
    metadata: dict[str, str]
    created_at: datetime


@dataclass
class BatchResult:
    total_received: int = 0
    created_count: int = 0
    failed_count: int = 0
    created_ids: list[str] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)


# =============================================================================
# Batch Processor
# =============================================================================

class BatchProcessor:
    """
    Processes items in batches for efficiency.

    Collects items until batch_size is reached, then processes together.
    """

    def __init__(
        self,
        batch_size: int = 100,
        max_concurrent: int = 5,
    ):
        self.batch_size = batch_size
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def process_batch(
        self,
        items: list[dict],
        start_index: int,
    ) -> list[tuple[int, str | None, str | None]]:
        """
        Process a batch of items.

        Returns: List of (index, id_or_none, error_or_none)
        """
        results = []

        async with self._semaphore:
            # Simulate batch database insert
            await asyncio.sleep(0.01 * len(items))

            for i, item in enumerate(items):
                index = start_index + i

                # Simulate validation/processing
                if not item.get("name"):
                    results.append((index, None, "Name is required"))
                elif len(item.get("name", "")) > 100:
                    results.append((index, None, "Name too long"))
                else:
                    item_id = str(uuid4())
                    results.append((index, item_id, None))

        return results


# =============================================================================
# gRPC Service Implementation
# =============================================================================

class BatchServiceServicer:
    """
    Batch processing service with client streaming.
    """

    def __init__(self, batch_size: int = 100):
        self.processor = BatchProcessor(batch_size=batch_size)
        self.batch_size = batch_size

    async def BulkCreate(
        self,
        request_iterator: AsyncIterator,
        context: aio.ServicerContext,
    ):
        """
        Process stream of items for bulk creation.

        Items are batched for efficient database operations.
        Returns summary with created IDs and any errors.
        """
        log = logger.bind(method="BulkCreate")
        result = BatchResult()
        batch: list[dict] = []
        batch_start_index = 0

        async def flush_batch():
            """Process current batch."""
            nonlocal batch, batch_start_index

            if not batch:
                return

            batch_results = await self.processor.process_batch(
                batch,
                batch_start_index,
            )

            for index, item_id, error in batch_results:
                if item_id:
                    result.created_count += 1
                    result.created_ids.append(item_id)
                else:
                    result.failed_count += 1
                    result.errors.append({
                        "index": index,
                        "code": "VALIDATION_ERROR",
                        "message": error,
                    })

            batch_start_index += len(batch)
            batch = []

        try:
            async for request in request_iterator:
                result.total_received += 1

                # Convert proto to dict (in real code, use proto fields)
                item = {
                    "name": getattr(request, "name", ""),
                    "description": getattr(request, "description", ""),
                    "metadata": dict(getattr(request, "metadata", {})),
                }
                batch.append(item)

                # Flush when batch is full
                if len(batch) >= self.batch_size:
                    await flush_batch()

                # Check for cancellation periodically
                if result.total_received % 1000 == 0:
                    if not context.is_active():
                        log.warning("client_cancelled", processed=result.total_received)
                        break

            # Flush remaining items
            await flush_batch()

        except Exception as e:
            log.exception("bulk_create_error", error=str(e))
            raise

        log.info(
            "bulk_create_completed",
            total=result.total_received,
            created=result.created_count,
            failed=result.failed_count,
        )

        # Return BulkCreateResponse proto
        return result

    async def BulkUpdate(
        self,
        request_iterator: AsyncIterator,
        context: aio.ServicerContext,
    ):
        """
        Process stream of update requests.
        """
        log = logger.bind(method="BulkUpdate")
        total = 0
        updated = 0
        failed = 0
        errors = []

        async for request in request_iterator:
            total += 1

            try:
                # Simulate update
                item_id = getattr(request, "id", None)
                if not item_id:
                    errors.append({
                        "index": total - 1,
                        "code": "MISSING_ID",
                        "message": "Item ID is required",
                    })
                    failed += 1
                else:
                    # Simulate database update
                    await asyncio.sleep(0.001)
                    updated += 1

            except Exception as e:
                errors.append({
                    "index": total - 1,
                    "code": "UPDATE_ERROR",
                    "message": str(e),
                })
                failed += 1

        log.info(
            "bulk_update_completed",
            total=total,
            updated=updated,
            failed=failed,
        )

        return {
            "total_received": total,
            "updated_count": updated,
            "failed_count": failed,
            "errors": errors,
        }

    async def UploadFile(
        self,
        request_iterator: AsyncIterator,
        context: aio.ServicerContext,
    ):
        """
        Receive file in chunks via client streaming.

        Reassembles chunks and validates checksum.
        """
        log = logger.bind(method="UploadFile")
        filename = None
        chunks: list[bytes] = []
        total_bytes = 0

        async for chunk in request_iterator:
            if filename is None:
                filename = getattr(chunk, "filename", "unknown")
                log = log.bind(filename=filename)

            data = getattr(chunk, "data", b"")
            chunks.append(data)
            total_bytes += len(data)

            # Check for last chunk
            if getattr(chunk, "is_last", False):
                break

            # Backpressure: limit memory usage
            if total_bytes > 100 * 1024 * 1024:  # 100MB
                await context.abort(
                    grpc.StatusCode.RESOURCE_EXHAUSTED,
                    "File too large (max 100MB)",
                )

        # Reassemble file
        file_data = b"".join(chunks)
        checksum = hashlib.sha256(file_data).hexdigest()
        file_id = str(uuid4())

        log.info(
            "file_uploaded",
            file_id=file_id,
            size=total_bytes,
            checksum=checksum[:16],
        )

        return {
            "file_id": file_id,
            "filename": filename,
            "total_bytes": total_bytes,
            "checksum": checksum,
        }

    async def BulkCreateWithProgress(
        self,
        request_iterator: AsyncIterator,
        context: aio.ServicerContext,
    ) -> AsyncIterator:
        """
        Bidirectional streaming for bulk create with progress updates.

        Client streams items, server streams progress and results.
        """
        log = logger.bind(method="BulkCreateWithProgress")

        total_received = 0
        succeeded = 0
        failed = 0
        batch: list[dict] = []

        async def process_and_report():
            """Process batch and yield results."""
            nonlocal succeeded, failed

            if not batch:
                return

            start_index = total_received - len(batch)
            results = await self.processor.process_batch(batch, start_index)

            for index, item_id, error in results:
                if item_id:
                    succeeded += 1
                    yield {
                        "type": "result",
                        "index": index,
                        "success": True,
                        "id": item_id,
                    }
                else:
                    failed += 1
                    yield {
                        "type": "result",
                        "index": index,
                        "success": False,
                        "error": error,
                    }

            batch.clear()

        try:
            async for request in request_iterator:
                total_received += 1

                # Add to batch
                item = {
                    "name": getattr(request, "name", ""),
                    "description": getattr(request, "description", ""),
                }
                batch.append(item)

                # Process batch when full
                if len(batch) >= self.batch_size:
                    # Report progress
                    yield {
                        "type": "progress",
                        "processed": total_received,
                        "percent": 0,  # Unknown total in streaming
                    }

                    # Process and yield results
                    async for result in process_and_report():
                        yield result

            # Process remaining
            async for result in process_and_report():
                yield result

            # Final summary
            yield {
                "type": "complete",
                "total": total_received,
                "succeeded": succeeded,
                "failed": failed,
            }

            log.info(
                "bulk_create_with_progress_completed",
                total=total_received,
                succeeded=succeeded,
                failed=failed,
            )

        except asyncio.CancelledError:
            log.warning("stream_cancelled", processed=total_received)
            raise


# =============================================================================
# Server Setup
# =============================================================================

async def serve():
    """Start the batch processing server."""
    servicer = BatchServiceServicer(batch_size=100)

    server = aio.server(
        options=[
            ("grpc.max_receive_message_length", 100 * 1024 * 1024),  # 100MB for file upload
        ]
    )

    # In real code:
    # pb2_grpc.add_BatchServiceServicer_to_server(servicer, server)

    server.add_insecure_port("[::]:50051")
    await server.start()

    logger.info("batch_server_started", port=50051)

    await server.wait_for_termination()


# =============================================================================
# Client Examples
# =============================================================================

async def bulk_create_example():
    """
    Example: Bulk create items via client streaming.
    """
    async with aio.insecure_channel("localhost:50051") as channel:
        # stub = pb2_grpc.BatchServiceStub(channel)

        # Generator for streaming items
        async def item_generator(count: int):
            for i in range(count):
                # yield pb2.CreateItemRequest(
                #     name=f"Item {i}",
                #     description=f"Description for item {i}",
                #     metadata={"index": str(i)},
                # )
                yield {"name": f"Item {i}", "description": f"Description {i}"}

                # Optional: Add delay to control send rate
                if i % 100 == 0:
                    await asyncio.sleep(0.01)

        # Stream 10,000 items
        # response = await stub.BulkCreate(item_generator(10000))
        # print(f"Created: {response.created_count}, Failed: {response.failed_count}")
        pass


async def file_upload_example():
    """
    Example: Upload file in chunks via client streaming.
    """
    async with aio.insecure_channel("localhost:50051") as channel:
        # stub = pb2_grpc.BatchServiceStub(channel)

        CHUNK_SIZE = 64 * 1024  # 64KB chunks

        async def chunk_generator(filepath: str):
            filename = filepath.split("/")[-1]
            offset = 0

            with open(filepath, "rb") as f:
                while True:
                    data = f.read(CHUNK_SIZE)
                    if not data:
                        break

                    is_last = len(data) < CHUNK_SIZE

                    # yield pb2.FileChunk(
                    #     filename=filename,
                    #     data=data,
                    #     offset=offset,
                    #     is_last=is_last,
                    # )
                    yield {
                        "filename": filename,
                        "data": data,
                        "offset": offset,
                        "is_last": is_last,
                    }

                    offset += len(data)

        # Upload file
        # response = await stub.UploadFile(chunk_generator("/path/to/file.zip"))
        # print(f"Uploaded: {response.file_id}, Size: {response.total_bytes}")
        pass


async def bulk_create_with_progress_example():
    """
    Example: Bulk create with real-time progress updates.
    """
    async with aio.insecure_channel("localhost:50051") as channel:
        # stub = pb2_grpc.BatchServiceStub(channel)

        async def item_generator(count: int):
            for i in range(count):
                # yield pb2.CreateItemRequest(name=f"Item {i}")
                yield {"name": f"Item {i}"}

        # Bidirectional stream
        # stream = stub.BulkCreateWithProgress(item_generator(1000))

        # async for event in stream:
        #     if event.HasField("progress"):
        #         print(f"Progress: {event.progress.processed} items")
        #     elif event.HasField("result"):
        #         if not event.result.success:
        #             print(f"Failed at index {event.result.index}: {event.result.error}")
        #     elif event.HasField("complete"):
        #         print(f"Complete: {event.complete.succeeded}/{event.complete.total}")
        pass


if __name__ == "__main__":
    asyncio.run(serve())
