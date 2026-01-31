# Loop Detection

Detect infinite loops, stuck agents, and token consumption spikes.

## Loop Detection Patterns

### 1. Iteration Counter

```python
from dataclasses import dataclass
from typing import Optional, Callable
from datetime import datetime, timedelta

@dataclass
class LoopAlert:
    detected: bool
    type: str
    iterations: int
    tokens_used: int
    duration_seconds: float
    message: str

class IterationLoopDetector:
    """Detect loops based on iteration count."""

    def __init__(
        self,
        max_iterations: int = 10,
        max_same_action: int = 3
    ):
        self.max_iterations = max_iterations
        self.max_same_action = max_same_action
        self.iteration_count = 0
        self.action_history = []
        self.start_time = None

    def start(self):
        """Start monitoring a new agent run."""
        self.iteration_count = 0
        self.action_history = []
        self.start_time = datetime.now()

    def record_iteration(self, action: str = None) -> Optional[LoopAlert]:
        """
        Record an iteration and check for loops.

        Args:
            action: Optional action name for pattern detection

        Returns:
            LoopAlert if loop detected, None otherwise
        """
        self.iteration_count += 1

        if action:
            self.action_history.append(action)

        # Check max iterations
        if self.iteration_count > self.max_iterations:
            return LoopAlert(
                detected=True,
                type="max_iterations",
                iterations=self.iteration_count,
                tokens_used=0,
                duration_seconds=self._elapsed(),
                message=f"Exceeded {self.max_iterations} iterations"
            )

        # Check for repeated same action
        if action and len(self.action_history) >= self.max_same_action:
            recent = self.action_history[-self.max_same_action:]
            if len(set(recent)) == 1:
                return LoopAlert(
                    detected=True,
                    type="repeated_action",
                    iterations=self.iteration_count,
                    tokens_used=0,
                    duration_seconds=self._elapsed(),
                    message=f"Action '{action}' repeated {self.max_same_action} times"
                )

        return None

    def _elapsed(self) -> float:
        if self.start_time:
            return (datetime.now() - self.start_time).total_seconds()
        return 0
```

### 2. Token Consumption Monitor

```python
class TokenSpikeDetector:
    """Detect abnormal token consumption patterns."""

    def __init__(
        self,
        baseline_tokens_per_iteration: int = 2000,
        spike_multiplier: float = 3.0,
        max_total_tokens: int = 100000
    ):
        self.baseline = baseline_tokens_per_iteration
        self.spike_multiplier = spike_multiplier
        self.max_total = max_total_tokens

        self.total_tokens = 0
        self.iteration_tokens = []

    def reset(self):
        """Reset for new agent run."""
        self.total_tokens = 0
        self.iteration_tokens = []

    def record_tokens(self, tokens: int) -> Optional[LoopAlert]:
        """
        Record token usage and check for spikes.

        Args:
            tokens: Tokens used in this iteration

        Returns:
            LoopAlert if spike detected
        """
        self.total_tokens += tokens
        self.iteration_tokens.append(tokens)
        iterations = len(self.iteration_tokens)

        # Check total token limit
        if self.total_tokens > self.max_total:
            return LoopAlert(
                detected=True,
                type="max_tokens",
                iterations=iterations,
                tokens_used=self.total_tokens,
                duration_seconds=0,
                message=f"Exceeded max tokens: {self.total_tokens} > {self.max_total}"
            )

        # Check for spike vs expected
        expected_tokens = self.baseline * iterations
        if self.total_tokens > expected_tokens * self.spike_multiplier:
            return LoopAlert(
                detected=True,
                type="token_spike",
                iterations=iterations,
                tokens_used=self.total_tokens,
                duration_seconds=0,
                message=f"Token spike: {self.total_tokens} vs expected {expected_tokens}"
            )

        # Check for single iteration spike
        if tokens > self.baseline * self.spike_multiplier:
            return LoopAlert(
                detected=True,
                type="iteration_spike",
                iterations=iterations,
                tokens_used=self.total_tokens,
                duration_seconds=0,
                message=f"Single iteration used {tokens} tokens (baseline: {self.baseline})"
            )

        return None
```

### 3. Combined Loop Detector

```python
from typing import Optional
from langfuse.decorators import observe, langfuse_context

class CombinedLoopDetector:
    """Combined loop detection with multiple signals."""

    def __init__(
        self,
        max_iterations: int = 10,
        max_tokens: int = 100000,
        max_duration_seconds: float = 300,
        token_baseline: int = 2000
    ):
        self.iteration_detector = IterationLoopDetector(
            max_iterations=max_iterations
        )
        self.token_detector = TokenSpikeDetector(
            baseline_tokens_per_iteration=token_baseline,
            max_total_tokens=max_tokens
        )
        self.max_duration = max_duration_seconds
        self.start_time = None

    def start(self):
        """Start monitoring."""
        self.iteration_detector.start()
        self.token_detector.reset()
        self.start_time = datetime.now()

    @observe(name="loop_check")
    def check(
        self,
        action: str = None,
        tokens_used: int = 0
    ) -> Optional[LoopAlert]:
        """
        Check for loop on each iteration.

        Args:
            action: Current action being taken
            tokens_used: Tokens consumed in this iteration

        Returns:
            LoopAlert if any loop condition triggered
        """
        # Check duration
        if self.start_time:
            elapsed = (datetime.now() - self.start_time).total_seconds()
            if elapsed > self.max_duration:
                alert = LoopAlert(
                    detected=True,
                    type="timeout",
                    iterations=self.iteration_detector.iteration_count,
                    tokens_used=self.token_detector.total_tokens,
                    duration_seconds=elapsed,
                    message=f"Agent timed out after {elapsed:.1f}s"
                )
                self._log_alert(alert)
                return alert

        # Check iterations
        iter_alert = self.iteration_detector.record_iteration(action)
        if iter_alert:
            self._log_alert(iter_alert)
            return iter_alert

        # Check tokens
        if tokens_used > 0:
            token_alert = self.token_detector.record_tokens(tokens_used)
            if token_alert:
                self._log_alert(token_alert)
                return token_alert

        return None

    def _log_alert(self, alert: LoopAlert):
        """Log alert to Langfuse."""
        langfuse_context.update_current_observation(
            metadata={
                "loop_detected": alert.detected,
                "loop_type": alert.type,
                "iterations": alert.iterations,
                "tokens_used": alert.tokens_used,
                "duration_seconds": alert.duration_seconds
            }
        )
        langfuse_context.score(
            name="loop_detection",
            value=1.0,  # 1 = loop detected
            comment=alert.message
        )
```

### 4. Circuit Breaker Pattern

```python
import asyncio
from typing import Callable, TypeVar, Optional
from enum import Enum
from datetime import datetime, timedelta

T = TypeVar('T')

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if recovered

class AgentCircuitBreaker:
    """
    Circuit breaker for agent operations.

    Prevents runaway agents by cutting off after repeated failures.
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        recovery_timeout: float = 60.0,
        half_open_max_calls: int = 1
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self.state = CircuitState.CLOSED
        self.failures = 0
        self.last_failure_time: Optional[datetime] = None
        self.half_open_calls = 0

    async def call(
        self,
        func: Callable[..., T],
        *args,
        **kwargs
    ) -> T:
        """
        Execute function with circuit breaker protection.

        Raises:
            CircuitBreakerOpen: If circuit is open
        """
        # Check if we should transition from OPEN to HALF_OPEN
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
            else:
                raise CircuitBreakerOpen(
                    f"Circuit breaker open. Retry after {self.recovery_timeout}s"
                )

        # In HALF_OPEN, limit calls
        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_calls >= self.half_open_max_calls:
                raise CircuitBreakerOpen("Circuit breaker half-open, max calls reached")
            self.half_open_calls += 1

        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        """Handle successful call."""
        self.failures = 0
        self.state = CircuitState.CLOSED

    def _on_failure(self):
        """Handle failed call."""
        self.failures += 1
        self.last_failure_time = datetime.now()

        if self.failures >= self.failure_threshold:
            self.state = CircuitState.OPEN

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset."""
        if self.last_failure_time is None:
            return True
        elapsed = (datetime.now() - self.last_failure_time).total_seconds()
        return elapsed >= self.recovery_timeout


class CircuitBreakerOpen(Exception):
    """Raised when circuit breaker is open."""
    pass
```

### 5. Agent Wrapper with Loop Protection

```python
from langfuse.decorators import observe, langfuse_context
from typing import Any, Dict

class LoopProtectedAgent:
    """Wrapper that adds loop protection to any agent."""

    def __init__(
        self,
        agent,
        max_iterations: int = 10,
        max_tokens: int = 100000,
        max_duration_seconds: float = 300
    ):
        self.agent = agent
        self.loop_detector = CombinedLoopDetector(
            max_iterations=max_iterations,
            max_tokens=max_tokens,
            max_duration_seconds=max_duration_seconds
        )
        self.circuit_breaker = AgentCircuitBreaker()

    @observe(name="loop_protected_agent")
    async def run(self, *args, **kwargs) -> Any:
        """Run agent with loop protection."""
        self.loop_detector.start()

        async def protected_iteration():
            # Run single iteration
            result = await self.agent.step(*args, **kwargs)

            # Check for loops
            tokens = result.get("tokens_used", 0)
            action = result.get("action")

            alert = self.loop_detector.check(
                action=action,
                tokens_used=tokens
            )

            if alert:
                raise LoopDetectedError(alert)

            return result

        try:
            # Run with circuit breaker
            while not self.agent.is_complete():
                result = await self.circuit_breaker.call(protected_iteration)

            return self.agent.get_result()

        except LoopDetectedError as e:
            langfuse_context.update_current_observation(
                metadata={
                    "terminated_by": "loop_detection",
                    "loop_alert": e.alert.__dict__
                }
            )
            # Return partial result or error
            return {
                "error": "Loop detected",
                "alert": e.alert,
                "partial_result": self.agent.get_partial_result()
            }

        except CircuitBreakerOpen as e:
            langfuse_context.update_current_observation(
                metadata={"terminated_by": "circuit_breaker"}
            )
            return {
                "error": "Circuit breaker open",
                "message": str(e)
            }


class LoopDetectedError(Exception):
    def __init__(self, alert: LoopAlert):
        self.alert = alert
        super().__init__(alert.message)
```

## Monitoring Dashboard Queries

```sql
-- Find traces with loop detection alerts
SELECT
    trace_id,
    timestamp,
    metadata->>'loop_type' as loop_type,
    metadata->>'iterations' as iterations,
    metadata->>'tokens_used' as tokens
FROM observations
WHERE name = 'loop_check'
    AND (metadata->>'loop_detected')::boolean = true
    AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Aggregate loop statistics
SELECT
    metadata->>'loop_type' as loop_type,
    COUNT(*) as occurrences,
    AVG((metadata->>'iterations')::int) as avg_iterations,
    AVG((metadata->>'tokens_used')::int) as avg_tokens
FROM observations
WHERE name = 'loop_check'
    AND (metadata->>'loop_detected')::boolean = true
    AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY metadata->>'loop_type'
ORDER BY occurrences DESC;
```

## References

- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Agent Loop Detection Best Practices](https://www.truefoundry.com/blog/llm-observability-tools)
- [Token Budget Management](https://platform.openai.com/docs/guides/rate-limits)
