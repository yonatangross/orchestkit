# Temporal Production Deployment Checklist

## Pre-Deployment

### Infrastructure
- [ ] Temporal server/cloud configured with correct namespace
- [ ] TLS certificates provisioned for worker-server communication
- [ ] Database (PostgreSQL/MySQL/Cassandra) sized for expected load
- [ ] Elasticsearch configured for workflow visibility (if self-hosted)
- [ ] Network policies allow worker-to-server communication

### Worker Configuration
- [ ] Task queue names finalized and documented
- [ ] `max_concurrent_activities` tuned for resource limits
- [ ] `max_concurrent_workflow_tasks` set appropriately
- [ ] Worker scaling strategy defined (HPA, manual, etc.)
- [ ] Worker health checks implemented
- [ ] Graceful shutdown handling (SIGTERM)

### Workflow Design
- [ ] All workflows are deterministic (no `random()`, `datetime.now()`)
- [ ] Non-deterministic operations moved to activities
- [ ] `continue_as_new` implemented for long-running workflows
- [ ] Workflow IDs are business-meaningful and idempotent
- [ ] State size kept minimal (< 1MB per workflow)

### Activity Design
- [ ] All activities are idempotent
- [ ] Heartbeating implemented for activities > 60s
- [ ] Timeouts configured: `start_to_close`, `heartbeat`
- [ ] Retry policies defined with `non_retryable_error_types`
- [ ] External API calls have circuit breakers

## Deployment

### Versioning
- [ ] `workflow.patched()` used for breaking changes
- [ ] Worker versioning (build IDs) configured if using worker versioning
- [ ] Old and new workers run simultaneously during rollout
- [ ] Plan to deprecate old patches after workflows complete

### Monitoring
- [ ] Temporal metrics exported (Prometheus endpoint)
- [ ] Alerts configured for:
  - [ ] Workflow failures
  - [ ] Activity failures
  - [ ] Task queue backlog
  - [ ] Worker availability
- [ ] Dashboards created for workflow visibility
- [ ] Langfuse tracing integrated (if using LLM activities)

### Testing
- [ ] Unit tests with `WorkflowEnvironment.start_local()`
- [ ] Integration tests against dev Temporal cluster
- [ ] Time-skipping tests for timer-heavy workflows
- [ ] Saga compensation paths tested
- [ ] Load testing completed

## Post-Deployment

### Validation
- [ ] Verify workflows start successfully
- [ ] Verify activities complete with expected results
- [ ] Verify signals and queries work
- [ ] Verify compensation runs on failure
- [ ] Check Temporal UI for workflow visibility

### Runbook Items
- [ ] Document how to cancel stuck workflows
- [ ] Document how to query workflow state
- [ ] Document how to signal running workflows
- [ ] Document how to reset failed workflows
- [ ] Document how to scale workers

## Security

- [ ] Namespace isolation between environments
- [ ] mTLS between workers and server
- [ ] Secrets not passed in workflow arguments (use activity to fetch)
- [ ] PII handling compliant with regulations
- [ ] Audit logging enabled

## Common Issues to Check

| Issue | Check |
|-------|-------|
| Non-determinism | No `random()`, `datetime.now()`, `uuid4()` in workflows |
| History overflow | `continue_as_new` after ~1000 iterations |
| Activity timeout | `start_to_close_timeout` covers expected duration |
| Lost heartbeat | `heartbeat_timeout` is 1/3 of activity duration |
| Retry storm | `non_retryable_error_types` includes business errors |
| State too large | Workflow state < 1MB |
