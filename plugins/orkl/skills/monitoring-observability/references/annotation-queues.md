# Annotation Queues

Human-review workflow in Langfuse: route traces to reviewers, collect scores, feed decisions into golden dataset curation.

## What Are Annotation Queues?

Annotation queues let you route specific traces to human reviewers for scoring. Reviewers see the trace inputs, outputs, and existing automated scores, then add a human judgment score. The collected scores become ground truth for evaluator calibration and golden dataset inclusion decisions.

Typical uses:
- Spot-checking high-cost or high-stakes LLM outputs
- Reviewing traces flagged as low-quality by automated evaluators
- Building ground-truth labels for fine-tuning or RAG evaluation

## Creating Queues via Langfuse UI

1. Navigate to **Annotation Queues** in the left sidebar
2. Click **Create Queue**
3. Configure:
   - **Name** — e.g., `quality-review`, `safety-check`, `golden-dataset-candidates`
   - **Description** — what reviewers should evaluate
   - **Score configs** — which scoring dimensions to collect (e.g., `accuracy`, `relevance`, `safety`)
4. Share the queue URL with reviewers — no code access required

Score configs define what the reviewer sees and scores. Create them under **Settings → Score Configs** before creating the queue.

## Adding Traces to a Queue Programmatically

Use `get_client().create_annotation_queue_item()` inside an `@observe`-decorated function to route a trace for human review:

```python
from langfuse import observe, get_client

@observe(name="generate-response")
async def generate_and_flag(user_query: str, queue_id: str) -> str:
    """Generate a response and flag low-confidence outputs for human review."""
    response = await llm.generate(user_query)
    score = await auto_evaluate(response)

    # Flag for human review when automated confidence is low
    if score < 0.7:
        lf = get_client()
        trace_id = lf.get_current_trace_id()
        lf.create_annotation_queue_item(
            queue_id=queue_id,
            trace_id=trace_id,
        )

    return response
```

You can also add traces to a queue outside of an `@observe` context using a standalone client:

```python
from langfuse import Langfuse

lf = Langfuse()

# Add a known trace ID to a review queue
lf.create_annotation_queue_item(
    queue_id="queue-abc123",
    trace_id="trace-xyz789",
)
```

Retrieve queue IDs programmatically via the Langfuse API or copy them from the UI URL.

## Human-Review Workflow

```
Trace in Langfuse
      |
      v
[Automated score < threshold]
      |
      v
create_annotation_queue_item()  →  Queue
                                      |
                                      v
                              Reviewer opens queue URL
                                      |
                              Views: input / output / existing scores
                                      |
                              Adds human scores (accuracy, safety, etc.)
                                      |
                                      v
                          Scores stored on trace in Langfuse
                                      |
                                      v
                    [Optional] Trigger golden dataset inclusion
```

Reviewers access queues via the Langfuse UI — no SDK or code access required. The reviewer sees:
- The trace input and output
- Any automated scores already applied
- The score dimensions configured for the queue

After scoring, human scores appear on the trace alongside automated scores and are queryable via the Langfuse API.

## Fetching Completed Annotations

Query finished annotation items to drive downstream automation (e.g., auto-include high-scored traces into the golden dataset):

```python
import httpx
import base64
import os

LANGFUSE_HOST = os.environ["LANGFUSE_HOST"]
PUBLIC_KEY = os.environ["LANGFUSE_PUBLIC_KEY"]
SECRET_KEY = os.environ["LANGFUSE_SECRET_KEY"]

auth = base64.b64encode(f"{PUBLIC_KEY}:{SECRET_KEY}".encode()).decode()
headers = {"Authorization": f"Basic {auth}"}

async def fetch_completed_annotations(queue_id: str) -> list[dict]:
    """Fetch completed annotation queue items."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{LANGFUSE_HOST}/api/public/annotation-queues/{queue_id}/items",
            headers=headers,
            params={"status": "DONE"},
        )
        resp.raise_for_status()
        return resp.json()["data"]

async def promote_high_quality_to_dataset(queue_id: str, dataset_name: str):
    """Add human-approved traces to golden dataset."""
    from langfuse import Langfuse
    lf = Langfuse()

    items = await fetch_completed_annotations(queue_id)
    for item in items:
        # Check human score threshold
        scores = item.get("scores", [])
        quality_scores = [s["value"] for s in scores if s["name"] == "accuracy"]
        if quality_scores and quality_scores[0] >= 0.8:
            lf.create_dataset_item(
                dataset_name=dataset_name,
                trace_id=item["traceId"],
            )
```

## Link to Golden Dataset Curation

Annotation queues feed directly into golden dataset curation:

1. Automated multi-agent pipeline scores content (`accuracy`, `coherence`, `depth`, `relevance`)
2. Items with `quality_total >= 0.75` but low confidence go to the `golden-dataset-candidates` queue
3. Human reviewer confirms or overrides the automated decision
4. Approved traces are added to the evaluation dataset via `create_dataset_item()`

See `../../golden-dataset/rules/curation-annotation.md` for the parallel multi-agent scoring pipeline that feeds this queue.

## References

- [Langfuse Annotation Queues docs](https://langfuse.com/docs/scores/annotation)
- `../references/evaluation-scores.md` — automated scoring patterns
- `../../golden-dataset/rules/curation-annotation.md` — multi-agent curation pipeline
