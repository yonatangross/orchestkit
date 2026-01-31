# Embedding Drift Detection

Monitor semantic drift in LLM applications using embedding-based methods.

## Overview

Traditional statistical methods (PSI, KS) don't work well for unstructured text data. Embedding drift detection uses vector representations to detect semantic changes.

## Arize Phoenix Integration

```python
import phoenix as px
from phoenix.trace import TraceDataset
import numpy as np

# Launch Phoenix for local observability
session = px.launch_app()

# Analyze embedding drift
def analyze_embedding_drift(
    baseline_embeddings: np.ndarray,
    current_embeddings: np.ndarray
) -> dict:
    """
    Analyze drift in embedding space using Phoenix.

    Args:
        baseline_embeddings: Reference embeddings (N x D)
        current_embeddings: Current embeddings (M x D)

    Returns:
        Drift analysis results
    """
    # Phoenix provides built-in drift analysis
    drift_analysis = px.Client().compute_drift(
        primary_embeddings=current_embeddings,
        reference_embeddings=baseline_embeddings
    )

    return drift_analysis
```

## Cluster-Based Drift Detection

```python
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import numpy as np

class ClusterDriftDetector:
    """Detect drift by monitoring cluster distributions."""

    def __init__(self, n_clusters: int = 10, psi_threshold: float = 0.25):
        self.n_clusters = n_clusters
        self.psi_threshold = psi_threshold
        self.kmeans = None
        self.baseline_distribution = None

    def fit_baseline(self, embeddings: np.ndarray):
        """Fit clusters on baseline embeddings."""
        self.kmeans = KMeans(
            n_clusters=self.n_clusters,
            random_state=42,
            n_init=10
        )
        labels = self.kmeans.fit_predict(embeddings)

        # Store baseline cluster distribution
        self.baseline_distribution = np.bincount(
            labels,
            minlength=self.n_clusters
        ) / len(labels)

        return self

    def detect_drift(self, embeddings: np.ndarray) -> dict:
        """Detect drift in new embeddings."""
        if self.kmeans is None:
            raise ValueError("Must call fit_baseline first")

        # Assign new embeddings to clusters
        labels = self.kmeans.predict(embeddings)

        # Current cluster distribution
        current_distribution = np.bincount(
            labels,
            minlength=self.n_clusters
        ) / len(labels)

        # Calculate PSI between distributions
        psi = self._calculate_psi(
            self.baseline_distribution,
            current_distribution
        )

        # Calculate centroid distances
        centroid_shift = self._calculate_centroid_shift(embeddings, labels)

        return {
            "psi": psi,
            "drift_detected": psi > self.psi_threshold,
            "baseline_distribution": self.baseline_distribution.tolist(),
            "current_distribution": current_distribution.tolist(),
            "centroid_shift": centroid_shift,
            "interpretation": self._interpret(psi, centroid_shift)
        }

    def _calculate_psi(self, expected: np.ndarray, actual: np.ndarray) -> float:
        """Calculate PSI between cluster distributions."""
        eps = 0.0001
        expected = expected + eps
        actual = actual + eps
        return np.sum((actual - expected) * np.log(actual / expected))

    def _calculate_centroid_shift(
        self,
        embeddings: np.ndarray,
        labels: np.ndarray
    ) -> dict:
        """Calculate how much cluster centroids have shifted."""
        shifts = {}
        for i in range(self.n_clusters):
            cluster_embeddings = embeddings[labels == i]
            if len(cluster_embeddings) > 0:
                current_centroid = cluster_embeddings.mean(axis=0)
                baseline_centroid = self.kmeans.cluster_centers_[i]
                shift = np.linalg.norm(current_centroid - baseline_centroid)
                shifts[f"cluster_{i}"] = float(shift)
        return shifts

    def _interpret(self, psi: float, centroid_shift: dict) -> str:
        avg_shift = np.mean(list(centroid_shift.values()))
        if psi < 0.1 and avg_shift < 0.1:
            return "No significant drift"
        elif psi < 0.25:
            return "Minor drift detected, monitor closely"
        else:
            return "Significant drift, investigate and consider retraining"
```

## Centroid Distance Monitoring

```python
import numpy as np
from typing import Optional

class CentroidMonitor:
    """Monitor drift via embedding centroid movement."""

    def __init__(self, distance_threshold: float = 0.2):
        self.distance_threshold = distance_threshold
        self.baseline_centroid: Optional[np.ndarray] = None
        self.baseline_std: Optional[float] = None

    def set_baseline(self, embeddings: np.ndarray):
        """Set baseline centroid from reference embeddings."""
        self.baseline_centroid = embeddings.mean(axis=0)

        # Calculate average distance from centroid
        distances = np.linalg.norm(
            embeddings - self.baseline_centroid,
            axis=1
        )
        self.baseline_std = distances.std()

        return self

    def check_drift(self, embeddings: np.ndarray) -> dict:
        """Check if current embeddings have drifted from baseline."""
        if self.baseline_centroid is None:
            raise ValueError("Must call set_baseline first")

        # Current centroid
        current_centroid = embeddings.mean(axis=0)

        # Distance between centroids
        centroid_distance = np.linalg.norm(
            current_centroid - self.baseline_centroid
        )

        # Normalized by baseline spread
        normalized_distance = centroid_distance / (self.baseline_std + 1e-10)

        # Check individual embedding distances
        distances = np.linalg.norm(
            embeddings - self.baseline_centroid,
            axis=1
        )
        outlier_ratio = (distances > 3 * self.baseline_std).mean()

        return {
            "centroid_distance": float(centroid_distance),
            "normalized_distance": float(normalized_distance),
            "outlier_ratio": float(outlier_ratio),
            "drift_detected": normalized_distance > self.distance_threshold,
            "severity": self._severity(normalized_distance, outlier_ratio)
        }

    def _severity(self, distance: float, outlier_ratio: float) -> str:
        if distance < 0.1 and outlier_ratio < 0.05:
            return "none"
        elif distance < 0.2 and outlier_ratio < 0.1:
            return "low"
        elif distance < 0.3 and outlier_ratio < 0.2:
            return "medium"
        else:
            return "high"
```

## Cosine Similarity Drift

```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

def cosine_drift_score(
    baseline_embeddings: np.ndarray,
    current_embeddings: np.ndarray,
    sample_size: int = 1000
) -> dict:
    """
    Measure drift using cosine similarity distributions.

    Args:
        baseline_embeddings: Reference embeddings
        current_embeddings: Current embeddings
        sample_size: Number of pairs to sample

    Returns:
        Drift analysis based on cosine similarities
    """
    # Sample pairs for efficiency
    n_baseline = min(len(baseline_embeddings), sample_size)
    n_current = min(len(current_embeddings), sample_size)

    baseline_sample = baseline_embeddings[
        np.random.choice(len(baseline_embeddings), n_baseline, replace=False)
    ]
    current_sample = current_embeddings[
        np.random.choice(len(current_embeddings), n_current, replace=False)
    ]

    # Baseline self-similarity
    baseline_centroid = baseline_sample.mean(axis=0)
    baseline_similarities = cosine_similarity(
        baseline_sample,
        baseline_centroid.reshape(1, -1)
    ).flatten()

    # Current similarity to baseline centroid
    current_similarities = cosine_similarity(
        current_sample,
        baseline_centroid.reshape(1, -1)
    ).flatten()

    # Compare distributions
    baseline_mean = baseline_similarities.mean()
    current_mean = current_similarities.mean()

    similarity_drop = baseline_mean - current_mean

    return {
        "baseline_mean_similarity": float(baseline_mean),
        "current_mean_similarity": float(current_mean),
        "similarity_drop": float(similarity_drop),
        "drift_detected": similarity_drop > 0.1,
        "interpretation": (
            "Significant semantic drift"
            if similarity_drop > 0.1
            else "No significant drift"
        )
    }
```

## RAG Retrieval Drift

```python
from typing import List
import numpy as np

class RAGDriftMonitor:
    """Monitor drift in RAG retrieval quality."""

    def __init__(
        self,
        similarity_threshold: float = 0.7,
        coverage_threshold: float = 0.8
    ):
        self.similarity_threshold = similarity_threshold
        self.coverage_threshold = coverage_threshold
        self.baseline_queries: List[np.ndarray] = []
        self.baseline_retrievals: List[List[np.ndarray]] = []

    def add_baseline(
        self,
        query_embedding: np.ndarray,
        retrieved_embeddings: List[np.ndarray]
    ):
        """Add a query-retrieval pair to baseline."""
        self.baseline_queries.append(query_embedding)
        self.baseline_retrievals.append(retrieved_embeddings)

    def check_retrieval_drift(
        self,
        query_embedding: np.ndarray,
        retrieved_embeddings: List[np.ndarray]
    ) -> dict:
        """
        Check if retrieval for a query has drifted.

        Useful for detecting:
        - Index staleness
        - Embedding model changes
        - Document corpus drift
        """
        # Find most similar baseline query
        similarities = [
            cosine_similarity(
                query_embedding.reshape(1, -1),
                bq.reshape(1, -1)
            )[0, 0]
            for bq in self.baseline_queries
        ]

        best_match_idx = np.argmax(similarities)
        query_similarity = similarities[best_match_idx]

        if query_similarity < self.similarity_threshold:
            return {
                "drift_detected": False,
                "reason": "Query too different from baseline"
            }

        # Compare retrieved documents
        baseline_retrieved = self.baseline_retrievals[best_match_idx]

        # Calculate coverage: how many baseline docs are still retrieved
        coverage = self._calculate_coverage(
            baseline_retrieved,
            retrieved_embeddings
        )

        return {
            "query_similarity": float(query_similarity),
            "coverage": float(coverage),
            "drift_detected": coverage < self.coverage_threshold,
            "interpretation": (
                f"Retrieval coverage dropped to {coverage:.2%}"
                if coverage < self.coverage_threshold
                else "Retrieval stable"
            )
        }

    def _calculate_coverage(
        self,
        baseline: List[np.ndarray],
        current: List[np.ndarray]
    ) -> float:
        """Calculate what fraction of baseline docs are still retrieved."""
        if not baseline or not current:
            return 0.0

        baseline_stack = np.stack(baseline)
        current_stack = np.stack(current)

        # For each baseline doc, check if similar doc is in current
        similarities = cosine_similarity(baseline_stack, current_stack)
        max_similarities = similarities.max(axis=1)

        # Count docs with similarity > threshold
        covered = (max_similarities > self.similarity_threshold).sum()

        return covered / len(baseline)
```

## Evidently AI Integration

```python
from evidently import Report
from evidently.metrics import EmbeddingsDriftMetric
import pandas as pd
import numpy as np

def evidently_embedding_drift(
    baseline_embeddings: np.ndarray,
    current_embeddings: np.ndarray,
    embedding_column: str = "embedding"
) -> dict:
    """
    Use Evidently AI for embedding drift detection.

    Evidently uses model-based drift detection by default:
    Trains a classifier to distinguish baseline vs current.
    """
    # Create DataFrames
    baseline_df = pd.DataFrame({
        embedding_column: list(baseline_embeddings)
    })
    current_df = pd.DataFrame({
        embedding_column: list(current_embeddings)
    })

    # Run Evidently report
    report = Report(metrics=[
        EmbeddingsDriftMetric(column_name=embedding_column)
    ])

    report.run(
        reference_data=baseline_df,
        current_data=current_df
    )

    # Extract results
    result = report.as_dict()["metrics"][0]["result"]

    return {
        "drift_score": result.get("drift_score"),
        "drift_detected": result.get("drift_detected"),
        "method": "model_based",
        "details": result
    }
```

## References

- [Arize Phoenix Documentation](https://arize.com/docs/phoenix)
- [Evidently AI: Embedding Drift Detection](https://www.evidentlyai.com/blog/embedding-drift-detection)
- [Measuring Embedding Drift](https://medium.com/data-science/measuring-embedding-drift-aa9b7ddb84ae)
- [AWS: Monitor Embedding Drift for LLMs](https://aws.amazon.com/blogs/machine-learning/monitor-embedding-drift-for-llms-deployed-from-amazon-sagemaker-jumpstart/)
