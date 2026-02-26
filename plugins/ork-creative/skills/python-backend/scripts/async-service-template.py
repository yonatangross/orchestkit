"""
Async Service Template

A production-ready async service with:
- Structured concurrency (TaskGroup)
- Graceful shutdown
- Health checks
- Rate limiting
- Proper error handling
"""

import asyncio
import logging
import signal
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ServiceConfig:
    """Service configuration."""

    max_concurrent_tasks: int = 10
    task_timeout_seconds: float = 30.0
    health_check_interval: float = 30.0
    shutdown_timeout: float = 30.0


class AsyncService:
    """
    Production async service template.

    Usage:
        service = AsyncService(config)
        await service.run(task_handler=process_job)
    """

    def __init__(self, config: ServiceConfig):
        self.config = config
        self._semaphore = asyncio.Semaphore(config.max_concurrent_tasks)
        self._shutdown_event = asyncio.Event()
        self._healthy = True

    async def run(self, task_handler: Callable[[Any], Awaitable[None]]) -> None:
        """Main entry point - run until shutdown signal."""
        loop = asyncio.get_running_loop()

        # Register signal handlers
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(
                sig, lambda s=sig: asyncio.create_task(self._handle_signal(s))
            )

        logger.info("Service starting...")

        try:
            async with asyncio.TaskGroup() as tg:
                tg.create_task(self._worker_loop(task_handler))
                tg.create_task(self._health_check_loop())
                tg.create_task(self._shutdown_waiter())
        except* asyncio.CancelledError:
            logger.info("Service tasks cancelled")

        logger.info("Service stopped")

    async def _handle_signal(self, sig: signal.Signals) -> None:
        """Handle shutdown signal gracefully."""
        logger.info(f"Received signal {sig.name}, initiating shutdown...")
        self._shutdown_event.set()

    async def _shutdown_waiter(self) -> None:
        """Wait for shutdown and cancel other tasks."""
        await self._shutdown_event.wait()
        raise asyncio.CancelledError()

    async def _worker_loop(
        self,
        handler: Callable[[Any], Awaitable[None]],
    ) -> None:
        """Main worker loop - process tasks with rate limiting."""
        while not self._shutdown_event.is_set():
            try:
                # Get next task (implement your queue logic)
                task = await self._get_next_task()
                if task is None:
                    await asyncio.sleep(1)
                    continue

                # Process with concurrency limiting and timeout
                async with self._semaphore:
                    try:
                        async with asyncio.timeout(self.config.task_timeout_seconds):
                            await handler(task)
                    except TimeoutError:
                        logger.warning(f"Task timed out: {task}")
                    except Exception:
                        logger.exception(f"Task failed: {task}")

            except asyncio.CancelledError:
                logger.info("Worker loop cancelled, finishing current task...")
                raise

    async def _get_next_task(self) -> Any | None:
        """Get next task from queue. Override this method."""
        # Implement your task fetching logic
        # e.g., from Redis, RabbitMQ, database, etc.
        raise NotImplementedError("Override _get_next_task()")

    async def _health_check_loop(self) -> None:
        """Periodic health checks."""
        while not self._shutdown_event.is_set():
            try:
                await asyncio.sleep(self.config.health_check_interval)
                self._healthy = await self._check_health()
                if not self._healthy:
                    logger.warning("Health check failed")
            except asyncio.CancelledError:
                raise

    async def _check_health(self) -> bool:
        """Check service health. Override for custom checks."""
        return True

    @property
    def is_healthy(self) -> bool:
        """Current health status."""
        return self._healthy and not self._shutdown_event.is_set()


# Example implementation
class MyService(AsyncService):
    """Example service implementation."""

    def __init__(self, config: ServiceConfig, queue_url: str):
        super().__init__(config)
        self.queue_url = queue_url
        self._queue: asyncio.Queue[dict] = asyncio.Queue()

    async def _get_next_task(self) -> dict | None:
        try:
            return await asyncio.wait_for(
                self._queue.get(),
                timeout=5.0,
            )
        except TimeoutError:
            return None

    async def _check_health(self) -> bool:
        # Check queue connection, database, etc.
        return self._queue.qsize() < 1000


async def process_job(job: dict) -> None:
    """Example task handler."""
    logger.info(f"Processing job: {job['id']}")
    await asyncio.sleep(1)  # Simulate work
    logger.info(f"Completed job: {job['id']}")


async def main() -> None:
    config = ServiceConfig(
        max_concurrent_tasks=10,
        task_timeout_seconds=30.0,
    )
    service = MyService(config, queue_url="redis://localhost")
    await service.run(task_handler=process_job)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
