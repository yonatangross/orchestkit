# MCP Production Checklist

Pre-deployment validation for MCP servers.

## Server Architecture

- [ ] Transport selected (HTTP for web, stdio for CLI)
- [ ] Lifespan management implemented
- [ ] Resource cleanup on shutdown
- [ ] Error handling configured
- [ ] Logging structured

## Tool Implementation

- [ ] Tool descriptions clear and accurate
- [ ] Input schemas validated
- [ ] Error responses standardized
- [ ] Timeout handling implemented
- [ ] Rate limiting per tool

## Resource Management

- [ ] Resource caching configured
- [ ] TTL appropriate for use case
- [ ] Stale resource cleanup scheduled
- [ ] Memory usage monitored
- [ ] Connection pooling (if applicable)

## Auto-Enable Thresholds

- [ ] Thresholds configured per server criticality:
  - Critical (memory): auto:90
  - High-value (context7): auto:75
  - Reasoning (sequential-thinking): auto:60
  - Resource-intensive (playwright): auto:50
- [ ] Context window monitoring enabled

## Scaling (if multi-instance)

- [ ] Health checks implemented
- [ ] Load balancing configured
- [ ] Graceful degradation on failures
- [ ] Session affinity (if stateful)
- [ ] Failover tested

## Security

- [ ] Tool description sanitization
- [ ] Input validation on all tools
- [ ] Sensitive data handling
- [ ] Rate limiting enforced
- [ ] Audit logging enabled

## Performance

- [ ] Response latency acceptable
- [ ] Throughput sufficient for load
- [ ] Cold start time acceptable
- [ ] Memory footprint appropriate
- [ ] CPU usage monitored

## Monitoring

- [ ] Health endpoint exposed
- [ ] Metrics collection configured
- [ ] Alerting rules defined
- [ ] Error tracking enabled
- [ ] Usage analytics

## Documentation

- [ ] Tool catalog documented
- [ ] Resource schemas documented
- [ ] Configuration options listed
- [ ] Troubleshooting guide
- [ ] Runbook for incidents
