# EWMA Dynamic Baselines

Exponentially Weighted Moving Average for adaptive drift detection baselines.

## Basic EWMA

```python
import numpy as np
from dataclasses import dataclass

@dataclass
class EWMAState:
    mean: float = 0.0
    variance: float = 0.0
    count: int = 0

class EWMABaseline:
    """EWMA-based dynamic baseline. Formula: EWMA_t = α × X_t + (1-α) × EWMA_{t-1}"""

    def __init__(self, alpha: float = 0.2, sigma_threshold: float = 3.0, min_samples: int = 10):
        self.alpha = alpha
        self.sigma_threshold = sigma_threshold
        self.min_samples = min_samples
        self.state = EWMAState()

    def update(self, value: float) -> dict:
        """Update baseline and check for anomaly."""
        self.state.count += 1

        if self.state.count == 1:
            self.state.mean = value
            self.state.variance = 0.0
        else:
            delta = value - self.state.mean
            self.state.mean = self.alpha * value + (1 - self.alpha) * self.state.mean
            self.state.variance = (1 - self.alpha) * (self.state.variance + self.alpha * delta ** 2)

        std = np.sqrt(self.state.variance) if self.state.variance > 0 else 0.001
        z_score = abs(value - self.state.mean) / std
        is_anomaly = self.state.count >= self.min_samples and z_score > self.sigma_threshold

        return {
            "value": value,
            "ewma_mean": self.state.mean,
            "ewma_std": std,
            "z_score": z_score,
            "is_anomaly": is_anomaly
        }
```

## Multi-Metric Tracker

```python
class MultiMetricEWMA:
    """Track multiple metrics with independent baselines."""

    def __init__(self, metrics: list[str], alpha: float = 0.2):
        self.baselines = {m: EWMABaseline(alpha=alpha) for m in metrics}

    def update(self, metrics: dict) -> dict:
        results = {}
        anomalies = []
        for name, value in metrics.items():
            if name in self.baselines:
                result = self.baselines[name].update(value)
                results[name] = result
                if result["is_anomaly"]:
                    anomalies.append({"metric": name, "z_score": result["z_score"]})
        return {"metrics": results, "anomalies": anomalies}
```

## Alpha Selection

| Use Case | Alpha | Behavior |
|----------|-------|----------|
| Stable production | 0.1 | Slow adaptation |
| Active development | 0.3 | Moderate |
| High variability | 0.1-0.15 | Very stable |
| Sudden change detection | 0.4-0.5 | Quick response |

## References

- [EWMA Control Charts](https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc324.htm)
