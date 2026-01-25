# gRPC Health Check Setup (Python 3.11+ Async)

Standard gRPC health checking for Kubernetes and load balancers.

## Installation

```bash
pip install grpcio-health-checking
```

## Basic Async Setup

```python
import grpc.aio
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

async def create_server():
    server = grpc.aio.server()

    # Add your services
    pb2_grpc.add_UserServiceServicer_to_server(UserServiceServicer(), server)

    # Add health service
    health_servicer = health.aio.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)

    # Set initial status
    await health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    await health_servicer.set("user.v1.UserService", health_pb2.HealthCheckResponse.SERVING)

    server.add_insecure_port("[::]:50051")
    return server, health_servicer
```

## Dynamic Health Manager

```python
class AsyncHealthManager:
    def __init__(self, health_servicer):
        self.health = health_servicer
        self.checks: dict[str, Callable[[], Awaitable[bool]]] = {}

    def register(self, name: str, check_fn):
        self.checks[name] = check_fn

    async def run_checks(self) -> bool:
        all_ok = True
        for name, check in self.checks.items():
            try:
                ok = await asyncio.wait_for(check(), timeout=5.0)
                status = health_pb2.HealthCheckResponse.SERVING if ok else health_pb2.HealthCheckResponse.NOT_SERVING
            except Exception:
                status = health_pb2.HealthCheckResponse.NOT_SERVING
                ok = False
            await self.health.set(name, status)
            all_ok &= ok

        overall = health_pb2.HealthCheckResponse.SERVING if all_ok else health_pb2.HealthCheckResponse.NOT_SERVING
        await self.health.set("", overall)
        return all_ok

# Usage
manager = AsyncHealthManager(health_servicer)
manager.register("database", lambda: db.execute("SELECT 1"))
manager.register("redis", lambda: redis.ping())

async def health_loop():
    while True:
        await manager.run_checks()
        await asyncio.sleep(10)
```

## Kubernetes Config

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: app
        livenessProbe:
          grpc:
            port: 50051
            service: ""
          periodSeconds: 10
        readinessProbe:
          grpc:
            port: 50051
            service: "user.v1.UserService"
          periodSeconds: 5
```

## Graceful Shutdown

```python
async def shutdown(server, health_servicer):
    # Mark unhealthy (stop new traffic)
    await health_servicer.set("", health_pb2.HealthCheckResponse.NOT_SERVING)

    # Wait for in-flight requests (30s grace)
    await server.stop(30)
```

## Client Health Check

```python
async def check_health(channel, service: str = "") -> bool:
    stub = health_pb2_grpc.HealthStub(channel)
    try:
        response = await stub.Check(health_pb2.HealthCheckRequest(service=service), timeout=5.0)
        return response.status == health_pb2.HealthCheckResponse.SERVING
    except grpc.aio.AioRpcError:
        return False
```

## Health Status Values

| Status | Meaning |
|--------|---------|
| SERVING | Ready for traffic |
| NOT_SERVING | Unhealthy |
| UNKNOWN | Not registered |
