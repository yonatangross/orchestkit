"""
Async gRPC Client Template with Retry and Channel Pooling

Production-ready async gRPC client using grpcio 1.60+ patterns.
Includes:
- Channel pooling with round-robin
- Automatic retry with exponential backoff
- Deadline/timeout handling
- Health checking
- Structured logging
- Context manager support

Usage:
    async with GrpcClient("localhost:50051") as client:
        stub = client.create_stub(pb2_grpc.UserServiceStub)
        response = await stub.GetUser(request, timeout=5.0)

Requirements:
    pip install grpcio>=1.60.0 grpcio-tools grpcio-health-checking structlog
"""

import asyncio
import random
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable, TypeVar

import grpc
import structlog
from grpc import aio
from grpc_health.v1 import health_pb2, health_pb2_grpc

# Generated proto imports (adjust to your project)
# from app.protos import user_service_pb2 as pb2
# from app.protos import user_service_pb2_grpc as pb2_grpc

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

T = TypeVar("T")


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class RetryConfig:
    """Configuration for retry behavior."""

    max_attempts: int = 3
    initial_delay: float = 0.1
    max_delay: float = 10.0
    exponential_base: float = 2.0
    jitter: float = 0.1

    # Status codes that should trigger retry
    retryable_codes: frozenset = field(default_factory=lambda: frozenset({
        grpc.StatusCode.UNAVAILABLE,
        grpc.StatusCode.DEADLINE_EXCEEDED,
        grpc.StatusCode.RESOURCE_EXHAUSTED,
        grpc.StatusCode.ABORTED,
    }))

    def get_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff and jitter."""
        delay = min(
            self.initial_delay * (self.exponential_base ** attempt),
            self.max_delay,
        )
        jitter_range = delay * self.jitter
        return delay + random.uniform(-jitter_range, jitter_range)


@dataclass
class ChannelConfig:
    """Configuration for gRPC channel."""

    target: str

    # Connection settings
    connect_timeout: float = 5.0
    keepalive_time_ms: int = 30000
    keepalive_timeout_ms: int = 10000
    keepalive_permit_without_calls: bool = True

    # Message limits
    max_send_message_length: int = 50 * 1024 * 1024  # 50MB
    max_receive_message_length: int = 50 * 1024 * 1024

    # Load balancing
    lb_policy: str = "round_robin"

    # TLS (None for insecure)
    credentials: grpc.ChannelCredentials | None = None

    @property
    def options(self) -> list[tuple]:
        """Get channel options."""
        return [
            ("grpc.keepalive_time_ms", self.keepalive_time_ms),
            ("grpc.keepalive_timeout_ms", self.keepalive_timeout_ms),
            ("grpc.keepalive_permit_without_calls", int(self.keepalive_permit_without_calls)),
            ("grpc.max_send_message_length", self.max_send_message_length),
            ("grpc.max_receive_message_length", self.max_receive_message_length),
            ("grpc.lb_policy_name", self.lb_policy),
            ("grpc.initial_reconnect_backoff_ms", 1000),
            ("grpc.max_reconnect_backoff_ms", 30000),
        ]


# =============================================================================
# Client Interceptors
# =============================================================================

class RetryInterceptor(aio.UnaryUnaryClientInterceptor):
    """Client interceptor for automatic retry with exponential backoff."""

    def __init__(self, config: RetryConfig):
        self._config = config

    async def intercept_unary_unary(
        self,
        continuation: Callable,
        client_call_details: aio.ClientCallDetails,
        request: Any,
    ) -> Any:
        last_error = None

        for attempt in range(self._config.max_attempts):
            try:
                return await continuation(client_call_details, request)

            except aio.AioRpcError as e:
                last_error = e

                if e.code() not in self._config.retryable_codes:
                    raise

                if attempt == self._config.max_attempts - 1:
                    logger.warning(
                        "grpc_retry_exhausted",
                        method=client_call_details.method,
                        attempts=self._config.max_attempts,
                        code=e.code().name,
                    )
                    raise

                delay = self._config.get_delay(attempt)
                logger.debug(
                    "grpc_retry",
                    method=client_call_details.method,
                    attempt=attempt + 1,
                    delay=f"{delay:.2f}s",
                    code=e.code().name,
                )
                await asyncio.sleep(delay)

        raise last_error


class LoggingInterceptor(aio.UnaryUnaryClientInterceptor):
    """Client interceptor for request/response logging."""

    async def intercept_unary_unary(
        self,
        continuation: Callable,
        client_call_details: aio.ClientCallDetails,
        request: Any,
    ) -> Any:
        start = time.perf_counter()
        method = client_call_details.method

        try:
            response = await continuation(client_call_details, request)
            duration = (time.perf_counter() - start) * 1000
            logger.info("grpc_call", method=method, duration_ms=f"{duration:.2f}", status="OK")
            return response

        except aio.AioRpcError as e:
            duration = (time.perf_counter() - start) * 1000
            logger.warning(
                "grpc_call_failed",
                method=method,
                duration_ms=f"{duration:.2f}",
                status=e.code().name,
                details=e.details(),
            )
            raise


# =============================================================================
# Channel Pool
# =============================================================================

class ChannelPool:
    """
    Pool of gRPC channels for load distribution.

    Use when connecting to multiple backend instances or
    when you need more than one channel for throughput.
    """

    def __init__(
        self,
        targets: list[str],
        config: ChannelConfig | None = None,
        interceptors: list | None = None,
    ):
        self._targets = targets
        self._config = config
        self._interceptors = interceptors or []
        self._channels: list[aio.Channel] = []
        self._index = 0
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """Create channels for all targets."""
        for target in self._targets:
            config = self._config or ChannelConfig(target=target)
            channel = await self._create_channel(target, config)
            self._channels.append(channel)
        logger.info("grpc_pool_initialized", size=len(self._channels))

    async def _create_channel(self, target: str, config: ChannelConfig) -> aio.Channel:
        """Create a single channel with interceptors."""
        if config.credentials:
            channel = aio.secure_channel(
                target,
                config.credentials,
                options=config.options,
                interceptors=self._interceptors,
            )
        else:
            channel = aio.insecure_channel(
                target,
                options=config.options,
                interceptors=self._interceptors,
            )

        # Wait for channel to be ready
        try:
            await asyncio.wait_for(
                channel.channel_ready(),
                timeout=config.connect_timeout,
            )
        except asyncio.TimeoutError:
            await channel.close()
            raise grpc.RpcError(f"Failed to connect to {target}")

        return channel

    def get_channel(self) -> aio.Channel:
        """Get next channel using round-robin."""
        if not self._channels:
            raise RuntimeError("Channel pool not initialized")

        channel = self._channels[self._index % len(self._channels)]
        self._index += 1
        return channel

    async def close(self) -> None:
        """Close all channels."""
        for channel in self._channels:
            await channel.close()
        self._channels.clear()
        logger.info("grpc_pool_closed")


# =============================================================================
# Main Client
# =============================================================================

class GrpcClient:
    """
    High-level async gRPC client with automatic retry and pooling.

    Example:
        async with GrpcClient("localhost:50051") as client:
            # Create stub
            stub = client.create_stub(pb2_grpc.UserServiceStub)

            # Make calls with automatic retry (ALWAYS set timeout!)
            user = await stub.GetUser(
                pb2.GetUserRequest(user_id="123"),
                timeout=5.0,
            )
    """

    def __init__(
        self,
        target: str | list[str],
        retry_config: RetryConfig | None = None,
        channel_config: ChannelConfig | None = None,
        enable_logging: bool = True,
    ):
        self._targets = [target] if isinstance(target, str) else target
        self._retry_config = retry_config or RetryConfig()
        self._channel_config = channel_config
        self._enable_logging = enable_logging
        self._pool: ChannelPool | None = None

    async def __aenter__(self) -> "GrpcClient":
        await self.connect()
        return self

    async def __aexit__(self, *args) -> None:
        await self.close()

    async def connect(self) -> None:
        """Initialize the channel pool."""
        interceptors = [RetryInterceptor(self._retry_config)]
        if self._enable_logging:
            interceptors.append(LoggingInterceptor())

        self._pool = ChannelPool(
            targets=self._targets,
            config=self._channel_config,
            interceptors=interceptors,
        )
        await self._pool.initialize()
        logger.info("grpc_client_connected", targets=len(self._targets))

    async def close(self) -> None:
        """Close all connections."""
        if self._pool:
            await self._pool.close()
            logger.info("grpc_client_disconnected")

    @property
    def channel(self) -> aio.Channel:
        """Get a channel from the pool."""
        if not self._pool:
            raise RuntimeError("Client not connected. Use 'async with' or call connect()")
        return self._pool.get_channel()

    def create_stub(self, stub_class: type[T]) -> T:
        """
        Create a service stub.

        Example:
            stub = client.create_stub(pb2_grpc.UserServiceStub)
        """
        return stub_class(self.channel)


# =============================================================================
# Factory Function
# =============================================================================

@asynccontextmanager
async def create_client(
    target: str | list[str],
    **kwargs,
) -> GrpcClient:
    """
    Factory function for creating gRPC client.

    Example:
        async with create_client("localhost:50051") as client:
            stub = client.create_stub(pb2_grpc.UserServiceStub)
            response = await stub.GetUser(request, timeout=5.0)
    """
    client = GrpcClient(target, **kwargs)
    try:
        await client.connect()
        yield client
    finally:
        await client.close()


# =============================================================================
# Streaming Helpers
# =============================================================================

async def collect_stream(stream_call) -> list:
    """
    Collect all items from a server stream into a list.

    Example:
        users = await collect_stream(stub.ListUsers(request))
    """
    results = []
    async for item in stream_call:
        results.append(item)
    return results


async def stream_with_timeout(
    stream_call,
    timeout: float,
    on_item: Callable | None = None,
) -> list:
    """
    Read from stream with overall timeout.

    Example:
        users = await stream_with_timeout(
            stub.ListUsers(request),
            timeout=30.0,
            on_item=lambda u: print(f"Got user: {u.id}"),
        )
    """
    results = []
    deadline = datetime.now() + timedelta(seconds=timeout)

    async for item in stream_call:
        if datetime.now() > deadline:
            stream_call.cancel()
            break
        results.append(item)
        if on_item:
            on_item(item)

    return results


async def send_stream(stub_method, items, batch_size: int = 100):
    """
    Send items through client stream with batching.

    Example:
        response = await send_stream(
            stub.BulkCreateUsers,
            user_requests,
            batch_size=100,
        )
    """
    async def item_generator():
        for i, item in enumerate(items):
            yield item
            # Add small delay between batches to prevent overwhelming server
            if (i + 1) % batch_size == 0:
                await asyncio.sleep(0.01)

    return await stub_method(item_generator())


# =============================================================================
# Health Check Utilities
# =============================================================================

async def check_health(
    channel: aio.Channel,
    service: str = "",
    timeout: float = 5.0,
) -> bool:
    """
    Check service health.

    Example:
        is_healthy = await check_health(client.channel, "user.v1.UserService")
    """
    stub = health_pb2_grpc.HealthStub(channel)
    try:
        response = await stub.Check(
            health_pb2.HealthCheckRequest(service=service),
            timeout=timeout,
        )
        return response.status == health_pb2.HealthCheckResponse.SERVING
    except aio.AioRpcError:
        return False


async def wait_for_ready(
    target: str,
    timeout: float = 30.0,
    interval: float = 1.0,
) -> bool:
    """
    Wait for service to become ready.

    Useful for integration tests and startup sequences.

    Example:
        if await wait_for_ready("localhost:50051", timeout=60):
            print("Service is ready")
    """
    deadline = datetime.now() + timedelta(seconds=timeout)

    while datetime.now() < deadline:
        try:
            async with create_client(target) as client:
                if await check_health(client.channel):
                    return True
        except Exception:
            pass
        await asyncio.sleep(interval)

    return False


# =============================================================================
# Example Usage
# =============================================================================

async def example_usage():
    """Example demonstrating client patterns."""

    # Single target
    async with GrpcClient("localhost:50051") as client:
        # Create stub
        # stub = client.create_stub(pb2_grpc.UserServiceStub)

        # Unary call with timeout (ALWAYS set timeout!)
        # user = await stub.GetUser(
        #     pb2.GetUserRequest(user_id="123"),
        #     timeout=5.0,
        # )

        # Server streaming
        # users = await collect_stream(stub.ListUsers(pb2.ListUsersRequest()))

        # Client streaming
        # response = await send_stream(
        #     stub.BulkCreateUsers,
        #     [pb2.CreateUserRequest(...) for _ in range(100)],
        # )

        # Health check
        is_healthy = await check_health(client.channel)
        print(f"Service healthy: {is_healthy}")

    # Multiple targets (load balanced)
    targets = [
        "user-service-1:50051",
        "user-service-2:50051",
        "user-service-3:50051",
    ]

    async with GrpcClient(targets) as client:
        # Requests will be distributed across all targets
        pass

    # Wait for service to be ready (useful in tests)
    if await wait_for_ready("localhost:50051", timeout=10):
        print("Service is ready!")


if __name__ == "__main__":
    asyncio.run(example_usage())
