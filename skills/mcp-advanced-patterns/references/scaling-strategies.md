# MCP Scaling Strategies

Patterns for horizontally scaling MCP servers with load balancing and health checks.

## Load Balancer Implementation

```python
import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any
import random
import structlog

logger = structlog.get_logger()


class LoadBalancingStrategy(Enum):
    ROUND_ROBIN = "round_robin"
    RANDOM = "random"
    LEAST_CONNECTIONS = "least_connections"
    WEIGHTED = "weighted"


@dataclass
class ServerInstance:
    """MCP server instance metadata."""
    url: str
    weight: int = 1
    healthy: bool = True
    active_connections: int = 0
    last_health_check: datetime | None = None
    last_error: str | None = None
    consecutive_failures: int = 0


class MCPLoadBalancer:
    """Production-ready load balancer for MCP servers."""

    def __init__(
        self,
        servers: list[str | dict],
        strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN,
        health_check_interval: float = 30.0,
        unhealthy_threshold: int = 3,
        healthy_threshold: int = 2,
    ):
        self.strategy = strategy
        self.health_check_interval = health_check_interval
        self.unhealthy_threshold = unhealthy_threshold
        self.healthy_threshold = healthy_threshold

        # Parse server configs
        self.servers: dict[str, ServerInstance] = {}
        for server in servers:
            if isinstance(server, str):
                self.servers[server] = ServerInstance(url=server)
            else:
                url = server["url"]
                self.servers[url] = ServerInstance(
                    url=url,
                    weight=server.get("weight", 1)
                )

        self._round_robin_index = 0
        self._lock = asyncio.Lock()
        self._health_check_task: asyncio.Task | None = None
        self._consecutive_successes: dict[str, int] = {
            url: 0 for url in self.servers
        }

    async def start(self) -> None:
        """Start health check background task."""
        self._health_check_task = asyncio.create_task(
            self._health_check_loop()
        )
        logger.info(
            "load_balancer_started",
            server_count=len(self.servers),
            strategy=self.strategy.value
        )

    async def stop(self) -> None:
        """Stop health check task."""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass

    async def get_server(self) -> ServerInstance:
        """Get next healthy server based on strategy."""
        async with self._lock:
            healthy = [s for s in self.servers.values() if s.healthy]

            if not healthy:
                raise RuntimeError("No healthy MCP servers available")

            if self.strategy == LoadBalancingStrategy.ROUND_ROBIN:
                server = healthy[self._round_robin_index % len(healthy)]
                self._round_robin_index += 1

            elif self.strategy == LoadBalancingStrategy.RANDOM:
                server = random.choice(healthy)

            elif self.strategy == LoadBalancingStrategy.LEAST_CONNECTIONS:
                server = min(healthy, key=lambda s: s.active_connections)

            elif self.strategy == LoadBalancingStrategy.WEIGHTED:
                # Weighted random selection
                total_weight = sum(s.weight for s in healthy)
                r = random.uniform(0, total_weight)
                cumulative = 0
                for s in healthy:
                    cumulative += s.weight
                    if r <= cumulative:
                        server = s
                        break
                else:
                    server = healthy[-1]

            server.active_connections += 1
            return server

    async def release_server(self, server: ServerInstance) -> None:
        """Release server connection."""
        async with self._lock:
            if server.url in self.servers:
                self.servers[server.url].active_connections = max(
                    0, server.active_connections - 1
                )

    async def _health_check_loop(self) -> None:
        """Continuously check server health."""
        while True:
            await asyncio.sleep(self.health_check_interval)
            await self._run_health_checks()

    async def _run_health_checks(self) -> None:
        """Check health of all servers."""
        tasks = [
            self._check_server_health(url)
            for url in self.servers
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _check_server_health(self, url: str) -> None:
        """Check single server health."""
        server = self.servers[url]

        try:
            healthy = await self._ping_server(url)
            server.last_health_check = datetime.now()

            if healthy:
                server.consecutive_failures = 0
                self._consecutive_successes[url] += 1

                # Mark healthy after threshold consecutive successes
                if (
                    not server.healthy
                    and self._consecutive_successes[url] >= self.healthy_threshold
                ):
                    server.healthy = True
                    server.last_error = None
                    logger.info("server_recovered", url=url)

            else:
                raise RuntimeError("Health check returned unhealthy")

        except Exception as e:
            server.consecutive_failures += 1
            self._consecutive_successes[url] = 0
            server.last_error = str(e)

            # Mark unhealthy after threshold consecutive failures
            if (
                server.healthy
                and server.consecutive_failures >= self.unhealthy_threshold
            ):
                server.healthy = False
                logger.warning(
                    "server_unhealthy",
                    url=url,
                    error=str(e),
                    consecutive_failures=server.consecutive_failures
                )

    async def _ping_server(self, url: str) -> bool:
        """Ping MCP server health endpoint."""
        import aiohttp

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{url}/health",
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                return response.status == 200

    def get_status(self) -> dict:
        """Get load balancer status."""
        return {
            "strategy": self.strategy.value,
            "servers": [
                {
                    "url": s.url,
                    "healthy": s.healthy,
                    "active_connections": s.active_connections,
                    "weight": s.weight,
                    "last_health_check": s.last_health_check.isoformat()
                    if s.last_health_check else None,
                    "last_error": s.last_error,
                }
                for s in self.servers.values()
            ],
            "healthy_count": sum(1 for s in self.servers.values() if s.healthy),
            "total_count": len(self.servers),
        }
```

## Circuit Breaker Integration

```python
from enum import Enum

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class MCPServerCircuitBreaker:
    """Circuit breaker for individual MCP server."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 3,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: float | None = None
        self._half_open_calls = 0

    @property
    def state(self) -> CircuitState:
        """Get current state with automatic transition check."""
        if self._state == CircuitState.OPEN:
            import time
            if (
                self._last_failure_time
                and time.time() - self._last_failure_time >= self.recovery_timeout
            ):
                self._state = CircuitState.HALF_OPEN
                self._half_open_calls = 0
        return self._state

    def can_execute(self) -> bool:
        """Check if request can proceed."""
        state = self.state
        if state == CircuitState.CLOSED:
            return True
        if state == CircuitState.HALF_OPEN:
            return self._half_open_calls < self.half_open_max_calls
        return False

    def record_success(self) -> None:
        """Record successful call."""
        if self._state == CircuitState.HALF_OPEN:
            self._failure_count = 0
            self._state = CircuitState.CLOSED
            logger.info("circuit_closed")
        elif self._state == CircuitState.CLOSED:
            self._failure_count = max(0, self._failure_count - 1)

    def record_failure(self) -> None:
        """Record failed call."""
        import time

        self._failure_count += 1
        self._last_failure_time = time.time()

        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
            logger.warning("circuit_reopened")
        elif (
            self._state == CircuitState.CLOSED
            and self._failure_count >= self.failure_threshold
        ):
            self._state = CircuitState.OPEN
            logger.warning(
                "circuit_opened",
                failure_count=self._failure_count
            )


class ResilientLoadBalancer(MCPLoadBalancer):
    """Load balancer with per-server circuit breakers."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._circuit_breakers: dict[str, MCPServerCircuitBreaker] = {
            url: MCPServerCircuitBreaker()
            for url in self.servers
        }

    async def get_server(self) -> ServerInstance:
        """Get server considering circuit breaker state."""
        async with self._lock:
            available = [
                s for s in self.servers.values()
                if s.healthy and self._circuit_breakers[s.url].can_execute()
            ]

            if not available:
                raise RuntimeError("No available MCP servers (all unhealthy or circuits open)")

            # Use parent strategy on available servers
            # ... (implement strategy selection on available list)
```

## Auto-Scaling Triggers

```python
@dataclass
class ScalingMetrics:
    """Metrics for auto-scaling decisions."""
    avg_latency_ms: float
    requests_per_second: float
    active_connections: int
    error_rate: float
    queue_depth: int


@dataclass
class ScalingPolicy:
    """Auto-scaling policy configuration."""
    scale_up_threshold: float = 0.8  # 80% utilization
    scale_down_threshold: float = 0.3  # 30% utilization
    min_instances: int = 2
    max_instances: int = 10
    cooldown_seconds: float = 300.0  # 5 minutes


class AutoScaler:
    """Auto-scaler for MCP server fleet."""

    def __init__(
        self,
        policy: ScalingPolicy,
        load_balancer: MCPLoadBalancer,
    ):
        self.policy = policy
        self.load_balancer = load_balancer
        self._last_scale_time: float | None = None

    async def evaluate(self, metrics: ScalingMetrics) -> str | None:
        """Evaluate metrics and return scaling action."""
        import time

        # Check cooldown
        if self._last_scale_time:
            elapsed = time.time() - self._last_scale_time
            if elapsed < self.policy.cooldown_seconds:
                return None

        current_count = len(self.load_balancer.servers)
        utilization = self._calculate_utilization(metrics)

        if (
            utilization > self.policy.scale_up_threshold
            and current_count < self.policy.max_instances
        ):
            self._last_scale_time = time.time()
            return "scale_up"

        if (
            utilization < self.policy.scale_down_threshold
            and current_count > self.policy.min_instances
        ):
            self._last_scale_time = time.time()
            return "scale_down"

        return None

    def _calculate_utilization(self, metrics: ScalingMetrics) -> float:
        """Calculate overall utilization score."""
        # Weighted combination of metrics
        return (
            (metrics.avg_latency_ms / 1000) * 0.3  # Normalize to seconds
            + (metrics.error_rate) * 0.3
            + (metrics.active_connections / 100) * 0.2
            + (metrics.queue_depth / 50) * 0.2
        )
```

## Deployment Configuration

```yaml
# kubernetes/mcp-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-server
  template:
    spec:
      containers:
        - name: mcp-server
          image: mcp-server:latest
          ports:
            - containerPort: 8000
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 20
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mcp-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## Best Practices

| Aspect | Recommendation |
|--------|----------------|
| Min instances | >= 2 for redundancy |
| Health check interval | 30s production, 10s staging |
| Unhealthy threshold | 3 consecutive failures |
| Circuit breaker timeout | 30-60s |
| Connection draining | Enable for graceful shutdown |
