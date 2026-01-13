# LangGraph Checkpoints Checklist

## Backend Selection

- [ ] Choose appropriate backend
- [ ] Configure connection settings
- [ ] Test connection on startup
- [ ] Plan for cleanup/retention

| Backend | Use Case |
|---------|----------|
| MemorySaver | Development/testing |
| SQLite | Local persistence |
| PostgreSQL | Production |
| Redis | High-throughput |

## Configuration

- [ ] Set checkpoint frequency
- [ ] Configure retention policy
- [ ] Handle large state serialization
- [ ] Enable async for production

## Recovery

- [ ] Handle missing checkpoints
- [ ] Implement retry logic
- [ ] Log checkpoint operations
- [ ] Test recovery scenarios

## Performance

- [ ] Use async checkpointers
- [ ] Batch checkpoint writes
- [ ] Compress large states
- [ ] Monitor checkpoint latency

## Cleanup

- [ ] Delete old checkpoints
- [ ] Set TTL for conversations
- [ ] Clean up on errors
- [ ] Monitor storage usage
