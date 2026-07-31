# RAG Quality Checklist

Quality assurance for agentic RAG implementations.

## Retrieval Quality

- [ ] Semantic search configured with appropriate embedding model
- [ ] Chunk size optimized (512-1024 tokens typical)
- [ ] Chunk overlap configured (10-20% of chunk size)
- [ ] Metadata filtering implemented for scoping
- [ ] Top-k tuned for precision/recall balance

## Document Grading

- [ ] Relevance grading implemented (binary or scored)
- [ ] Grading prompt tested with diverse queries
- [ ] Threshold tuned for false positive/negative balance
- [ ] Fallback behavior defined for low-relevance results

## Query Transformation

- [ ] Query rewriting enabled for failed retrievals
- [ ] Maximum retry count configured (2-3 typical)
- [ ] Query decomposition for multi-concept queries
- [ ] HyDE integration for vocabulary mismatch

## Web Fallback (CRAG)

- [ ] Web search integration configured
- [ ] Rate limiting for web search API
- [ ] Result filtering and quality check
- [ ] Source attribution for web results

## Self-RAG Patterns

- [ ] Adaptive retrieval decision logic implemented
- [ ] Reflection tokens for quality assessment
- [ ] Skip retrieval path for simple queries
- [ ] Confidence thresholds calibrated

## Generation Quality

- [ ] Context formatting optimized
- [ ] Citation/source attribution enforced
- [ ] Hallucination detection enabled
- [ ] Output length appropriate

## Error Handling

- [ ] Graceful degradation on retrieval failure
- [ ] Fallback responses configured
- [ ] Retry logic with exponential backoff
- [ ] Error logging and alerting

## Performance

- [ ] Retrieval latency acceptable (<500ms)
- [ ] Caching for repeated queries
- [ ] Batch embedding for efficiency
- [ ] Async execution where possible

## Monitoring

- [ ] Retrieval metrics tracked (precision, recall)
- [ ] Query success/failure rates logged
- [ ] Web fallback frequency monitored
- [ ] User feedback integration
