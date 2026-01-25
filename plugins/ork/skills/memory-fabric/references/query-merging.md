# Query Merging Algorithm

Detailed algorithm for merging results from mem0 and mcp__memory.

## Parallel Query Execution

Execute both queries simultaneously to minimize latency:

```javascript
// Execute in parallel
const [mem0Results, graphResults] = await Promise.all([
  mcp__mem0__search_memories({ query, filters, limit: 10, enable_graph: true }),
  mcp__memory__search_nodes({ query })
]);
```

## Result Normalization

Transform each source to unified format:

**From mem0:**
```json
{
  "id": "mem0:{memory_id}",
  "text": "{memory text}",
  "source": "mem0",
  "timestamp": "{created_at}",
  "relevance": "{score / 100}",
  "entities": "[extracted from text]",
  "metadata": "{original metadata}"
}
```

**From graph:**
```json
{
  "id": "graph:{entity_name}",
  "text": "{observations joined}",
  "source": "graph",
  "timestamp": "null",
  "relevance": "1.0 for exact match, 0.8 for partial",
  "entities": "[name, related entities]",
  "metadata": { "entityType": "{type}", "relations": [] }
}
```

## Deduplication Logic

Calculate similarity using normalized text comparison:

```python
def similarity(text_a, text_b):
    # Normalize: lowercase, remove punctuation, tokenize
    tokens_a = normalize(text_a)
    tokens_b = normalize(text_b)

    # Jaccard similarity
    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    return intersection / union if union > 0 else 0

# Merge if similarity > 0.85
if similarity(result_a.text, result_b.text) > DEDUP_THRESHOLD:
    merged = merge_results(result_a, result_b)
```

**Merge Strategy:**
1. Keep text from higher-relevance result
2. Combine entities from both
3. Preserve metadata from both with `source_*` prefix
4. Set `cross_validated: true`

## Cross-System Boosting

When mem0 result mentions a graph entity:

```python
for mem0_result in mem0_results:
    for entity in graph_entities:
        if entity.name.lower() in mem0_result.text.lower():
            mem0_result.relevance *= BOOST_FACTOR  # 1.2x
            mem0_result.graph_relations = entity.relations
            mem0_result.cross_referenced = True
```

## Final Ranking Formula

```python
def compute_score(result):
    # Recency: decay over 30 days
    age_days = (now - result.timestamp).days
    recency = max(0.1, 1.0 - (age_days / 30))

    # Source authority
    authority = 1.0
    if result.cross_validated:
        authority = 1.3
    elif result.source == "graph":
        authority = 1.1

    # Final score
    return (recency * 0.3) + (result.relevance * 0.5) + (authority * 0.2)
```

## Output Assembly

```json
{
  "query": "original query",
  "total_results": 8,
  "sources": { "mem0": 5, "graph": 4, "merged": 1 },
  "results": "[sorted by score descending]"
}
```
