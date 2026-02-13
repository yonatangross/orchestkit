---
title: "Drift: Quality Regression"
impact: HIGH
impactDescription: "Quality drift detection catches LLM output degradation before users notice — essential for maintaining production LLM reliability."
tags: [drift, quality, regression, baseline, canary, embedding, langfuse, scores]
---

# Quality Drift Detection

## Langfuse Score Trend Monitoring

```python
from langfuse import Langfuse
import numpy as np
from datetime import datetime, timedelta

langfuse = Langfuse()

def check_quality_drift(days: int = 7, threshold_drop: float = 0.1):
    """Compare recent quality scores against baseline."""

    current_scores = langfuse.fetch_scores(
        name="quality_overall",
        from_timestamp=datetime.now() - timedelta(days=1)
    )

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

## Canary Prompt Monitoring

Track consistency with fixed test inputs to detect behavioral changes:

```python
CANARY_PROMPTS = [
    {"id": "summarize_01", "prompt": "Summarize: The quick brown fox...",
     "expected_keywords": ["fox", "dog", "jump"]},
    {"id": "classify_01", "prompt": "Classify sentiment: Great product!",
     "expected_output": "positive"},
]

async def run_canary_checks():
    """Run fixed test inputs and compare against expected outputs."""
    results = []
    for canary in CANARY_PROMPTS:
        response = await llm.generate(canary["prompt"])

        if "expected_keywords" in canary:
            score = sum(
                1 for kw in canary["expected_keywords"]
                if kw.lower() in response.lower()
            ) / len(canary["expected_keywords"])
        elif "expected_output" in canary:
            score = 1.0 if canary["expected_output"] in response.lower() else 0.0

        results.append({"id": canary["id"], "score": score})

    avg_score = np.mean([r["score"] for r in results])
    return {"canary_score": avg_score, "drift": avg_score < 0.8, "details": results}
```

## Embedding Drift (Centroid Monitoring)

```python
import numpy as np

class CentroidMonitor:
    """Monitor drift via embedding centroid movement."""

    def __init__(self, distance_threshold: float = 0.2):
        self.distance_threshold = distance_threshold
        self.baseline_centroid = None
        self.baseline_std = None

    def set_baseline(self, embeddings: np.ndarray):
        self.baseline_centroid = embeddings.mean(axis=0)
        distances = np.linalg.norm(embeddings - self.baseline_centroid, axis=1)
        self.baseline_std = distances.std()
        return self

    def check_drift(self, embeddings: np.ndarray) -> dict:
        current_centroid = embeddings.mean(axis=0)
        centroid_distance = np.linalg.norm(current_centroid - self.baseline_centroid)
        normalized_distance = centroid_distance / (self.baseline_std + 1e-10)

        distances = np.linalg.norm(embeddings - self.baseline_centroid, axis=1)
        outlier_ratio = (distances > 3 * self.baseline_std).mean()

        return {
            "normalized_distance": float(normalized_distance),
            "outlier_ratio": float(outlier_ratio),
            "drift_detected": normalized_distance > self.distance_threshold,
        }
```

## Cluster-Based Drift Detection

```python
from sklearn.cluster import KMeans

class ClusterDriftDetector:
    """Detect drift by monitoring cluster distributions."""

    def __init__(self, n_clusters=10, psi_threshold=0.25):
        self.n_clusters = n_clusters
        self.psi_threshold = psi_threshold
        self.kmeans = None
        self.baseline_distribution = None

    def fit_baseline(self, embeddings):
        self.kmeans = KMeans(n_clusters=self.n_clusters, random_state=42)
        labels = self.kmeans.fit_predict(embeddings)
        self.baseline_distribution = np.bincount(labels, minlength=self.n_clusters) / len(labels)
        return self

    def detect_drift(self, embeddings):
        labels = self.kmeans.predict(embeddings)
        current = np.bincount(labels, minlength=self.n_clusters) / len(labels)
        psi = self._calculate_psi(self.baseline_distribution, current)
        return {"psi": psi, "drift_detected": psi > self.psi_threshold}
```

## Multi-Metric Quality Tracker

```python
class MultiMetricEWMA:
    """Track multiple quality metrics with independent baselines."""

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

## RAG Retrieval Drift

Monitor drift in RAG retrieval quality by comparing retrieved document overlap against baseline queries. Track coverage ratio (what fraction of expected documents are still returned) to detect index staleness, embedding model changes, or corpus drift.

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Baseline window | 7-30 days rolling window |
| Quality threshold | avg_score > 0.7 for production |
| Canary frequency | Every 6 hours minimum |
| Embedding method | Centroid distance for speed, cluster PSI for depth |
