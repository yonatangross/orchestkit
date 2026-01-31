# Statistical Baseline Comparison

Compare agent behavior against learned baselines to detect silent failures.

## Multi-Feature Baseline

```python
from dataclasses import dataclass
from typing import Dict, List
import numpy as np

@dataclass
class AgentMetrics:
    """Metrics from a single agent run."""
    latency_ms: float
    token_count: int
    tool_calls: int
    error_rate: float
    output_length: int

class BaselineComparator:
    """Compare agent behavior against statistical baselines."""

    def __init__(self, z_threshold: float = 2.5, min_samples: int = 50):
        self.z_threshold = z_threshold
        self.min_samples = min_samples
        self.history: List[AgentMetrics] = []
        self.baselines: Dict[str, tuple] = {}  # metric -> (mean, std)

    def record(self, metrics: AgentMetrics):
        """Record metrics and update baselines."""
        self.history.append(metrics)
        if len(self.history) >= self.min_samples:
            self._update_baselines()

    def _update_baselines(self):
        for field in ["latency_ms", "token_count", "tool_calls", "output_length"]:
            values = [getattr(m, field) for m in self.history[-100:]]
            self.baselines[field] = (np.mean(values), np.std(values))

    def check_anomaly(self, metrics: AgentMetrics) -> dict:
        """Check if metrics are anomalous vs baseline."""
        if not self.baselines:
            return {"status": "no_baseline"}

        anomalies = []
        for field in self.baselines:
            mean, std = self.baselines[field]
            value = getattr(metrics, field)
            z = abs(value - mean) / (std + 0.001)

            if z > self.z_threshold:
                anomalies.append({
                    "metric": field,
                    "value": value,
                    "expected": f"{mean:.2f} ± {std:.2f}",
                    "z_score": z
                })

        return {
            "anomalies": anomalies,
            "is_anomalous": len(anomalies) > 0,
            "severity": max((a["z_score"] for a in anomalies), default=0)
        }
```

## Agent Stability Index (ASI)

```python
class AgentStabilityIndex:
    """Composite stability metric (12 dimensions)."""

    def __init__(self, drift_threshold: float = 0.75, window_size: int = 50):
        self.threshold = drift_threshold
        self.window_size = window_size
        self.windows: List[float] = []

    def calculate_asi(self, metrics: dict) -> float:
        """Calculate ASI from component metrics."""
        weights = {
            "response_consistency": 0.30,  # Embedding cosine, CoT edit distance
            "tool_usage_patterns": 0.25,   # Selection stability, sequencing
            "inter_agent_coord": 0.25,     # Consensus, handoff efficiency
            "behavioral_bounds": 0.20      # Output length variance, error patterns
        }

        score = sum(metrics.get(k, 0.5) * w for k, w in weights.items())
        self.windows.append(score)

        if len(self.windows) > 3:
            self.windows = self.windows[-3:]

        return score

    def detect_drift(self) -> dict:
        """Detect drift if ASI < threshold for 3 consecutive windows."""
        if len(self.windows) < 3:
            return {"status": "insufficient_data"}

        consecutive_low = all(w < self.threshold for w in self.windows[-3:])
        return {
            "drift_detected": consecutive_low,
            "recent_asi": self.windows[-3:],
            "avg_asi": np.mean(self.windows[-3:])
        }
```

## Output Length Anomaly

```python
class OutputLengthMonitor:
    """Detect anomalous output lengths."""

    def __init__(self):
        self.lengths: List[int] = []

    def check(self, output: str) -> dict:
        length = len(output)
        self.lengths.append(length)

        if len(self.lengths) < 20:
            return {"status": "building_baseline"}

        mean = np.mean(self.lengths[-100:])
        std = np.std(self.lengths[-100:])

        # Unusually short
        if length < mean - 2 * std and length < 50:
            return {"anomaly": "too_short", "length": length, "expected": f"{mean:.0f}"}

        # Unusually long
        if length > mean + 3 * std:
            return {"anomaly": "too_long", "length": length, "expected": f"{mean:.0f}"}

        return {"anomaly": None, "length": length}
```

## References

- [Multi-Agentic AI Trajectory Analysis](https://arxiv.org/abs/2511.04032)
- [Agent Drift: Quantifying Behavioral Degradation](https://arxiv.org/abs/2601.04170)
