# Statistical Methods for Drift Detection

Comparison of statistical methods for detecting distribution drift in LLM applications.

## Method Comparison

| Method | Best For | Range | Symmetric | Pros | Cons |
|--------|----------|-------|-----------|------|------|
| **PSI** | Production monitoring | 0 to ∞ | Yes | Stable, intuitive thresholds | Only notices large changes |
| **KL Divergence** | Sensitive analysis | 0 to ∞ | No | Detects tail changes | Undefined for zero probabilities |
| **JS Divergence** | Balanced comparison | 0 to 1 | Yes | Bounded, no divide-by-zero | Less sensitive to tails |
| **KS Test** | Small samples | 0 to 1 | Yes | Non-parametric | Too sensitive on large datasets |
| **Wasserstein** | Continuous data | 0 to ∞ | Yes | Considers distribution shape | Computationally expensive |

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
    Calculate Population Stability Index.

    PSI = Σ (Actual% - Expected%) × ln(Actual% / Expected%)

    Args:
        expected: Baseline distribution
        actual: Current distribution
        bins: Number of bins for histograms
        eps: Small value to avoid log(0)

    Returns:
        PSI score
    """
    # Create histograms with same bins
    min_val = min(expected.min(), actual.min())
    max_val = max(expected.max(), actual.max())
    bin_edges = np.linspace(min_val, max_val, bins + 1)

    expected_counts, _ = np.histogram(expected, bins=bin_edges)
    actual_counts, _ = np.histogram(actual, bins=bin_edges)

    # Convert to percentages
    expected_pct = expected_counts / len(expected) + eps
    actual_pct = actual_counts / len(actual) + eps

    # Calculate PSI
    psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))

    return psi


# Interpretation
PSI_THRESHOLDS = {
    "no_drift": 0.1,      # < 0.1: No significant change
    "moderate": 0.25,      # 0.1-0.25: Some change, investigate
    "significant": 0.25    # > 0.25: Significant change, action needed
}
```

## Kolmogorov-Smirnov Test

**Best for small sample sizes (<1000 observations).**

```python
from scipy import stats
import numpy as np

def ks_drift_test(
    expected: np.ndarray,
    actual: np.ndarray,
    significance: float = 0.05
) -> dict:
    """
    Kolmogorov-Smirnov test for distribution drift.

    Measures max difference between CDFs of two samples.

    Args:
        expected: Baseline distribution
        actual: Current distribution
        significance: p-value threshold for drift detection

    Returns:
        Dict with statistic, p-value, and drift detected flag
    """
    statistic, p_value = stats.ks_2samp(expected, actual)

    return {
        "statistic": statistic,  # 0-1, higher = more different
        "p_value": p_value,
        "drift_detected": p_value < significance,
        "interpretation": (
            "Distributions are different"
            if p_value < significance
            else "No significant difference"
        )
    }


# Warning: KS is very sensitive on large datasets
# May flag minor, irrelevant changes as "drift"
def adjusted_ks_test(expected, actual, sample_size: int = 500):
    """KS test with sampling for large datasets."""
    if len(expected) > sample_size:
        expected = np.random.choice(expected, sample_size, replace=False)
    if len(actual) > sample_size:
        actual = np.random.choice(actual, sample_size, replace=False)
    return ks_drift_test(expected, actual)
```

## KL Divergence

**Useful for detecting changes in distribution tails.**

```python
import numpy as np
from scipy.special import kl_div

def kl_divergence(
    p: np.ndarray,
    q: np.ndarray,
    bins: int = 10,
    eps: float = 1e-10
) -> float:
    """
    Calculate Kullback-Leibler divergence.

    KL(P||Q) = Σ P(x) × log(P(x) / Q(x))

    Note: KL divergence is asymmetric: KL(P||Q) ≠ KL(Q||P)

    Args:
        p: Reference distribution (expected)
        q: Comparison distribution (actual)
        bins: Number of bins
        eps: Small value to avoid log(0)

    Returns:
        KL divergence (0 = identical, higher = more different)
    """
    # Create probability distributions
    min_val = min(p.min(), q.min())
    max_val = max(p.max(), q.max())
    bin_edges = np.linspace(min_val, max_val, bins + 1)

    p_hist, _ = np.histogram(p, bins=bin_edges, density=True)
    q_hist, _ = np.histogram(q, bins=bin_edges, density=True)

    # Add epsilon to avoid log(0)
    p_hist = p_hist + eps
    q_hist = q_hist + eps

    # Normalize
    p_hist = p_hist / p_hist.sum()
    q_hist = q_hist / q_hist.sum()

    # Calculate KL divergence
    return np.sum(p_hist * np.log(p_hist / q_hist))


# Symmetric version using both directions
def symmetric_kl(p, q, bins=10):
    """Symmetric KL: (KL(P||Q) + KL(Q||P)) / 2"""
    return (kl_divergence(p, q, bins) + kl_divergence(q, p, bins)) / 2
```

## Jensen-Shannon Divergence

**Symmetric, bounded alternative to KL divergence.**

```python
import numpy as np
from scipy.spatial.distance import jensenshannon

def js_divergence(
    p: np.ndarray,
    q: np.ndarray,
    bins: int = 10
) -> float:
    """
    Calculate Jensen-Shannon divergence.

    JS(P||Q) = 0.5 × KL(P||M) + 0.5 × KL(Q||M)
    where M = 0.5 × (P + Q)

    Benefits over KL:
    - Symmetric: JS(P||Q) = JS(Q||P)
    - Bounded: 0 ≤ JS ≤ 1
    - No divide-by-zero issues

    Returns:
        JS divergence (0 = identical, 1 = completely different)
    """
    # Create probability distributions
    min_val = min(p.min(), q.min())
    max_val = max(p.max(), q.max())
    bin_edges = np.linspace(min_val, max_val, bins + 1)

    p_hist, _ = np.histogram(p, bins=bin_edges, density=True)
    q_hist, _ = np.histogram(q, bins=bin_edges, density=True)

    # Normalize
    p_hist = p_hist / (p_hist.sum() + 1e-10)
    q_hist = q_hist / (q_hist.sum() + 1e-10)

    # scipy's jensenshannon returns sqrt of JS divergence
    return jensenshannon(p_hist, q_hist) ** 2

# Thresholds (JS is bounded 0-1)
JS_THRESHOLDS = {
    "no_drift": 0.05,
    "moderate": 0.15,
    "significant": 0.15
}
```

## Wasserstein Distance (Earth Mover's Distance)

**Best for continuous distributions where "distance" matters.**

```python
from scipy.stats import wasserstein_distance
import numpy as np

def wasserstein_drift(
    expected: np.ndarray,
    actual: np.ndarray,
    normalize: bool = True
) -> float:
    """
    Calculate Wasserstein distance (Earth Mover's Distance).

    Measures the "work" needed to transform one distribution into another.

    Benefits:
    - Considers the shape/geometry of distributions
    - Good compromise between KS sensitivity and PSI stability

    Limitation:
    - Cannot be computed for categorical data (needs ordinal/numeric)

    Args:
        expected: Baseline distribution
        actual: Current distribution
        normalize: Normalize by data range for comparability

    Returns:
        Wasserstein distance
    """
    distance = wasserstein_distance(expected, actual)

    if normalize:
        # Normalize by data range for consistent thresholds
        data_range = max(expected.max(), actual.max()) - min(expected.min(), actual.min())
        if data_range > 0:
            distance = distance / data_range

    return distance

# Normalized thresholds (0-1 range after normalization)
WASSERSTEIN_THRESHOLDS = {
    "no_drift": 0.05,
    "moderate": 0.1,
    "significant": 0.1
}
```

## Choosing the Right Method

```python
def select_drift_method(
    data_type: str,
    sample_size: int,
    sensitivity: str = "balanced"
) -> str:
    """
    Recommend drift detection method based on data characteristics.

    Args:
        data_type: "continuous", "categorical", "embeddings"
        sample_size: Number of observations
        sensitivity: "high", "balanced", "low"

    Returns:
        Recommended method name
    """
    if data_type == "categorical":
        # Wasserstein doesn't work for categorical
        return "psi" if sample_size > 1000 else "chi_square"

    if data_type == "embeddings":
        # Use specialized embedding drift methods
        return "embedding_centroid_distance"

    # Continuous data
    if sample_size < 500:
        return "ks_test"  # Good for small samples

    if sensitivity == "high":
        return "ks_test"  # Most sensitive

    if sensitivity == "low":
        return "psi"  # Stable, only catches big changes

    # Balanced default
    return "wasserstein"  # Good compromise
```

## Combined Drift Score

```python
def combined_drift_score(
    expected: np.ndarray,
    actual: np.ndarray,
    weights: dict = None
) -> dict:
    """
    Calculate multiple drift metrics and combine them.

    Args:
        expected: Baseline distribution
        actual: Current distribution
        weights: Optional weights for combining scores

    Returns:
        Dict with individual and combined scores
    """
    weights = weights or {
        "psi": 0.4,
        "wasserstein": 0.3,
        "js": 0.3
    }

    # Calculate individual metrics
    psi = calculate_psi(expected, actual)
    wasserstein = wasserstein_drift(expected, actual, normalize=True)
    js = js_divergence(expected, actual)

    # Normalize PSI to 0-1 range for combining
    psi_normalized = min(psi / 0.5, 1.0)  # Cap at 1.0

    # Weighted combination
    combined = (
        weights["psi"] * psi_normalized +
        weights["wasserstein"] * wasserstein +
        weights["js"] * js
    )

    return {
        "psi": psi,
        "psi_normalized": psi_normalized,
        "wasserstein": wasserstein,
        "js_divergence": js,
        "combined_score": combined,
        "drift_detected": combined > 0.15
    }
```

## References

- [Evidently AI: Data Drift Detection Methods](https://www.evidentlyai.com/blog/data-drift-detection-large-datasets)
- [Arize: KL Divergence When To Use](https://arize.com/blog-course/kl-divergence/)
- [Arize: Kolmogorov-Smirnov Test](https://arize.com/blog-course/kolmogorov-smirnov-test/)
- [Superwise: Introduction to Drift Metrics](https://superwise.ai/blog/a-hands-on-introduction-to-drift-metrics/)
