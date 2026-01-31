---
name: silent-failure-detection
description: Detect quiet failures in LLM agents - tool skipping, gibberish outputs, infinite loops, and degraded quality. Use when agents appear to work but produce incorrect results.
context: fork
agent: monitoring-engineer
version: 1.0.0
author: OrchestKit
tags: [monitoring, alerting, anomaly, silent-failure, observability, agents, 2026]
user-invocable: false
---

# Silent Failure Detection

Detect when LLM agents fail silently - appearing to work while producing incorrect results.

## Overview

- Detecting when agents skip expected tool calls
- Identifying gibberish or degraded output quality
- Monitoring for infinite loops and token consumption spikes
- Setting up statistical baselines for anomaly detection
- Alerting on non-error failures (service up but logic broken)

## Quick Reference

### Tool Skipping Detection

```python
from langfuse import Langfuse

def check_tool_usage(trace_id: str, expected_tools: list[str]) -> dict:
    """
    Detect when agent skips expected tool calls.

    Based on Akamai's middleware bug: agents stopped using tools
    when hidden middleware injected unexpected instructions.
    """
    langfuse = Langfuse()
    trace = langfuse.fetch_trace(trace_id)

    # Extract tool calls from trace
    actual_tools = [
        span.name for span in trace.observations
        if span.type == "tool"
    ]

    missing_tools = set(expected_tools) - set(actual_tools)

    if missing_tools:
        return {
            "alert": True,
            "type": "tool_skipping",
            "missing": list(missing_tools),
            "message": f"Agent skipped expected tools: {missing_tools}"
        }
    return {"alert": False}
```

### Gibberish/Quality Detection

```python
from langfuse.decorators import observe, langfuse_context

@observe(name="quality_check")
async def detect_gibberish(response: str) -> dict:
    """
    Detect low-quality or gibberish outputs using LLM-as-judge.
    """
    # Quick heuristics first
    if len(response) < 10:
        return {"alert": True, "type": "too_short"}

    if len(set(response.split())) / len(response.split()) < 0.3:
        return {"alert": True, "type": "repetitive"}

    # LLM-as-judge for quality
    judge_prompt = f"""
    Rate this response quality (0-1):
    - 0: Gibberish, nonsensical, or completely wrong
    - 0.5: Partially correct but missing key information
    - 1: High quality, accurate, complete

    Response: {response[:1000]}

    Score (just the number):
    """

    score = await llm.generate(judge_prompt)
    score_value = float(score.strip())

    langfuse_context.score(name="quality_check", value=score_value)

    if score_value < 0.5:
        return {"alert": True, "type": "low_quality", "score": score_value}
    return {"alert": False, "score": score_value}
```

### Loop Detection

```python
class LoopDetector:
    """Detect infinite loops and token consumption spikes."""

    def __init__(
        self,
        max_iterations: int = 10,
        token_spike_multiplier: float = 3.0,
        baseline_tokens: int = 2000
    ):
        self.max_iterations = max_iterations
        self.token_spike_multiplier = token_spike_multiplier
        self.baseline_tokens = baseline_tokens
        self.iteration_count = 0
        self.total_tokens = 0

    def check(self, tokens_used: int) -> dict:
        self.iteration_count += 1
        self.total_tokens += tokens_used

        # Check iteration count
        if self.iteration_count > self.max_iterations:
            return {
                "alert": True,
                "type": "max_iterations",
                "iterations": self.iteration_count,
                "message": f"Agent exceeded {self.max_iterations} iterations"
            }

        # Check token spike
        expected_tokens = self.baseline_tokens * self.iteration_count
        if self.total_tokens > expected_tokens * self.token_spike_multiplier:
            return {
                "alert": True,
                "type": "token_spike",
                "tokens": self.total_tokens,
                "expected": expected_tokens,
                "message": f"Token consumption spike: {self.total_tokens} vs expected {expected_tokens}"
            }

        return {"alert": False}
```

### Statistical Baseline Anomaly Detection

```python
import numpy as np

class BaselineAnomalyDetector:
    """Detect anomalies vs statistical baseline."""

    def __init__(self, window_size: int = 100, z_threshold: float = 3.0):
        self.window_size = window_size
        self.z_threshold = z_threshold
        self.history = []

    def add_observation(self, value: float) -> dict:
        self.history.append(value)
        if len(self.history) > self.window_size:
            self.history = self.history[-self.window_size:]

        if len(self.history) < 10:
            return {"alert": False, "reason": "insufficient_data"}

        mean = np.mean(self.history[:-1])
        std = np.std(self.history[:-1])

        if std == 0:
            return {"alert": False}

        z_score = abs(value - mean) / std

        if z_score > self.z_threshold:
            return {
                "alert": True,
                "type": "statistical_anomaly",
                "z_score": z_score,
                "value": value,
                "mean": mean,
                "std": std
            }
        return {"alert": False, "z_score": z_score}
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Detection priority | Tool skipping > Gibberish > Loops > Anomalies |
| Quality check | LLM-as-judge with heuristic pre-filter |
| Loop threshold | 10 iterations or 3x baseline tokens |
| Anomaly threshold | Z-score > 3.0 (99.7% confidence) |
| Alert strategy | Alert on silent failure, not just errors |

## Silent Failure Types

| Type | Detection Method | Alert Priority |
|------|------------------|----------------|
| Tool Skipping | Expected vs actual tool calls | Critical |
| Gibberish Output | LLM-as-judge + heuristics | High |
| Infinite Loop | Iteration count + token spike | Critical |
| Quality Degradation | Score < baseline | Medium |
| Latency Spike | p99 > threshold | Medium |

## Anti-Patterns

```python
# ❌ NEVER assume success if no error raised
result = await agent.run()
# Missing: quality check, tool usage check

# ❌ NEVER ignore abnormal patterns
if len(response) > 0:  # "Not empty" is not "correct"
    return response

# ✅ ALWAYS validate tool usage
expected_tools = ["search", "calculate"]
tool_check = check_tool_usage(trace_id, expected_tools)
if tool_check["alert"]:
    alert(tool_check)

# ✅ ALWAYS check output quality
quality = await detect_gibberish(response)
if quality["alert"]:
    fallback_to_human_review()
```

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/tool-skipping-detection.md](references/tool-skipping-detection.md) | Agent tool usage monitoring patterns |
| [references/gibberish-detection.md](references/gibberish-detection.md) | Output quality scoring, LLM-as-judge |
| [references/loop-detection.md](references/loop-detection.md) | Token spikes, retry patterns, circuit breakers |
| [references/baseline-comparison.md](references/baseline-comparison.md) | Statistical anomaly detection |
| [checklists/silent-failure-setup-checklist.md](checklists/silent-failure-setup-checklist.md) | Implementation checklist |

## Related Skills

- `langfuse-observability` - Trace analysis for tool usage
- `quality-gates` - Quality threshold enforcement
- `observability-monitoring` - General alerting patterns
- `advanced-guardrails` - LLM output safety checks

## Capability Details

### tool-skipping
**Keywords:** tool skip, missing tool, agent tools, expected behavior
**Solves:**
- Detect when agents don't use expected tools
- Monitor agent behavior consistency
- Debug middleware interference (Akamai scenario)

### gibberish-detection
**Keywords:** gibberish, nonsense, quality check, llm judge
**Solves:**
- Detect low-quality LLM outputs
- Identify repetitive or nonsensical responses
- Quality gate for production outputs

### loop-detection
**Keywords:** infinite loop, retry loop, token spike, stuck agent
**Solves:**
- Detect agents stuck in loops
- Monitor token consumption anomalies
- Prevent runaway costs

### baseline-anomaly
**Keywords:** anomaly, baseline, z-score, statistical, deviation
**Solves:**
- Detect deviations from normal behavior
- Statistical anomaly detection
- Early warning for silent failures

### latency-monitoring
**Keywords:** latency, slow, p99, degraded, performance
**Solves:**
- Detect degraded but non-failing service
- Monitor response time anomalies
- SLO compliance for LLM calls
