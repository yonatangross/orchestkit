"""
Message Queue Consumer Template

A production-ready, copy-paste template for implementing message queue consumers.
Supports RabbitMQ (aio-pika) with retry, backoff, and graceful shutdown.

Usage:
    1. Copy this file to your project
    2. Implement your message handler in `handle_message()`
    3. Configure connection settings
    4. Run with: python queue_consumer.py
"""

import asyncio
import json
import logging
import signal
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, UTC
from typing import Generic, TypeVar

import aio_pika
from aio_pika import DeliveryMode, IncomingMessage, Message

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class ConsumerConfig:
    """Consumer configuration with sensible defaults."""

    # Connection
    rabbitmq_url: str = "amqp://guest:guest@localhost/"
    queue_name: str = "tasks"

    # Processing
    prefetch_count: int = 10
    max_retries: int = 3

    # Retry backoff (exponential)
    initial_delay_ms: int = 1000
    max_delay_ms: int = 30000
    backoff_multiplier: float = 2.0

    # Graceful shutdown
    shutdown_timeout_seconds: int = 30


# =============================================================================
# Base Consumer Class
# =============================================================================

T = TypeVar("T")


class BaseConsumer(ABC, Generic[T]):
    """
    Abstract base class for message consumers.

    Subclass and implement:
        - parse_message(body: bytes) -> T
        - handle_message(message: T) -> None
        - is_retriable_error(error: Exception) -> bool
    """

    def __init__(self, config: ConsumerConfig):
        self.config = config
        self._connection: aio_pika.RobustConnection | None = None
        self._channel: aio_pika.Channel | None = None
        self._should_stop = asyncio.Event()
        self._active_tasks: set[asyncio.Task] = set()

    # -------------------------------------------------------------------------
    # Abstract methods - implement these
    # -------------------------------------------------------------------------

    @abstractmethod
    def parse_message(self, body: bytes) -> T:
        """Parse raw message bytes into your domain object."""
        pass

    @abstractmethod
    async def handle_message(self, message: T) -> None:
        """Process the parsed message. Raise exception on failure."""
        pass

    def is_retriable_error(self, error: Exception) -> bool:
        """Return True if the error should trigger a retry."""
        # Override to customize retry logic
        non_retriable = (
            json.JSONDecodeError,
            ValueError,
            KeyError,
        )
        return not isinstance(error, non_retriable)

    # -------------------------------------------------------------------------
    # Connection management
    # -------------------------------------------------------------------------

    async def connect(self) -> None:
        """Establish connection with automatic reconnection."""
        logger.info(f"Connecting to RabbitMQ: {self.config.queue_name}")

        self._connection = await aio_pika.connect_robust(
            self.config.rabbitmq_url,
            reconnect_interval=5,
            fail_fast=False
        )
        self._connection.add_close_callback(self._on_connection_close)

        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=self.config.prefetch_count)

        logger.info("Connected to RabbitMQ")

    def _on_connection_close(self, *args):
        logger.warning("RabbitMQ connection closed")

    async def close(self) -> None:
        """Clean shutdown with timeout."""
        logger.info("Shutting down consumer...")

        # Wait for active tasks
        if self._active_tasks:
            logger.info(f"Waiting for {len(self._active_tasks)} active tasks...")
            done, pending = await asyncio.wait(
                self._active_tasks,
                timeout=self.config.shutdown_timeout_seconds
            )

            if pending:
                logger.warning(f"Cancelling {len(pending)} stuck tasks")
                for task in pending:
                    task.cancel()

        if self._connection:
            await self._connection.close()

        logger.info("Consumer shutdown complete")

    # -------------------------------------------------------------------------
    # Message processing
    # -------------------------------------------------------------------------

    async def start(self) -> None:
        """Start consuming messages."""
        await self.connect()

        assert self._channel is not None, "Channel not initialized"
        queue = await self._channel.get_queue(self.config.queue_name)

        logger.info(f"Starting to consume from: {self.config.queue_name}")

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                if self._should_stop.is_set():
                    break

                task = asyncio.create_task(self._process_message(message))
                self._active_tasks.add(task)
                task.add_done_callback(self._active_tasks.discard)

    async def _process_message(self, message: IncomingMessage) -> None:
        """Process single message with retry logic."""
        correlation_id = message.correlation_id or message.message_id or "unknown"

        async with message.process(requeue=False):
            try:
                # Parse message
                parsed = self.parse_message(message.body)

                logger.info(
                    "Processing message",
                    extra={"correlation_id": correlation_id}
                )

                # Handle message
                await self.handle_message(parsed)

                logger.info(
                    "Message processed successfully",
                    extra={"correlation_id": correlation_id}
                )

            except Exception as e:
                await self._handle_error(message, e, correlation_id)

    async def _handle_error(
        self,
        message: IncomingMessage,
        error: Exception,
        correlation_id: str
    ) -> None:
        """Handle processing error with retry or DLQ routing."""
        retry_count = message.headers.get("x-retry-count", 0) if message.headers else 0

        logger.error(
            f"Error processing message: {error}",
            extra={
                "correlation_id": correlation_id,
                "retry_count": retry_count,
                "error_type": type(error).__name__
            }
        )

        if self.is_retriable_error(error) and retry_count < self.config.max_retries:
            await self._retry_message(message, retry_count + 1, str(error))
        else:
            # Let RabbitMQ route to DLX (configured on queue)
            logger.warning(
                "Message exhausted retries, routing to DLQ",
                extra={"correlation_id": correlation_id}
            )
            # Message will be rejected and routed to DLX when context exits

    async def _retry_message(
        self,
        message: IncomingMessage,
        retry_count: int,
        error_message: str
    ) -> None:
        """Republish message for retry with backoff delay."""
        delay = self._calculate_delay(retry_count)

        logger.info(
            f"Scheduling retry {retry_count}/{self.config.max_retries} "
            f"with {delay}ms delay"
        )

        # Simple delay (for proper implementation, use delay exchanges)
        await asyncio.sleep(delay / 1000)

        # Republish to same queue
        new_message = Message(
            body=message.body,
            delivery_mode=DeliveryMode.PERSISTENT,
            content_type=message.content_type,
            correlation_id=message.correlation_id,
            headers={
                **(dict(message.headers) if message.headers else {}),
                "x-retry-count": retry_count,
                "x-last-error": error_message,
                "x-retry-timestamp": datetime.now(UTC).isoformat()
            }
        )

        assert self._channel is not None, "Channel not initialized"
        exchange = await self._channel.get_exchange("")  # Default exchange
        await exchange.publish(new_message, routing_key=self.config.queue_name)

    def _calculate_delay(self, retry_count: int) -> int:
        """Calculate exponential backoff delay with jitter."""
        import random

        delay = self.config.initial_delay_ms * (
            self.config.backoff_multiplier ** (retry_count - 1)
        )
        delay = min(delay, self.config.max_delay_ms)

        # Add jitter (0.5 to 1.5 multiplier)
        jitter = random.uniform(0.5, 1.5)
        return int(delay * jitter)

    # -------------------------------------------------------------------------
    # Lifecycle
    # -------------------------------------------------------------------------

    def stop(self) -> None:
        """Signal consumer to stop gracefully."""
        logger.info("Stop signal received")
        self._should_stop.set()


# =============================================================================
# Example Implementation
# =============================================================================

@dataclass
class OrderMessage:
    """Example message type."""
    order_id: str
    customer_id: str
    items: list[dict]
    total: float


class OrderConsumer(BaseConsumer[OrderMessage]):
    """Example consumer for order processing."""

    def parse_message(self, body: bytes) -> OrderMessage:
        data = json.loads(body.decode())
        return OrderMessage(
            order_id=data["order_id"],
            customer_id=data["customer_id"],
            items=data["items"],
            total=data["total"]
        )

    async def handle_message(self, message: OrderMessage) -> None:
        """Process order - implement your business logic here."""
        logger.info(f"Processing order: {message.order_id}")

        # Simulate processing
        await asyncio.sleep(0.1)

        # Your business logic:
        # - Validate inventory
        # - Process payment
        # - Send confirmation email
        # - Update database

        logger.info(f"Order {message.order_id} processed successfully")

    def is_retriable_error(self, error: Exception) -> bool:
        """Customize retry logic for order processing."""
        # Don't retry validation errors
        if "validation" in str(error).lower():
            return False
        # Don't retry payment declined
        if "payment declined" in str(error).lower():
            return False
        # Retry everything else (network, timeout, etc.)
        return True


# =============================================================================
# Main Entry Point
# =============================================================================

async def main():
    """Run the consumer with graceful shutdown."""
    config = ConsumerConfig(
        rabbitmq_url="amqp://guest:guest@localhost/",
        queue_name="orders",
        prefetch_count=10,
        max_retries=3
    )

    consumer = OrderConsumer(config)

    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, consumer.stop)

    try:
        await consumer.start()
    except asyncio.CancelledError:
        pass
    finally:
        await consumer.close()


if __name__ == "__main__":
    asyncio.run(main())
