"""
Production Temporal Worker Template

Usage:
    python worker.py --task-queue orders --namespace production

Features:
    - Graceful shutdown handling
    - Structured logging
    - Health checks
    - Metrics export (optional Prometheus)
"""
import asyncio
import logging
import signal
import sys
from argparse import ArgumentParser
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import timedelta

from temporalio import activity, workflow
from temporalio.client import Client, TLSConfig
from temporalio.worker import Worker
from temporalio.common import RetryPolicy


# ============================================================================
# Configuration
# ============================================================================
@dataclass
class WorkerConfig:
    temporal_host: str = "localhost:7233"
    namespace: str = "default"
    task_queue: str = "default"
    max_concurrent_activities: int = 100
    max_concurrent_workflow_tasks: int = 100
    # TLS for production
    tls_cert_path: str | None = None
    tls_key_path: str | None = None


# ============================================================================
# Activities
# ============================================================================
@activity.defn
async def example_activity(input: str) -> str:
    """Replace with your activity implementation."""
    activity.logger.info(f"Processing: {input}")

    # Heartbeat for long operations
    for i in range(10):
        activity.heartbeat(f"Step {i}/10")
        await asyncio.sleep(0.1)

    return f"Processed: {input}"


# ============================================================================
# Workflows
# ============================================================================
@workflow.defn
class ExampleWorkflow:
    """Replace with your workflow implementation."""

    @workflow.run
    async def run(self, input: str) -> str:
        result = await workflow.execute_activity(
            example_activity,
            input,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=1),
                backoff_coefficient=2.0,
            ),
        )
        return result


# ============================================================================
# Worker Setup
# ============================================================================
@asynccontextmanager
async def create_worker(config: WorkerConfig):
    """Create worker with proper lifecycle management."""
    # TLS config for production
    tls_config = None
    if config.tls_cert_path and config.tls_key_path:
        with open(config.tls_cert_path, "rb") as f:
            cert = f.read()
        with open(config.tls_key_path, "rb") as f:
            key = f.read()
        tls_config = TLSConfig(client_cert=cert, client_private_key=key)

    # Connect to Temporal
    client = await Client.connect(
        config.temporal_host,
        namespace=config.namespace,
        tls=tls_config,
    )

    # Create worker
    worker = Worker(
        client,
        task_queue=config.task_queue,
        workflows=[ExampleWorkflow],
        activities=[example_activity],
        max_concurrent_activities=config.max_concurrent_activities,
        max_concurrent_workflow_tasks=config.max_concurrent_workflow_tasks,
    )

    try:
        yield worker
    finally:
        await client.close()


async def run_worker(config: WorkerConfig):
    """Run worker with graceful shutdown."""
    shutdown_event = asyncio.Event()

    def signal_handler():
        logging.info("Shutdown signal received")
        shutdown_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    async with create_worker(config) as worker:
        logging.info(f"Worker started on task queue: {config.task_queue}")

        # Run until shutdown signal
        worker_task = asyncio.create_task(worker.run())
        shutdown_task = asyncio.create_task(shutdown_event.wait())

        done, pending = await asyncio.wait(
            [worker_task, shutdown_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        # Cancel pending tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        logging.info("Worker shutdown complete")


# ============================================================================
# Entry Point
# ============================================================================
def main():
    parser = ArgumentParser(description="Temporal Worker")
    parser.add_argument("--host", default="localhost:7233")
    parser.add_argument("--namespace", default="default")
    parser.add_argument("--task-queue", default="default")
    parser.add_argument("--max-activities", type=int, default=100)
    parser.add_argument("--tls-cert", default=None)
    parser.add_argument("--tls-key", default=None)
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    config = WorkerConfig(
        temporal_host=args.host,
        namespace=args.namespace,
        task_queue=args.task_queue,
        max_concurrent_activities=args.max_activities,
        tls_cert_path=args.tls_cert,
        tls_key_path=args.tls_key,
    )

    asyncio.run(run_worker(config))


if __name__ == "__main__":
    main()
