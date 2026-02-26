# Quality Gate Implementation Checklist

Use this checklist when implementing quality gates in workflows, APIs, or CI/CD pipelines.

## 1. Gate Definition

### Requirements Gathering
- [ ] **Identify quality dimensions** to measure (e.g., depth, accuracy, completeness, performance)
- [ ] **Define success criteria** with quantifiable thresholds (e.g., score ≥ 0.75)
- [ ] **Document rationale** for threshold values (data-driven, not arbitrary)
- [ ] **Specify failure modes** and their consequences
- [ ] **Determine retry strategy** (auto-retry, enhanced retry, escalate)

### Threshold Determination
- [ ] **Baseline current performance** (run without gate to collect data)
- [ ] **A/B test threshold values** (test 3-5 values with real data)
- [ ] **Measure impact** on pass rate, quality, and downstream metrics
- [ ] **Set conservative initial threshold** (can tighten later with data)
- [ ] **Define threshold by context** if quality requirements vary (e.g., by content type)

### Bypass Criteria
- [ ] **Document safe bypass conditions** (emergency mode, experimental features, explicit override)
- [ ] **Define approval process** for bypass requests (who can approve, required justification)
- [ ] **Set bypass alerting** (notify on every bypass, track bypass rate)
- [ ] **Never bypass for** security, compliance, or data integrity issues

## 2. Implementation

### Core Gate Logic
- [ ] **Implement gate function** with clear pass/fail decision logic
- [ ] **Return structured decision** (passed, reason, retry_allowed, actionable_feedback)
- [ ] **Make decisions deterministic** (same input → same output for debugging)
- [ ] **Include attempt tracking** to prevent infinite retry loops
- [ ] **Add timeout protection** for async operations

### Actionable Feedback
- [ ] **Provide specific failure reasons** (not generic "quality too low")
- [ ] **Include dimension scores** (e.g., "depth: 0.45/1.0, need 0.75+")
- [ ] **Suggest concrete improvements** (e.g., "Add code examples, performance metrics")
- [ ] **Show thresholds clearly** (current value vs. required value)
- [ ] **Link to documentation** or examples of passing work

### Error Handling
- [ ] **Handle evaluation failures** (e.g., LLM timeout, API error)
- [ ] **Implement retry logic** with exponential backoff for transient errors
- [ ] **Set max retry attempts** (typically 3) to prevent infinite loops
- [ ] **Define escalation path** for stuck workflows (human review, alternative strategy)

## 3. Observability

### Logging
- [ ] **Log every gate evaluation** with decision and scores
- [ ] **Log actionable feedback** for failed gates
- [ ] **Include correlation ID** to trace across workflow steps
- [ ] **Use structured logging** (JSON format) for easy querying

### Metrics
- [ ] **Track pass rate** (% of attempts that pass)
- [ ] **Track retry metrics** (avg retries before pass, retry success rate)
- [ ] **Track bypass rate** (should be <1% in normal operation)
- [ ] **Track escalation rate** (% requiring human intervention)
- [ ] **Track false positive rate** (gates blocking valid work)
- [ ] **Track false negative rate** (gates passing poor work)
- [ ] **Track gate latency** (time spent in evaluation)

### Alerting
- [ ] **Alert on low pass rate** (<70%) - may indicate upstream issues
- [ ] **Alert on high bypass rate** (>5%) - gate being circumvented
- [ ] **Alert on evaluation failures** (>1%) - scoring system issues
- [ ] **Alert on stuck workflows** (3+ failed attempts)

## 4. Testing

### Unit Tests
- [ ] **Test threshold boundaries** (score at threshold-0.01, threshold, threshold+0.01)
- [ ] **Test each failure mode** (low depth, low accuracy, etc.)
- [ ] **Test retry logic** (max attempts, exponential backoff)
- [ ] **Test bypass conditions** (all documented bypass scenarios)
- [ ] **Test error handling** (evaluation timeout, API failure, invalid input)

### Integration Tests
- [ ] **Test workflow routing** (pass → compress, fail → retry, escalate → human)
- [ ] **Test state persistence** across retries (attempt count increments correctly)
- [ ] **Test idempotency** (re-running same evaluation gives same result)

## 5. Documentation

### For Developers
- [ ] **Document gate purpose** (why this gate exists, what it protects)
- [ ] **Document threshold rationale** (how values were determined, data source)
- [ ] **Document bypass conditions** (when safe to bypass, approval process)
- [ ] **Provide code examples** of passing/failing cases
- [ ] **Link to monitoring dashboard** (where to view gate metrics)

## 6. Rollout

### Pre-Production
- [ ] **Shadow mode first** (evaluate but don't block, collect data)
- [ ] **Measure baseline pass rate** (should be >70% before enforcing)
- [ ] **Tune thresholds** based on shadow mode data
- [ ] **Review false positives** (manually check 20+ blocked cases)

### Production Rollout
- [ ] **Enable in non-critical path** first (experimental features)
- [ ] **Gradually increase enforcement** (warn → block for 10% → 50% → 100%)
- [ ] **Monitor metrics closely** during rollout (hourly for first week)
- [ ] **Have rollback plan** ready (feature flag to disable gate)

---

**Remember**: Quality gates should **enable** quality work, not **prevent** work. If pass rate <70% or bypass rate >5%, investigate root causes.
