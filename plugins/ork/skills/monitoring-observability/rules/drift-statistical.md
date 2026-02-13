---
title: "Drift: Statistical Methods"
impact: HIGH
impactDescription: "Statistical drift detection catches distribution shifts in LLM inputs/outputs before they manifest as quality degradation visible to users."
tags: [drift, psi, ks-test, kl-divergence, wasserstein, ewma, statistical]
---

# Statistical Drift Detection

## Population Stability Index (PSI)

**Recommended for production LLM monitoring.**

```python
import numpy as np

def calculate_psi(
    expected: np.ndarray,
    actual: np.ndarray,
    bins: int = 10,
    eps: float = 0.0001
) -> float:
    """
    PSI = SUM((Actual% - Expected%) * ln(Actual% / Expected%))

    Thresholds:
    - PSI < 0.1: No significant drift
    - 0.1 <= PSI < 0.25: Moderate drift, investigate
    - PSI >= 0.25: Significant drift, action needed
    """
    min_val = min(expected.min(), actual.min())
    max_val = max(expected.max(), actual.max())
    bin_edges = np.linspace(min_val, max_val, bins + 1)

    expected_counts, _ = np.histogram(expected, bins=bin_edges)
    actual_counts, _ = np.histogram(actual, bins=bin_edges)

    expected_pct = expected_counts / len(expected) + eps
    actual_pct = actual_counts / len(actual) + eps

    return np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
```

## PSI Threshold Guidelines

| PSI Value | Interpretation | Action |
|-----------|----------------|--------|
| < 0.1 | No significant drift | Monitor |
| 0.1 - 0.25 | Moderate drift | Investigate |
| >= 0.25 | Significant drift | Alert + Action |

## Kolmogorov-Smirnov Test

**Best for small sample sizes (<1000 observations).**

```python
from scipy import stats

def ks_drift_test(expected, actual, significance=0.05):
    statistic, p_value = stats.ks_2samp(expected, actual)
    return {
        "statistic": statistic,
        "p_value": p_value,
        "drift_detected": p_value < significance,
    }

# Warning: KS is too sensitive on large datasets
# Use sampling for >1000 observations
def adjusted_ks_test(expected, actual, sample_size=500):
    if len(expected) > sample_size:
        expected = np.random.choice(expected, sample_size, replace=False)
    if len(actual) > sample_size:
        actual = np.random.choice(actual, sample_size, replace=False)
    return ks_drift_test(expected, actual)
```

## EWMA Dynamic Threshold

```python
class EWMADriftDetector:
    """Exponential Weighted Moving Average for drift detection."""

    def __init__(self, lambda_param: float = 0.2, L: float = 3.0):
        self.lambda_param = lambda_param
        self.L = L
        self.ewma = None

    def update(self, value: float, baseline_mean: float, baseline_std: float) -> dict:
        if self.ewma is None:
            self.ewma = value
        else:
            self.ewma = self.lambda_param * value + (1 - self.lambda_param) * self.ewma

        factor = np.sqrt(self.lambda_param / (2 - self.lambda_param))
        ucl = baseline_mean + self.L * baseline_std * factor
        lcl = baseline_mean - self.L * baseline_std * factor

        return {
            "ewma": self.ewma,
            "ucl": ucl, "lcl": lcl,
            "drift_detected": self.ewma > ucl or self.ewma < lcl
        }
```

## Method Comparison

| Method | Best For | Symmetric | Pros | Cons |
|--------|----------|-----------|------|------|
| **PSI** | Production monitoring | Yes | Stable, intuitive thresholds | Only notices large changes |
| **KL Divergence** | Sensitive analysis | No | Detects tail changes | Undefined for zero probs |
| **JS Divergence** | Balanced comparison | Yes | Bounded [0,1], no div-by-zero | Less sensitive to tails |
| **KS Test** | Small samples | Yes | Non-parametric | Too sensitive on large data |
| **Wasserstein** | Continuous data | Yes | Considers distribution shape | Computationally expensive |

## Choosing the Right Method

```python
def select_drift_method(data_type: str, sample_size: int) -> str:
    if data_type == "categorical":
        return "psi" if sample_size > 1000 else "chi_square"
    if data_type == "embeddings":
        return "embedding_centroid_distance"
    if sample_size < 500:
        return "ks_test"
    return "psi"  # Default: stable for production
```

## Combined Drift Score

```python
def combined_drift_score(expected, actual, weights=None):
    weights = weights or {"psi": 0.4, "wasserstein": 0.3, "js": 0.3}

    psi = calculate_psi(expected, actual)
    wasserstein = wasserstein_drift(expected, actual, normalize=True)
    js = js_divergence(expected, actual)

    psi_normalized = min(psi / 0.5, 1.0)
    combined = (
        weights["psi"] * psi_normalized +
        weights["wasserstein"] * wasserstein +
        weights["js"] * js
    )

    return {"combined_score": combined, "drift_detected": combined > 0.15}
```

## EWMA Alpha Selection

| Use Case | Alpha | Behavior |
|----------|-------|----------|
| Stable production | 0.1 | Slow adaptation |
| Active development | 0.3 | Moderate |
| High variability | 0.1-0.15 | Very stable |
| Sudden change detection | 0.4-0.5 | Quick response |
