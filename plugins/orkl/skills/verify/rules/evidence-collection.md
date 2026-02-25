# Evidence Collection Patterns

## Phase 1: Context Gathering

Run these commands in parallel in ONE message:

```bash
git diff main --stat
git log main..HEAD --oneline
git diff main --name-only | sort -u
```

## Phase 3: Parallel Test Execution

Run backend and frontend tests in parallel:

```bash
# PARALLEL - Backend and frontend
cd backend && poetry run pytest tests/ -v --cov=app --cov-report=json
cd frontend && npm run test -- --coverage
```

## Phase 7: Metrics Tracking

Store verification metrics in memory for trend analysis:

```python
mcp__memory__create_entities(entities=[{
  "name": "verification-{date}-{feature}",
  "entityType": "VerificationMetrics",
  "observations": [f"composite_score: {score}", ...]
}])
```

Query trends: `mcp__memory__search_nodes(query="VerificationMetrics")`

## Phase 8.5: Post-Verification Feedback

After report compilation, send scores to `metrics-architect` for KPI baseline tracking:

```python
Task(subagent_type="metrics-architect", run_in_background=True, max_turns=15,
     prompt=f"""Receive verification scores for {feature}:

Composite: {composite_score}/10 (Grade: {grade})
Dimensional breakdown:
- Correctness: {scores['correctness']}/10
- Maintainability: {scores['maintainability']}/10
- Performance: {scores['performance']}/10
- Security: {scores['security']}/10
- Scalability: {scores['scalability']}/10
- Testability: {scores['testability']}/10
- Compliance: {scores['compliance']}/10

Update KPI baselines with these scores. Store trend data in memory
for historical comparison. Flag any dimensions that dropped below
their historical average.""")
```
