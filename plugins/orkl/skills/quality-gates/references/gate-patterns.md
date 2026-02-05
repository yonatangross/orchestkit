# Quality Gate Patterns Reference

## Overview

Quality gates are automated checkpoints that enforce quality standards before allowing work to proceed. They prevent low-quality outputs from propagating through pipelines.

## Gate Types

### 1. Threshold Gates
**Purpose**: Enforce minimum quality scores before proceeding

**Pattern**:
```python
def threshold_gate(result: QualityResult, threshold: float = 0.7) -> GateDecision:
    """Block if quality score below threshold"""
    if result.overall_score < threshold:
        return GateDecision(
            passed=False,
            reason=f"Quality score {result.overall_score:.2f} below threshold {threshold}",
            retry_allowed=True
        )
    return GateDecision(passed=True)
```

**Use when**:
- You have quantifiable quality metrics (0-1 scores)
- Clear minimum acceptable quality exists
- Failures should trigger retry/escalation

**Thresholds by context**:
| Context | Minimum | Production | Gold Standard |
|---------|---------|------------|---------------|
| AI Content Analysis | 0.60 | 0.75 | 0.85 |
| Code Review | 0.70 | 0.80 | 0.90 |
| API Responses | 0.65 | 0.75 | 0.85 |
| Test Coverage | 0.80 | 0.85 | 0.95 |

### 2. Complexity Gates
**Purpose**: Prevent overwhelming tasks from proceeding without intervention

**Pattern**:
```python
def complexity_gate(analysis: ComplexityAnalysis) -> GateDecision:
    """Block overly complex tasks requiring decomposition"""
    
    # Scoring: 1 (trivial) to 5 (expert-level)
    if analysis.complexity_score > 3:
        return GateDecision(
            passed=False,
            reason=f"Complexity score {analysis.complexity_score}/5 requires task breakdown",
            action_required="DECOMPOSE",
            retry_allowed=False  # Must fix structure first
        )
    
    # Warning for moderate complexity
    if analysis.complexity_score == 3:
        return GateDecision(
            passed=True,
            warnings=[f"Moderate complexity - monitor progress closely"],
            action_required="MONITOR"
        )
    
    return GateDecision(passed=True)
```

**Complexity indicators**:
- **Score 1-2**: Simple, single-agent capable
- **Score 3**: Moderate, requires monitoring
- **Score 4-5**: Complex, requires decomposition or expert review

**Blocking criteria**:
- Missing critical dependencies (>2 unknown items)
- Ambiguous requirements (>3 clarification questions)
- Multi-domain scope without clear boundaries

### 3. Dependency Gates
**Purpose**: Ensure prerequisites are met before proceeding

**Pattern**:
```python
def dependency_gate(task: Task, completed_tasks: Set[str]) -> GateDecision:
    """Block if dependencies not satisfied"""
    
    missing = set(task.depends_on) - completed_tasks
    
    if missing:
        return GateDecision(
            passed=False,
            reason=f"Missing dependencies: {', '.join(missing)}",
            blockers=list(missing),
            retry_allowed=True  # Can retry after deps complete
        )
    
    return GateDecision(passed=True)
```

**Use when**:
- Sequential workflows with clear dependencies
- Downstream tasks require upstream data
- Parallel execution needs synchronization points

### 4. Attempt Limit Gates
**Purpose**: Detect stuck workflows and escalate

**Pattern**:
```python
def attempt_limit_gate(task: Task, max_attempts: int = 3) -> GateDecision:
    """Block after N failed attempts"""
    
    if task.attempt_count >= max_attempts:
        return GateDecision(
            passed=False,
            reason=f"Failed {task.attempt_count} attempts, escalating",
            action_required="ESCALATE",
            retry_allowed=False,  # No more auto-retries
            escalation_data={
                "attempts": task.attempt_count,
                "last_error": task.last_error,
                "time_spent": task.total_duration
            }
        )
    
    return GateDecision(passed=True)
```

**Escalation triggers**:
- 3+ failed attempts on same task
- Total time spent > 2x estimated duration
- Repeating error patterns (same failure 2+ times)

### 5. Composite Gates
**Purpose**: Combine multiple gate conditions

**Pattern**:
```python
def composite_gate(
    task: Task,
    quality_result: QualityResult,
    complexity: ComplexityAnalysis
) -> GateDecision:
    """Evaluate multiple gate conditions"""
    
    gates = [
        threshold_gate(quality_result, threshold=0.75),
        complexity_gate(complexity),
        attempt_limit_gate(task, max_attempts=3)
    ]
    
    # Fail if ANY gate fails
    failures = [g for g in gates if not g.passed]
    if failures:
        return GateDecision(
            passed=False,
            reason="Multiple gate failures",
            sub_failures=failures,
            retry_allowed=all(g.retry_allowed for g in failures)
        )
    
    # Collect all warnings
    warnings = [w for g in gates for w in g.warnings]
    
    return GateDecision(passed=True, warnings=warnings)
```

## Failure Handling Strategies

### 1. Retry with Backoff
**When**: Transient failures (network, rate limits, temporary resource issues)

```python
async def retry_with_backoff(
    operation: Callable,
    max_attempts: int = 3,
    base_delay: float = 1.0
) -> Result:
    """Exponential backoff retry"""
    
    for attempt in range(max_attempts):
        try:
            return await operation()
        except TransientError as e:
            if attempt == max_attempts - 1:
                raise
            
            delay = base_delay * (2 ** attempt)  # 1s, 2s, 4s
            await asyncio.sleep(delay)
```

### 2. Graceful Degradation
**When**: Partial results are acceptable

```python
def degrade_gracefully(result: PartialResult) -> GateDecision:
    """Accept incomplete results with warnings"""
    
    if result.completeness < 0.5:
        return GateDecision(passed=False, reason="Too incomplete")
    
    if result.completeness < 0.9:
        return GateDecision(
            passed=True,
            warnings=[f"Partial result: {result.completeness:.0%} complete"],
            metadata={"degraded": True}
        )
    
    return GateDecision(passed=True)
```

### 3. Alternative Path Routing
**When**: Multiple strategies exist for same goal

```python
def route_alternative(task: Task, failure: GateDecision) -> str:
    """Route to alternative strategy on failure"""
    
    if "rate_limit" in failure.reason:
        return "alternative_llm_provider"
    
    if "complexity" in failure.reason:
        return "decompose_and_parallelize"
    
    if "quality" in failure.reason:
        return "enhanced_prompt_strategy"
    
    return "escalate_to_human"
```

## Bypass Criteria

### Safe Bypass Conditions
Quality gates should be bypassable ONLY when:

1. **Explicit Override**: Human explicitly approves bypass with justification
   ```python
   if user_override and user_override.justification:
       logger.warning(f"Gate bypassed: {user_override.justification}")
       return GateDecision(passed=True, bypassed=True)
   ```

2. **Emergency Mode**: System in degraded state, availability > quality
   ```python
   if system.emergency_mode and task.priority == "CRITICAL":
       return GateDecision(passed=True, bypassed=True, reason="Emergency override")
   ```

3. **Experimental Features**: Explicitly marked as experimental/beta
   ```python
   if task.experimental and config.allow_experimental_bypass:
       return GateDecision(passed=True, bypassed=True, warnings=["Experimental bypass"])
   ```

### NEVER Bypass When
- Security vulnerabilities detected
- Data integrity at risk
- Legal/compliance requirements involved
- Production deployments (unless explicit emergency override)

## Monitoring & Observability

### Key Metrics to Track

```python
class GateMetrics:
    """Track gate effectiveness"""
    
    gate_name: str
    pass_rate: float  # % of attempts that pass
    avg_retry_count: float  # Average retries before passing
    bypass_rate: float  # % of bypassed gates (should be <1%)
    false_positive_rate: float  # Gates that blocked valid work
    false_negative_rate: float  # Gates that passed poor work
```

### Alerting Thresholds
- **Pass rate < 70%**: Gate too strict or upstream quality issues
- **Bypass rate > 5%**: Gate being circumvented, investigate why
- **Avg retries > 2**: Gate not providing actionable feedback
- **False positive rate > 10%**: Tune gate thresholds

## Integration Patterns

### LangGraph Integration
```python
from langgraph.graph import StateGraph

def create_workflow_with_gate():
    workflow = StateGraph(State)
    
    # Add nodes
    workflow.add_node("process", process_node)
    workflow.add_node("quality_gate", quality_gate_node)
    workflow.add_node("compress", compress_node)
    
    # Route based on gate decision
    workflow.add_conditional_edges(
        "quality_gate",
        lambda state: "compress" if state.gate_passed else "retry_process"
    )
    
    return workflow
```

### FastAPI Integration
```python
from fastapi import HTTPException, status

async def api_with_gate(input: Input) -> Output:
    """API endpoint with quality gate"""
    
    result = await process(input)
    gate_decision = quality_gate(result)
    
    if not gate_decision.passed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Quality gate failed",
                "reason": gate_decision.reason,
                "retry_allowed": gate_decision.retry_allowed
            }
        )
    
    return result
```

## Best Practices

### 1. Make Gates Actionable
**Bad**: "Quality too low"
**Good**: "Depth score 0.45/1.0 (need 0.75+). Add: technical implementation details, code examples, performance metrics"

### 2. Progressive Escalation
- Attempt 1: Auto-retry with same strategy
- Attempt 2: Auto-retry with enhanced prompts
- Attempt 3: Escalate to human review

### 3. Fail Fast, Fail Loud
- Detect issues early in pipeline
- Log detailed failure context
- Provide actionable remediation steps

### 4. Measure and Tune
- Track gate effectiveness metrics
- A/B test threshold values
- Regular review of bypass requests

### 5. Document Gate Rationale
Every gate should document:
- **Why**: Business/technical reason for gate
- **Threshold**: How values were determined
- **Bypass**: Conditions for safe bypass
- **Ownership**: Who can adjust gate parameters

## Common Anti-Patterns

### ❌ Silent Failures
```python
# BAD: Swallow failures
try:
    result = quality_gate(data)
except Exception:
    pass  # Continue anyway
```

### ❌ Overly Strict Gates
```python
# BAD: Unrealistic thresholds
if quality_score < 0.99:  # 99% threshold unrealistic
    raise QualityError("Not perfect enough")
```

### ❌ No Feedback Loop
```python
# BAD: Block without guidance
if not meets_quality:
    return "Failed"  # User has no idea why or how to fix
```

### ✅ Good Gate Implementation
```python
# GOOD: Clear, actionable, tunable
def quality_gate(result: QualityResult, config: GateConfig) -> GateDecision:
    """
    Quality gate for AI-generated content analysis.
    
    Threshold rationale: 0.75 ensures technical depth while allowing
    for reasonable LLM variation. Tuned via A/B testing over 200 samples.
    
    Bypass: Allowed only for experimental features (config.experimental=True)
    Owner: AI-ML team
    """
    if result.overall_score < config.threshold:
        return GateDecision(
            passed=False,
            reason=f"Score {result.overall_score:.2f} below {config.threshold}",
            actionable_feedback=[
                f"Depth: {result.depth_score:.2f} (need 0.75+) - Add technical details",
                f"Accuracy: {result.accuracy_score:.2f} (need 0.80+) - Verify facts",
                f"Completeness: {result.completeness:.2f} (need 0.70+) - Cover all aspects"
            ],
            retry_allowed=True
        )
    
    return GateDecision(passed=True)
```

---

**References**:
- Google SRE Book: Error Budgets and SLOs
- Accelerate (Forsgren et al.): Deployment frequency metrics
- LangGraph: Conditional routing patterns
