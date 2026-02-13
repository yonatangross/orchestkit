---
title: "Celery: Canvas Workflows"
category: celery
impact: HIGH
impactDescription: Canvas primitives enable complex multi-step task orchestration
tags: [celery, canvas, chain, group, chord, signature, workflow, etl]
---

# Canvas Workflows

## Chains (Sequential)

```python
from celery import chain

workflow = chain(
    extract_data.s(source_id),      # Returns raw_data
    transform_data.s(),              # Receives raw_data
    load_data.s(destination_id),     # Receives clean_data
)
result = workflow.apply_async()
```

## Groups (Parallel)

```python
from celery import group

parallel = group(process_chunk.s(chunk) for chunk in chunks)
group_result = parallel.apply_async()
results = group_result.get()  # List of results
```

## Chords (Parallel + Callback)

```python
from celery import chord

workflow = chord(
    [process_chunk.s(chunk) for chunk in chunks],
    aggregate_results.s()  # Receives list of all results
)
result = workflow.apply_async()
```

## Signatures

```python
# Reusable task signature
sig = signature("tasks.process_order", args=[order_id], kwargs={"priority": "high"})

# Immutable signature (won't receive results from previous task)
sig = process_order.si(order_id)

# Partial signature (curry arguments)
partial_sig = send_email.s(subject="Order Update")
```

## Map and Starmap

```python
workflow = process_item.map([item1, item2, item3])
workflow = send_email.starmap([("user1@ex.com", "S1"), ("user2@ex.com", "S2")])
workflow = process_item.chunks(items, batch_size=100)
```

## Error Handling

- Chain stops when any task fails; subsequent tasks don't run
- If any chord header task fails, the body won't execute
- Always use `si()` (immutable signatures) in chords to prevent arg pollution
