---
title: "Drift: Alerting"
impact: HIGH
impactDescription: "Drift alerting connects detection to action — without proper thresholds and correlation, drift alerts either flood teams or miss real issues."
tags: [drift, alerting, thresholds, dynamic, anti-patterns, correlation]
---

# Drift Alerting

## Dynamic Thresholds

Use the 95th percentile of historical PSI values instead of static thresholds:

```python
import numpy as np

def calculate_dynamic_threshold(historical_psi: list[float], percentile: float = 95) -> float:
    """Calculate dynamic threshold from historical PSI values."""
    return np.percentile(historical_psi, percentile)

# Usage
threshold = calculate_dynamic_threshold(last_30_days_psi)
if current_psi > threshold:
    alert("Drift exceeds dynamic threshold")
```

## Correlation with Performance Metrics

Always correlate drift metrics with actual performance before alerting:

```python
async def correlated_drift_alert(
    psi_score: float,
    psi_threshold: float,
    quality_score: float,
    quality_baseline: float,
):
    """Only alert when drift AND quality drop are both confirmed."""
    drift_detected = psi_score > psi_threshold
    quality_drop = quality_score < quality_baseline * 0.9  # 10% drop

    if drift_detected and quality_drop:
        await trigger_alert(
            severity="high",
            message=f"Distribution drift (PSI={psi_score:.3f}) "
                    f"correlated with quality drop ({quality_score:.2f} < {quality_baseline:.2f})",
        )
        await trigger_evaluation()
    elif drift_detected:
        await log_warning(
            f"Distribution drift detected (PSI={psi_score:.3f}) "
            f"but quality stable ({quality_score:.2f})"
        )
```

## Anti-Patterns

```python
# NEVER use static thresholds without context
if psi > 0.2:  # May cause alert fatigue
    alert()

# NEVER retrain on time schedule alone
schedule.every(7).days.do(retrain)  # Wasteful if no drift

# ALWAYS use dynamic thresholds
threshold = np.percentile(historical_psi, 95)
if psi > threshold:
    alert()

# ALWAYS correlate with performance metrics
if psi > threshold and quality_score < baseline:
    trigger_evaluation()
```

## Alert Priority Rules

| Condition | Priority | Action |
|-----------|----------|--------|
| PSI >= 0.25 AND quality drop > 10% | Critical | Immediate investigation |
| PSI >= 0.25, quality stable | Medium | Monitor, log warning |
| PSI 0.1-0.25 AND quality drop > 5% | High | Investigate within 4 hours |
| PSI 0.1-0.25, quality stable | Low | Review next sprint |
| PSI < 0.1 | None | Continue monitoring |

## Drift Alert Pipeline

```python
class DriftAlertPipeline:
    """Complete drift detection and alerting pipeline."""

    def __init__(self, psi_threshold: float = 0.25, quality_threshold: float = 0.7):
        self.psi_threshold = psi_threshold
        self.quality_threshold = quality_threshold
        self.historical_psi = []

    async def run(self, baseline_data, current_data, quality_scores):
        # 1. Calculate drift
        psi = calculate_psi(baseline_data, current_data)
        self.historical_psi.append(psi)

        # 2. Dynamic threshold (use after enough history)
        if len(self.historical_psi) >= 30:
            threshold = np.percentile(self.historical_psi, 95)
        else:
            threshold = self.psi_threshold

        # 3. Check quality correlation
        avg_quality = np.mean(quality_scores) if quality_scores else 1.0

        # 4. Alert based on correlation
        if psi > threshold and avg_quality < self.quality_threshold:
            return {"alert": "critical", "psi": psi, "quality": avg_quality}
        elif psi > threshold:
            return {"alert": "warning", "psi": psi, "quality": avg_quality}

        return {"alert": None, "psi": psi, "quality": avg_quality}
```

## Notification Strategy

| Severity | Channel | Frequency |
|----------|---------|-----------|
| Critical (drift + quality drop) | PagerDuty + Slack | Immediate |
| Warning (drift, quality stable) | Slack | Daily digest |
| Info (moderate drift) | Log | Continuous |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Threshold strategy | Dynamic (95th percentile of historical) over static |
| Alert priority | Performance metrics > distribution metrics |
| Correlation | Always confirm drift + quality drop before critical alerts |
| Historical window | 30+ days for reliable dynamic thresholds |
| Tool stack | Langfuse (traces) + Evidently/Phoenix (drift analysis) |
