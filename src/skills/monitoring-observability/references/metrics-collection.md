# Metrics Collection

Application metrics best practices with Prometheus.

## Metric Types

### 1. Counter - Monotonically increasing value (resets to 0 on restart)
```python
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

# Usage
http_requests_total.labels(method='GET', endpoint='/api/users', status=200).inc()
```
**Use cases:** Request counts, error counts, bytes processed

### 2. Gauge - Value that can go up or down
```python
active_connections = Gauge(
    'active_connections',
    'Number of active database connections'
)

# Usage
active_connections.set(25)  # Set to specific value
active_connections.inc()    # Increment by 1
active_connections.dec()    # Decrement by 1
```
**Use cases:** Queue length, memory usage, temperature

### 3. Histogram - Distribution of values (with buckets)
```python
request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]  # Choose meaningful buckets!
)

# Usage
with request_duration.labels(method='GET', endpoint='/api/users').time():
    # ... handle request
    pass
```
**Use cases:** Request latency, response size

### 4. Summary - Like Histogram but calculates quantiles on client side
```python
request_duration = Summary(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)
```

**Histogram vs Summary:**
- **Histogram**: Calculate quantiles on Prometheus server (recommended)
- **Summary**: Calculate quantiles on application side (higher client CPU, can't aggregate across instances)

## Cardinality Management

**Problem:** Too many unique label combinations

```python
# BAD: Unbounded cardinality (user_id can be millions of values)
http_requests_total = Counter(
    'http_requests_total',
    ['method', 'endpoint', 'user_id']  # user_id creates millions of time series!
)

# GOOD: Bounded cardinality
http_requests_total = Counter(
    'http_requests_total',
    ['method', 'endpoint', 'status']  # Limited to ~10 methods x 100 endpoints x 10 statuses = 10,000 series
)
```

**Cardinality limits:**
- Good: < 10,000 unique time series per metric
- Acceptable: 10,000-100,000
- Bad: > 100,000 (Prometheus performance degrades)

**Rule:** Never use unbounded labels (user IDs, request IDs, timestamps)

## Custom Business Metrics

```python
# LLM token usage
llm_tokens_used = Counter(
    'llm_tokens_used_total',
    'Total LLM tokens consumed',
    ['model', 'operation']  # e.g., model='claude-sonnet', operation='analysis'
)

# LLM cost tracking
llm_cost_dollars = Counter(
    'llm_cost_dollars_total',
    'Total LLM cost in dollars',
    ['model']
)

# Cache hit rate
cache_operations = Counter(
    'cache_operations_total',
    'Cache operations',
    ['operation', 'result']  # operation='get', result='hit|miss'
)

# Cache hit rate query:
# sum(rate(cache_operations_total{result="hit"}[5m])) /
# sum(rate(cache_operations_total[5m]))
```

## LLM Cost Tracking Example

```python
from prometheus_client import Counter, Histogram

llm_tokens_used = Counter(
    'llm_tokens_used_total',
    'Total LLM tokens consumed',
    ['model', 'operation', 'token_type']
)

llm_cost_dollars = Counter(
    'llm_cost_dollars_total',
    'Total LLM cost in dollars',
    ['model', 'operation']
)

llm_request_duration = Histogram(
    'llm_request_duration_seconds',
    'LLM request duration',
    ['model', 'operation'],
    buckets=[0.5, 1, 2, 5, 10, 20, 30]
)

@observe(name="llm_call")
async def call_llm(prompt: str, model: str, operation: str) -> str:
    start_time = time.time()
    response = await anthropic_client.messages.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024
    )
    duration = time.time() - start_time

    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens

    llm_tokens_used.labels(model=model, operation=operation, token_type="input").inc(input_tokens)
    llm_tokens_used.labels(model=model, operation=operation, token_type="output").inc(output_tokens)

    # Cost calculation (Claude Sonnet 4.5 pricing)
    input_cost = (input_tokens / 1_000_000) * 3.00
    output_cost = (output_tokens / 1_000_000) * 15.00
    total_cost = input_cost + output_cost

    llm_cost_dollars.labels(model=model, operation=operation).inc(total_cost)
    llm_request_duration.labels(model=model, operation=operation).observe(duration)

    return response.content[0].text
```

**Grafana dashboard queries:**
```text
# Total cost per day
sum(increase(llm_cost_dollars_total[1d])) by (model)

# Token usage rate
sum(rate(llm_tokens_used_total[5m])) by (model, token_type)

# Cost per operation
sum(increase(llm_cost_dollars_total[1h])) by (operation)

# p95 LLM latency
histogram_quantile(0.95, rate(llm_request_duration_seconds_bucket[5m]))
```

See `scripts/prometheus-metrics.ts` for complete setup.

## Claude Code OTel Metrics — Notes for Dashboards

Claude Code emits OTel metrics under the `claude_code.*` namespace. Two metrics that frequently appear on team velocity dashboards:

| Metric | Counts |
|---|---|
| `claude_code.tool.use` | Each tool invocation, labelled by `tool` |
| `claude_code.pull_request.count` | PRs/MRs created during sessions |

### CC 2.1.129: `claude_code.pull_request.count` now counts MCP-filed PRs

Before CC 2.1.129, `claude_code.pull_request.count` only counted PRs/MRs created via shell commands run through the Bash tool (`gh pr create`, `glab mr create`, custom scripts). As of CC 2.1.129, the metric **also counts PRs/MRs filed via MCP tools** — e.g., GitHub MCP server's `create_pull_request`, GitLab MCP equivalents, and any custom MCP server exposing a PR/MR-creation tool.

**Impact on existing dashboards**: a step-function increase at the 2.1.129 cutover for teams where MCP-driven PR creation is non-trivial. The "spike" is a measurement-surface change, not a behavioral change. Annotate the dashboard with the version bump so it isn't misread as a productivity surge.

**Labels are unchanged**: the counter still emits `provider` and `result` labels; MCP-filed PRs are not specially flagged. If you need to distinguish MCP vs. shell origins:

```text
# Derive an MCP-origin counter by joining on tool-name in a separate stream
sum(rate(claude_code.pull_request.count[5m])) by (provider)
  - on(provider) sum(rate(claude_code.tool.use{tool=~"Bash"}[5m]))
```

(In practice, hold a separate counter in your collector that increments only on `claude_code.tool.use{tool=~"mcp__.*"}` co-occurring with a PR-creation event.)

**See also**: `${CLAUDE_SKILL_DIR}/../telemetry-inspect/SKILL.md` and `${CLAUDE_SKILL_DIR}/../configure/references/cc-version-settings.md` (CC 2.1.129 section) for the upstream changelog reference.