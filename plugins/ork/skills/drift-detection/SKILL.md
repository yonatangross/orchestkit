---
name: drift-detection
description: Statistical and quality drift detection for LLM applications. Use when monitoring model quality degradation, input distribution shifts, or output pattern changes over time.
context: fork
agent: metrics-architect
version: 1.0.0
author: OrchestKit
tags: [drift, monitoring, quality, statistical, psi, langfuse, evidently, 2026]
user-invocable: false
---

# Drift Detection

Monitor LLM quality degradation and input/output distribution shifts in production.

## Overview

- Detecting input distribution drift (data drift)
- Monitoring output quality degradation (concept drift)
- Implementing statistical methods (PSI, KS, KL divergence)
- Setting up dynamic thresholds with moving averages
- Integrating Langfuse scores with drift analysis

## Quick Reference

### Population Stability Index (PSI)

```python
import numpy as np

def calculate_psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    """
    Calculate Population Stability Index.

    Thresholds:
    - PSI < 0.1: No significant drift
    - 0.1 <= PSI < 0.25: Moderate drift, investigate
    - PSI >= 0.25: Significant drift, action needed
    """
    expected_pct = np.histogram(expected, bins=bins)[0] / len(expected)
    actual_pct = np.histogram(actual, bins=bins)[0] / len(actual)

    # Avoid division by zero
    expected_pct = np.clip(expected_pct, 0.0001, None)
    actual_pct = np.clip(actual_pct, 0.0001, None)

    psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
    return psi

# Usage
psi_score = calculate_psi(baseline_scores, current_scores)
if psi_score >= 0.25:
    alert("Significant quality drift detected!")
```

### EWMA Dynamic Threshold

```python
class EWMADriftDetector:
    """Exponential Weighted Moving Average for drift detection."""

    def __init__(self, lambda_param: float = 0.2, L: float = 3.0):
        self.lambda_param = lambda_param  # Smoothing factor
        self.L = L  # Control limit multiplier
        self.ewma = None

    def update(self, value: float, baseline_mean: float, baseline_std: float) -> dict:
        if self.ewma is None:
            self.ewma = value
        else:
            self.ewma = self.lambda_param * value + (1 - self.lambda_param) * self.ewma

        # Calculate control limits
        factor = np.sqrt(self.lambda_param / (2 - self.lambda_param))
        ucl = baseline_mean + self.L * baseline_std * factor
        lcl = baseline_mean - self.L * baseline_std * factor

        return {
            "ewma": self.ewma,
            "ucl": ucl,
            "lcl": lcl,
            "drift_detected": self.ewma > ucl or self.ewma < lcl
        }
```

### Langfuse Score Trend Monitoring

```python
from langfuse import Langfuse

langfuse = Langfuse()

def check_quality_drift(days: int = 7, threshold_drop: float = 0.1):
    """Compare recent quality scores against baseline."""

    # Fetch recent scores
    current_scores = langfuse.fetch_scores(
        name="quality_overall",
        from_timestamp=datetime.now() - timedelta(days=1)
    )

    # Fetch baseline scores
    baseline_scores = langfuse.fetch_scores(
        name="quality_overall",
        from_timestamp=datetime.now() - timedelta(days=days),
        to_timestamp=datetime.now() - timedelta(days=1)
    )

    current_mean = np.mean([s.value for s in current_scores])
    baseline_mean = np.mean([s.value for s in baseline_scores])

    drift_pct = (baseline_mean - current_mean) / baseline_mean

    if drift_pct > threshold_drop:
        return {"drift": True, "drop_pct": drift_pct}
    return {"drift": False, "drop_pct": drift_pct}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Statistical method | PSI for production (stable), KS for small samples |
| Threshold strategy | Dynamic (95th percentile of historical) over static |
| Baseline window | 7-30 days rolling window |
| Alert priority | Performance metrics > distribution metrics |
| Tool stack | Langfuse (traces) + Evidently/Phoenix (drift analysis) |

## PSI Threshold Guidelines

| PSI Value | Interpretation | Action |
|-----------|----------------|--------|
| < 0.1 | No significant drift | Monitor |
| 0.1 - 0.25 | Moderate drift | Investigate |
| >= 0.25 | Significant drift | Alert + Action |

## Anti-Patterns

```python
# ❌ NEVER use static thresholds without context
if psi > 0.2:  # May cause alert fatigue
    alert()

# ❌ NEVER retrain on time schedule alone
schedule.every(7).days.do(retrain)  # Wasteful if no drift

# ✅ ALWAYS use dynamic thresholds
threshold = np.percentile(historical_psi, 95)
if psi > threshold:
    alert()

# ✅ ALWAYS correlate with performance metrics
if psi > threshold AND quality_score < baseline:
    trigger_evaluation()
```

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/statistical-methods.md](references/statistical-methods.md) | PSI, KS, KL divergence, Wasserstein comparison |
| [references/embedding-drift.md](references/embedding-drift.md) | Arize Phoenix, cluster monitoring, semantic drift |
| [references/ewma-baselines.md](references/ewma-baselines.md) | Moving averages, dynamic thresholds, control charts |
| [references/langfuse-evidently-integration.md](references/langfuse-evidently-integration.md) | Combined pipeline pattern |
| [checklists/drift-detection-setup-checklist.md](checklists/drift-detection-setup-checklist.md) | Implementation checklist |

## Related Skills

- `langfuse-observability` - Score tracking for drift analysis
- `llm-evaluation` - Quality metrics that feed drift detection
- `quality-gates` - Threshold enforcement
- `observability-monitoring` - General monitoring patterns

## Capability Details

### psi-drift
**Keywords:** psi, population stability index, distribution drift, histogram comparison
**Solves:**
- Detect distribution shifts in LLM inputs/outputs
- Production-grade drift monitoring
- Stable drift metric for large datasets

### embedding-drift
**Keywords:** embedding drift, semantic drift, cluster, centroid, arize phoenix
**Solves:**
- Detect semantic changes in text data
- Monitor RAG retrieval quality
- Track embedding space shifts

### quality-regression
**Keywords:** quality drift, score degradation, trend, moving average
**Solves:**
- Detect LLM quality degradation over time
- Compare against historical baselines
- Early warning for model issues

### dynamic-thresholds
**Keywords:** ewma, dynamic threshold, adaptive, control chart
**Solves:**
- Reduce alert fatigue with adaptive thresholds
- Statistical process control for LLMs
- Context-aware drift alerting

### canary-monitoring
**Keywords:** canary prompt, fixed test, regression test, behavioral drift
**Solves:**
- Track consistency with fixed test inputs
- Detect behavioral changes in LLMs
- Regression testing for model updates
