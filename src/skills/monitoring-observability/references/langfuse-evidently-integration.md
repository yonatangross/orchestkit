# Langfuse + Evidently AI Integration

Combining Langfuse tracing with Evidently AI drift detection.

## Export Langfuse Data

```python
from langfuse import Langfuse
import pandas as pd
from datetime import datetime, timedelta

langfuse = Langfuse()

def export_langfuse_scores(days: int = 7) -> pd.DataFrame:
    """Export Langfuse scores to DataFrame for Evidently."""
    traces = langfuse.get_traces(from_timestamp=datetime.now() - timedelta(days=days))
    records = []
    for trace in traces.data:
        scores = {s.name: s.value for s in trace.scores}
        if scores:
            records.append({"trace_id": trace.id, "timestamp": trace.timestamp, **scores})
    return pd.DataFrame(records)
```

## Evidently Drift Report

```python
from evidently import Report
from evidently.metrics import DatasetDriftMetric, ColumnDriftMetric

def run_drift_report(baseline_df: pd.DataFrame, current_df: pd.DataFrame, columns: list) -> dict:
    """Run Evidently drift detection."""
    report = Report(metrics=[DatasetDriftMetric()])
    for col in columns:
        report.metrics.append(ColumnDriftMetric(column_name=col))

    report.run(reference_data=baseline_df, current_data=current_df)
    result = report.as_dict()

    return {
        "dataset_drift": result["metrics"][0]["result"].get("dataset_drift"),
        "drift_share": result["metrics"][0]["result"].get("share_of_drifted_columns")
    }
```

## Automated Monitoring

```python
class LangfuseEvidentlyMonitor:
    def __init__(self, baseline_days: int = 7, current_days: int = 1):
        self.langfuse = Langfuse()
        self.baseline_days = baseline_days
        self.current_days = current_days

    def run_analysis(self, metrics: list) -> dict:
        baseline_df = export_langfuse_scores(self.baseline_days + self.current_days)
        current_df = export_langfuse_scores(self.current_days)
        results = run_drift_report(baseline_df, current_df, metrics)
        return results
```

## References

- [Evidently AI Docs](https://docs.evidentlyai.com/)
- [Langfuse SDK](https://langfuse.com/docs/sdk/python)
