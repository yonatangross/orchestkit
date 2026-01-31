"""
Async gRPC Server Template with Graceful Shutdown

Production-ready async gRPC server using grpcio 1.60+ patterns.
Includes:
- Graceful shutdown with drain timeout
- Health check service
- Reflection for debugging
- Structured logging
- Signal handling
- Interceptor support

Usage:
    python grpc-server-template.py

    # Or as module
    from grpc_server_template import serve
    asyncio.run(serve())

Requirements:
    pip install grpcio>=1.60.0 grpcio-tools grpcio-health-checking grpcio-reflection structlog
"""

import asyncio
import logging
import signal
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import grpc
import structlog
from google.protobuf.timestamp_pb2 import Timestamp
from grpc import aio
from grpc_health.v1 import health, health_pb2, health_pb2_grpc
from grpc_reflection.v1alpha import reflection

# Generated proto imports (adjust to your project)
# from app.protos import your_service_pb2 as pb2
# from app.protos import your_service_pb2_grpc as pb2_grpc

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class ServerConfig:
    """Server configuration with sensible defaults."""

    host: str = "[::]:50051"
    max_workers: int = 10
    max_concurrent_rpcs: int = 100
    max_send_message_length: int = 50 * 1024 * 1024  # 50MB
    max_receive_message_length: int = 50 * 1024 * 1024
    keepalive_time_ms: int = 30000
    keepalive_timeout_ms: int = 10000
    drain_timeout: float = 30.0
    enable_reflection: bool = True

    @property
    def server_options(self) -> list[tuple]:
        """Get gRPC server options."""
        return [
            ("grpc.max_send_message_length", self.max_send_message_length),
            ("grpc.max_receive_message_length", self.max_receive_message_length),
            ("grpc.keepalive_time_ms", self.keepalive_time_ms),
            ("grpc.keepalive_timeout_ms", self.keepalive_timeout_ms),
            ("grpc.keepalive_permit_without_calls", True),
            ("grpc.http2.max_pings_without_data", 0),
            ("grpc.max_concurrent_streams", self.max_concurrent_rpcs),
        ]


# =============================================================================
# Graceful Shutdown Handler
# =============================================================================

class GracefulShutdown:
    """Manages graceful shutdown with configurable drain period."""

    def __init__(self, drain_timeout: float = 30.0):
        self._drain_timeout = drain_timeout
        self._shutdown_event = asyncio.Event()

    @property
    def is_shutting_down(self) -> bool:
        return self._shutdown_event.is_set()

    def trigger_shutdown(self) -> None:
        """Signal that shutdown should begin."""
        self._shutdown_event.set()

    async def wait_for_shutdown(self) -> None:
        """Wait until shutdown is triggered."""
        await self._shutdown_event.wait()


# =============================================================================
# Server Interceptors
# =============================================================================

class LoggingInterceptor(aio.ServerInterceptor):
    """Log all incoming requests with timing."""

    async def intercept_service(
        self,
        continuation,
        handler_call_details: grpc.HandlerCallDetails,
    ):
        method = handler_call_details.method
        start = datetime.now()
        log = logger.bind(method=method)

        handler = await continuation(handler_call_details)

        # Wrap unary-unary handlers
        if handler and handler.unary_unary:
            original = handler.unary_unary

            async def logged_handler(request, context):
                try:
                    response = await original(request, context)
                    duration = (datetime.now() - start).total_seconds() * 1000
                    log.info("grpc_request", duration_ms=duration, status="OK")
                    return response
                except Exception as e:
                    duration = (datetime.now() - start).total_seconds() * 1000
                    log.error("grpc_request", duration_ms=duration, error=str(e))
                    raise

            return grpc.unary_unary_rpc_method_handler(
                logged_handler,
                request_deserializer=handler.request_deserializer,
                response_serializer=handler.response_serializer,
            )

        return handler


class MetricsInterceptor(aio.ServerInterceptor):
    """Collect request metrics (integrate with Prometheus)."""

    def __init__(self):
        self.request_count = 0
        self.error_count = 0

    async def intercept_service(
        self,
        continuation,
        handler_call_details: grpc.HandlerCallDetails,
    ):
        self.request_count += 1
        # Integrate with prometheus_client here
        return await continuation(handler_call_details)


# =============================================================================
# Base Servicer with Shutdown Awareness
# =============================================================================

class AsyncServicer:
    """
    Base servicer with graceful shutdown awareness.

    Extend this class for your service implementations.
    """

    def __init__(self, shutdown: GracefulShutdown):
        self._shutdown = shutdown

    def _check_shutdown(self, context: aio.ServicerContext) -> bool:
        """Check if server is shutting down or request cancelled."""
        if self._shutdown.is_shutting_down:
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details("Server is shutting down")
            return True
        if not context.is_active():
            return True
        return False


# =============================================================================
# Example Service Implementation
# =============================================================================

class ExampleServiceServicer(AsyncServicer):
    """
    Example async servicer demonstrating patterns.

    Replace this with your actual service implementation.
    Inherit from both AsyncServicer and your generated pb2_grpc.*Servicer.
    """

    def __init__(self, shutdown: GracefulShutdown, repository=None):
        super().__init__(shutdown)
        self.repo = repository

    async def GetItem(
        self,
        request,  # pb2.GetItemRequest
        context: aio.ServicerContext,
    ):
        """Unary RPC with timeout and cancellation handling."""
        if self._check_shutdown(context):
            return

        log = logger.bind(method="GetItem")

        try:
            # Validate request
            if not hasattr(request, 'item_id') or not request.item_id:
                await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "item_id is required")

            # Simulate async database call
            # item = await self.repo.get(request.item_id)
            await asyncio.sleep(0.01)  # Simulated latency

            log.info("item_retrieved")
            # return pb2.Item(id=request.item_id, name="Example")

        except asyncio.CancelledError:
            log.warning("request_cancelled")
            raise
        except Exception as e:
            log.exception("get_item_failed", error=str(e))
            await context.abort(grpc.StatusCode.INTERNAL, str(e))

    async def ListItems(
        self,
        request,  # pb2.ListItemsRequest
        context: aio.ServicerContext,
    ) -> AsyncIterator:
        """Server streaming with backpressure awareness."""
        log = logger.bind(method="ListItems")
        page_size = getattr(request, 'page_size', 100) or 100
        count = 0

        # Simulate streaming from database
        for i in range(page_size):
            if self._check_shutdown(context):
                log.warning("stream_interrupted_shutdown", count=count)
                return

            # Check for client cancellation
            if not context.is_active():
                log.warning("stream_cancelled", count=count)
                return

            # Yield items
            # yield pb2.Item(id=str(i), name=f"Item {i}")
            count += 1
            await asyncio.sleep(0.001)  # Simulate work

        log.info("stream_completed", count=count)

    async def CreateItems(
        self,
        request_iterator: AsyncIterator,
        context: aio.ServicerContext,
    ):
        """Client streaming with batch processing."""
        log = logger.bind(method="CreateItems")
        items_created = 0
        errors = []

        async for request in request_iterator:
            if self._check_shutdown(context):
                break

            try:
                # Process each item
                # await self.repo.create(...)
                items_created += 1
            except Exception as e:
                errors.append(str(e))

        log.info("bulk_create_completed", created=items_created, errors=len(errors))
        # return pb2.CreateItemsResponse(created_count=items_created, errors=errors)

    async def ItemUpdates(
        self,
        request_iterator: AsyncIterator,
        context: aio.ServicerContext,
    ) -> AsyncIterator:
        """Bidirectional streaming with subscription pattern."""
        log = logger.bind(method="ItemUpdates")
        subscriptions: set[str] = set()

        async def receive_requests():
            """Process incoming subscription changes."""
            async for request in request_iterator:
                if hasattr(request, 'subscribe') and request.HasField("subscribe"):
                    subscriptions.add(request.subscribe)
                    log.debug("subscribed", item_id=request.subscribe)
                elif hasattr(request, 'unsubscribe') and request.HasField("unsubscribe"):
                    subscriptions.discard(request.unsubscribe)
                    log.debug("unsubscribed", item_id=request.unsubscribe)

        # Start receiving in background
        receive_task = asyncio.create_task(receive_requests())

        try:
            # Stream updates for subscribed items
            while not self._check_shutdown(context):
                await asyncio.sleep(1)  # Poll interval

                # Check for updates and yield
                # for item_id in subscriptions:
                #     if has_update(item_id):
                #         yield pb2.Item(id=item_id, ...)

        except asyncio.CancelledError:
            log.info("bidirectional_stream_cancelled")
        finally:
            receive_task.cancel()
            try:
                await receive_task
            except asyncio.CancelledError:
                pass


# =============================================================================
# Server Lifecycle Management
# =============================================================================

class GrpcServer:
    """Async gRPC server with health checks and graceful shutdown."""

    def __init__(self, config: ServerConfig | None = None):
        self.config = config or ServerConfig()
        self.server: aio.Server | None = None
        self.health_servicer: health.HealthServicer | None = None
        self.shutdown = GracefulShutdown(drain_timeout=self.config.drain_timeout)

    async def start(self, services: list[tuple[Any, Any]] | None = None):
        """
        Start the gRPC server.

        Args:
            services: List of (servicer_instance, add_to_server_func) tuples
        """
        # Create server with interceptors
        interceptors = [LoggingInterceptor(), MetricsInterceptor()]

        self.server = aio.server(
            options=self.config.server_options,
            maximum_concurrent_rpcs=self.config.max_concurrent_rpcs,
            interceptors=interceptors,
        )

        # Add custom services
        if services:
            for servicer, add_func in services:
                add_func(servicer, self.server)

        # Add health service (required for Kubernetes/load balancers)
        self.health_servicer = health.HealthServicer()
        health_pb2_grpc.add_HealthServicer_to_server(self.health_servicer, self.server)

        # Set initial health status
        self._set_serving()

        # Enable reflection for debugging (grpcurl, grpc_cli)
        if self.config.enable_reflection:
            service_names = (
                health_pb2.DESCRIPTOR.services_by_name['Health'].full_name,
                reflection.SERVICE_NAME,
            )
            reflection.enable_server_reflection(service_names, self.server)

        # Bind to port
        self.server.add_insecure_port(self.config.host)

        await self.server.start()
        logger.info("grpc_server_started", host=self.config.host)

    async def stop(self):
        """Graceful shutdown sequence."""
        if not self.server:
            return

        logger.info("grpc_server_stopping", drain_timeout=self.config.drain_timeout)

        # 1. Mark as not serving (stop accepting new connections)
        self._set_not_serving()

        # 2. Wait for drain period
        await self.server.stop(self.config.drain_timeout)

        logger.info("grpc_server_stopped")

    async def wait_for_termination(self):
        """Wait until server terminates."""
        if self.server:
            await self.server.wait_for_termination()

    def _set_serving(self):
        """Mark all services as serving."""
        if self.health_servicer:
            self.health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
            # Add your service names:
            # self.health_servicer.set("your.v1.Service", health_pb2.HealthCheckResponse.SERVING)

    def _set_not_serving(self):
        """Mark all services as not serving."""
        if self.health_servicer:
            self.health_servicer.set("", health_pb2.HealthCheckResponse.NOT_SERVING)


@asynccontextmanager
async def create_server(config: ServerConfig | None = None):
    """
    Create and manage gRPC server lifecycle.

    Usage:
        async with create_server() as server:
            await server.shutdown.wait_for_shutdown()
    """
    server = GrpcServer(config)
    try:
        # Add your services here:
        # services = [
        #     (ExampleServiceServicer(server.shutdown), pb2_grpc.add_ExampleServiceServicer_to_server),
        # ]
        # await server.start(services)
        await server.start()
        yield server
    finally:
        await server.stop()


# =============================================================================
# Main Entry Point
# =============================================================================

async def serve(config: ServerConfig | None = None):
    """
    Main entry point for running the gRPC server.

    Handles signal-based graceful shutdown (SIGTERM, SIGINT).
    """
    config = config or ServerConfig()

    async with create_server(config) as server:
        # Setup signal handlers for graceful shutdown
        loop = asyncio.get_running_loop()

        def signal_handler(sig: signal.Signals):
            logger.info("shutdown_signal_received", signal=sig.name)
            server.shutdown.trigger_shutdown()

        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda s=sig: signal_handler(s))

        # Wait for shutdown signal
        await server.shutdown.wait_for_shutdown()


if __name__ == "__main__":
    asyncio.run(serve())
