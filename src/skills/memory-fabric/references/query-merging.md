# Query Merging Algorithm

Algorithm for querying and ranking results from the knowledge graph via mcp__memory.

## Query Execution

Execute graph query via MCP:

```bash
# Query knowledge graph (MCP)
mcp__memory__search_nodes({ query })
```

## Result Normalization

Transform graph results to unified format:

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
3. Preserve metadata with `source_*` prefix
4. Set `cross_validated: true`

## Cross-Reference Boosting

When a result mentions a graph entity found elsewhere in the graph:

```python
for result in graph_results:
    for entity in all_graph_entities:
        if entity.name.lower() in result.text.lower():
            result.relevance *= BOOST_FACTOR  # 1.2x
            result.graph_relations = entity.relations
            result.cross_referenced = True
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
    else:
        authority = 1.1

    # Final score
    return (recency * 0.3) + (result.relevance * 0.5) + (authority * 0.2)
```

## Output Assembly

```json
{
  "query": "original query",
  "total_results": 4,
  "sources": { "graph": 4 },
  "results": "[sorted by score descending]"
}
```
