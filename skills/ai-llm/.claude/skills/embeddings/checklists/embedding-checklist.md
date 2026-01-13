# Embedding Implementation Checklist

## Model Selection

- [ ] Choose model based on use case
- [ ] Consider cost vs accuracy tradeoff
- [ ] Use local model for development/CI
- [ ] Document model choice and dimensions

| Model | Dims | Cost | Use Case |
|-------|------|------|----------|
| text-embedding-3-small | 1536 | $0.02/1M | General purpose |
| text-embedding-3-large | 3072 | $0.13/1M | High accuracy |
| nomic-embed-text | 768 | Free | Local/CI |
| Voyage AI | 1024 | $0.10/1M | Code/docs |

## Chunking Strategy

- [ ] Define chunk size (256-1024 tokens typical)
- [ ] Set overlap (10-20%)
- [ ] Include metadata with chunks
- [ ] Handle document boundaries

## Embedding Pipeline

- [ ] Batch embeddings (100-500 per request)
- [ ] Cache embeddings for unchanged content
- [ ] Handle rate limiting
- [ ] Implement retry logic

## Storage

- [ ] Choose vector database (pgvector, Pinecone, etc.)
- [ ] Create appropriate indexes
- [ ] Store metadata alongside vectors
- [ ] Plan for updates/deletions

## Search Implementation

- [ ] Use cosine similarity (normalized vectors)
- [ ] Set appropriate result limit
- [ ] Filter by metadata when needed
- [ ] Implement reranking if needed

## Testing

- [ ] Test with representative queries
- [ ] Verify similarity scores make sense
- [ ] Test edge cases (empty, long text)
- [ ] Benchmark search latency
