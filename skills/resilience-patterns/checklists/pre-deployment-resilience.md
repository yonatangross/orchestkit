# Pre-Deployment Resilience Checklist

Use this checklist before deploying services with resilience patterns.

## Circuit Breakers

- [ ] **Threshold Configuration**
  - [ ] Failure threshold set appropriately (not too low, not too high)
  - [ ] Recovery timeout allows service to actually recover
  - [ ] Sliding window size captures representative sample

- [ ] **Fallback Behavior**
  - [ ] Every circuit breaker has a defined fallback response
  - [ ] Fallbacks return meaningful partial data when possible
  - [ ] Fallbacks don't call other services with closed circuits

- [ ] **Observability**
  - [ ] State changes logged with structured logging
  - [ ] Metrics exported (Prometheus/Langfuse)
  - [ ] Alerts configured for OPEN state
  - [ ] Dashboard shows circuit status

- [ ] **Testing**
  - [ ] Unit tests for state transitions
  - [ ] Integration tests simulate failure scenarios
  - [ ] Chaos testing validates circuit behavior under load

## Bulkheads

- [ ] **Tier Assignment**
  - [ ] Critical operations in Tier 1 (highest priority)
  - [ ] Standard operations in Tier 2
  - [ ] Optional/background operations in Tier 3
  - [ ] No critical path through Tier 3

- [ ] **Capacity Planning**
  - [ ] Max concurrent based on downstream capacity
  - [ ] Queue sizes prevent memory exhaustion
  - [ ] Timeouts shorter than caller's timeout

- [ ] **Rejection Handling**
  - [ ] Rejection policy defined per tier
  - [ ] HTTP 503 returned with Retry-After header
  - [ ] Rejections logged and metriced

- [ ] **Testing**
  - [ ] Load test validates bulkhead isolation
  - [ ] Tier 3 failure doesn't affect Tier 1
  - [ ] Queue depth monitored under load

## Retry Logic

- [ ] **Error Classification**
  - [ ] Retryable vs non-retryable errors defined
  - [ ] HTTP status codes classified correctly
  - [ ] LLM API errors handled specifically

- [ ] **Backoff Strategy**
  - [ ] Exponential backoff configured
  - [ ] Jitter enabled to prevent thundering herd
  - [ ] Max delay caps retry storms

- [ ] **Limits**
  - [ ] Max attempts bounded (typically 3-5)
  - [ ] Total retry time < caller's timeout
  - [ ] Retry budget prevents system overload

- [ ] **Testing**
  - [ ] Transient failures recovered automatically
  - [ ] Non-retryable errors fail immediately
  - [ ] Retry budget depletes under sustained failures

## LLM Resilience

- [ ] **Fallback Chain**
  - [ ] Primary model defined
  - [ ] At least one fallback model configured
  - [ ] Semantic cache as final fallback
  - [ ] Default response for complete outage

- [ ] **Token Budget**
  - [ ] Budget allocation per category
  - [ ] Truncation strategy defined
  - [ ] Output reserve prevents overflow

- [ ] **Rate Limiting**
  - [ ] Client-side rate limiter configured
  - [ ] Respects API provider limits
  - [ ] Graceful handling of 429 responses

- [ ] **Cost Control**
  - [ ] Per-request cost tracking
  - [ ] Hourly/daily budget alerts
  - [ ] Cost circuit breaker configured

## Integration

- [ ] **Pattern Composition**
  - [ ] Retry INSIDE circuit breaker
  - [ ] Bulkhead wraps retry+circuit
  - [ ] Timeout inside all patterns

- [ ] **Health Endpoints**
  - [ ] /health returns 200 (doesn't check circuit)
  - [ ] /ready reflects degraded state
  - [ ] /resilience shows all pattern status

- [ ] **Configuration**
  - [ ] All thresholds configurable via env vars
  - [ ] Defaults documented
  - [ ] Per-environment overrides

## Observability

- [ ] **Logging**
  - [ ] Structured logging with trace IDs
  - [ ] State changes logged at WARN level
  - [ ] Rejections logged with context

- [ ] **Metrics**
  - [ ] Circuit state gauge
  - [ ] Bulkhead utilization gauge
  - [ ] Retry counter
  - [ ] Latency histograms

- [ ] **Alerting**
  - [ ] Alert when circuit opens
  - [ ] Alert when bulkhead consistently full
  - [ ] Alert when retry budget exhausted
  - [ ] Runbook links in alerts

## Documentation

- [ ] **Architecture**
  - [ ] Resilience patterns documented in ADR
  - [ ] Diagram shows pattern composition
  - [ ] Tier assignments documented

- [ ] **Operations**
  - [ ] Runbook for circuit open scenarios
  - [ ] Runbook for bulkhead exhaustion
  - [ ] Manual override procedures documented

- [ ] **API Documentation**
  - [ ] 503 responses documented
  - [ ] Retry-After header usage documented
  - [ ] Degraded response format documented

## Final Verification

- [ ] **Load Test**
  - [ ] System handles expected load
  - [ ] Graceful degradation under 2x load
  - [ ] Recovery after load spike

- [ ] **Chaos Test**
  - [ ] Dependency failure isolated
  - [ ] Recovery automatic when dependency restored
  - [ ] No cascading failures

- [ ] **Security Review**
  - [ ] Fallback responses don't leak sensitive data
  - [ ] Error messages don't expose internals
  - [ ] Rate limits prevent abuse
