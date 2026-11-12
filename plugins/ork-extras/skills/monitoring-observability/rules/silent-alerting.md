---
title: Alert on silent failures using statistical baselines and proactive health monitoring
impact: HIGH
impactDescription: "Silent failures produce no errors — without statistical baselines and proactive monitoring, degradation goes unnoticed for days"
tags: monitoring, silent-failure, alerting, anomaly, baseline, z-score
---

## Silent Failure Alerting

Set up alerting for failures that produce no errors but deliver wrong results.

**Incorrect — alerting only on exceptions:**
```python
try:
    result = await agent.run()
except Exception as e:
    alert(e)  # Only catches crashes, not silent failures
# Agent returned gibberish — no exception raised, no alert sent
```

**Correct — statistical baseline anomaly detection:**
```python
import numpy as np

class BaselineAnomalyDetector:
    def __init__(self, window_size=100, z_threshold=3.0):
        self.window_size = window_size
        self.z_threshold = z_threshold
        self.history = []

    def add_observation(self, value: float) -> dict:
        self.history.append(value)
        if len(self.history) > self.window_size:
            self.history = self.history[-self.window_size:]
        if len(self.history) < 10:
            return {"alert": False, "reason": "insufficient_data"}
        mean = np.mean(self.history[:-1])
        std = np.std(self.history[:-1])
        if std == 0:
            return {"alert": False}
        z_score = abs(value - mean) / std
        if z_score > self.z_threshold:
            return {"alert": True, "type": "statistical_anomaly",
                    "z_score": z_score, "value": value, "mean": mean}
        return {"alert": False, "z_score": z_score}
```

**Silent failure type priorities:**

| Type | Detection Method | Priority |
|------|------------------|----------|
| Tool Skipping | Expected vs actual tool calls | Critical |
| Infinite Loop | Iteration count + token spike | Critical |
| Gibberish Output | LLM-as-judge + heuristics | High |
| Quality Degradation | Score < baseline | Medium |
| Latency Spike | p99 > threshold | Medium |

**Key rules:**
- Alert on silent failures (service up, logic broken), not just errors
- Use z-score > 3.0 (99.7% confidence) for anomaly detection
- Maintain rolling baselines with 100-observation windows
- Detection priority: tool skipping > loops > gibberish > anomalies
- Need minimum 10 observations before baseline alerting is reliable
- Combine statistical detection with proactive quality checks
