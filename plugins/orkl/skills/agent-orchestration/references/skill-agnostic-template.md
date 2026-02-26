# Skill-Agnostic Template Abstraction

**Reusable template framework for applying multi-scenario orchestration to ANY user-invocable skill.**

## Template Architecture

```
┌─────────────────────────────────────────────────────────────┐
│               SKILL ORCHESTRATION TEMPLATE                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Abstract Orchestrator]                                   │
│   ├─ Scenario Definition (parameterized)                   │
│   ├─ State Machine (generic)                               │
│   ├─ Synchronization (milestone-based)                     │
│   └─ Aggregation (cross-scenario)                          │
│                                                             │
│  [Skill Adapter Layer]  ◄── Pluggable per skill            │
│   ├─ invoke_skill()                                        │
│   ├─ calculate_quality_metrics()                           │
│   ├─ scenario_configurations()                             │
│   └─ expected_outcomes()                                   │
│                                                             │
│  [Target Skill] ◄── Your skill here                         │
│   ├─ skill-name                                            │
│   ├─ skill-version                                         │
│   └─ skill-params                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Generic Orchestrator Class

```python
from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar
from dataclasses import dataclass

T = TypeVar("T")  # Result type

class SkillOrchestrator(ABC, Generic[T]):
    """
    Abstract orchestrator for any user-invocable skill.

    Subclass for each skill and implement abstract methods.
    """

    def __init__(self, skill_name: str, skill_version: str):
        self.skill_name = skill_name
        self.skill_version = skill_version

    # ──────────────────────────────────────────────────────────
    # Abstract Methods (MUST implement per skill)
    # ──────────────────────────────────────────────────────────

    @abstractmethod
    async def invoke_skill(
        self,
        input_data: list[dict],
        scenario_params: dict,
    ) -> dict[str, Any]:
        """
        Invoke your skill on input data.

        Args:
            input_data: Items to process
            scenario_params: Skill-specific parameters (batch_size, etc.)

        Returns:
            dict with keys:
                - "processed": int (items successfully processed)
                - "results": list[dict] (processed items)
                - "quality_score": float (0-1)
                - "metrics": dict (skill-specific metrics)
                - "errors": list[str] (any errors encountered)
        """
        pass

    @abstractmethod
    def get_scenario_configs(self) -> dict[str, dict]:
        """
        Return scenario configurations for simple/medium/complex.

        Returns:
            {
                "simple": {
                    "input_size": 100,
                    "time_budget_seconds": 30,
                    "batch_size": 10,
                    "skill_params": {...}
                },
                "medium": {...},
                "complex": {...}
            }
        """
        pass

    @abstractmethod
    def calculate_quality_metrics(
        self,
        results: list[dict],
        metric_names: list[str]
    ) -> dict[str, float]:
        """
        Calculate quality metrics from results.

        Args:
            results: Processed items from skill
            metric_names: ["accuracy", "coverage", ...]

        Returns:
            {
                "accuracy": 0.92,
                "coverage": 0.98,
                ...
            }
        """
        pass

    @abstractmethod
    def generate_test_data(
        self,
        size: int,
        characteristics: dict
    ) -> list[dict]:
        """
        Generate test data for this skill.

        Args:
            size: Number of items
            characteristics: {"distribution": "uniform|skewed|clustered"}

        Returns:
            list of test items matching skill's input format
        """
        pass

    # ──────────────────────────────────────────────────────────
    # Concrete Methods (reusable across all skills)
    # ──────────────────────────────────────────────────────────

    async def run_scenario(
        self,
        scenario_id: str,
        orchestration_id: str,
    ) -> dict:
        """
        Execute one scenario (simple/medium/complex).

        Concrete implementation—uses abstract methods.
        """

        config = self.get_scenario_configs()[scenario_id]

        # Generate test data
        test_data = self.generate_test_data(
            size=config["input_size"],
            characteristics=config.get("dataset_characteristics", {})
        )

        # Process in batches
        all_results = []
        batch_size = config.get("batch_size", 10)

        for batch_idx, batch in enumerate(chunks(test_data, batch_size)):
            # Invoke skill (abstract—implemented per skill)
            result = await self.invoke_skill(batch, config["skill_params"])

            all_results.extend(result.get("results", []))

            progress_pct = (len(all_results) / len(test_data)) * 100
            print(f"[{scenario_id}] Progress: {progress_pct:.1f}%")

        # Calculate quality (abstract—implemented per skill)
        quality = self.calculate_quality_metrics(
            all_results,
            config.get("quality_metrics", ["accuracy"])
        )

        return {
            "scenario_id": scenario_id,
            "orchestration_id": orchestration_id,
            "items_processed": len(all_results),
            "quality": quality,
            "results": all_results,
        }

    async def orchestrate(
        self,
        orchestration_id: str
    ) -> dict:
        """
        Run all 3 scenarios in parallel and aggregate results.

        Concrete implementation—reusable for all skills.
        """

        import asyncio

        # Run scenarios in parallel
        results = await asyncio.gather(
            self.run_scenario("simple", orchestration_id),
            self.run_scenario("medium", orchestration_id),
            self.run_scenario("complex", orchestration_id),
            return_exceptions=True
        )

        # Aggregate
        aggregated = self.aggregate_results(results)

        return aggregated

    def aggregate_results(self, scenario_results: list[dict]) -> dict:
        """
        Combine results from all 3 scenarios.

        Generic aggregation—works for any skill.
        """

        # Extract results by scenario
        by_scenario = {r.get("scenario_id"): r for r in scenario_results if not isinstance(r, Exception)}

        # Quality comparison
        quality_comparison = {
            sid: r.get("quality", {})
            for sid, r in by_scenario.items()
        }

        # Time complexity (simulated—customize per skill)
        simple_items = by_scenario.get("simple", {}).get("items_processed", 1)
        medium_items = by_scenario.get("medium", {}).get("items_processed", 1)
        complex_items = by_scenario.get("complex", {}).get("items_processed", 1)

        scaling_ratio = complex_items / simple_items if simple_items > 0 else 1

        return {
            "orchestration_id": scenario_results[0].get("orchestration_id"),
            "skill": self.skill_name,
            "timestamp": datetime.now().isoformat(),
            "results_by_scenario": by_scenario,
            "quality_comparison": quality_comparison,
            "scaling_analysis": {
                "simple_vs_complex": scaling_ratio,
                "recommendation": self._scaling_recommendation(scaling_ratio)
            },
            "success_rate": sum(1 for r in scenario_results if not isinstance(r, Exception)) / len(scenario_results),
        }

    @staticmethod
    def _scaling_recommendation(ratio: float) -> str:
        """Recommend based on scaling behavior."""
        if ratio < 1.5:
            return "Excellent sublinear scaling"
        elif ratio < 3:
            return "Good linear scaling"
        elif ratio < 10:
            return "Acceptable superlinear scaling"
        else:
            return "Poor scaling—investigate bottlenecks"
```

## Example Implementation: Performance Testing

```python
class PerformanceTestingOrchestrator(SkillOrchestrator):
    """Multi-scenario orchestration for performance-testing skill."""

    async def invoke_skill(
        self,
        input_data: list[dict],
        scenario_params: dict,
    ) -> dict:
        """
        Invoke k6 or Locust performance test.
        """
        import asyncio

        # Mock: simulate running k6 with duration
        duration_ms = scenario_params.get("duration_ms", 5000)

        await asyncio.sleep(duration_ms / 1000)  # Simulate k6 execution

        return {
            "processed": len(input_data),
            "results": [
                {
                    "endpoint": item["url"],
                    "response_time_ms": 100 + (i * 50),
                    "status": "200" if i % 10 != 0 else "500",
                }
                for i, item in enumerate(input_data)
            ],
            "quality_score": 0.85,
            "metrics": {
                "p95_latency_ms": 450,
                "p99_latency_ms": 500,
                "error_rate": 0.01,
            },
            "errors": [],
        }

    def get_scenario_configs(self) -> dict:
        return {
            "simple": {
                "input_size": 10,  # 10 endpoints
                "time_budget_seconds": 30,
                "batch_size": 5,
                "dataset_characteristics": {"distribution": "uniform"},
                "quality_metrics": ["latency", "error_rate"],
                "skill_params": {
                    "duration_ms": 5000,
                    "ramp_up_seconds": 2,
                    "load_profile": "steady"
                }
            },
            "medium": {
                "input_size": 30,  # 30 endpoints
                "time_budget_seconds": 90,
                "batch_size": 15,
                "dataset_characteristics": {"distribution": "uniform"},
                "quality_metrics": ["latency", "error_rate"],
                "skill_params": {
                    "duration_ms": 30000,
                    "ramp_up_seconds": 5,
                    "load_profile": "ramp_and_hold"
                }
            },
            "complex": {
                "input_size": 80,  # 80 endpoints
                "time_budget_seconds": 300,
                "batch_size": 40,
                "dataset_characteristics": {"distribution": "skewed"},
                "quality_metrics": ["latency", "error_rate", "throughput"],
                "skill_params": {
                    "duration_ms": 120000,
                    "ramp_up_seconds": 10,
                    "load_profile": "spike"
                }
            }
        }

    def calculate_quality_metrics(
        self,
        results: list[dict],
        metric_names: list[str]
    ) -> dict:
        """Calculate latency and error rate metrics."""

        if not results:
            return {m: 0.0 for m in metric_names}

        latencies = [r.get("response_time_ms", 0) for r in results]
        errors = sum(1 for r in results if r.get("status", "200") != "200")

        scores = {}

        if "latency" in metric_names:
            # p95 latency score: higher is better (inverse of latency)
            p95 = sorted(latencies)[int(len(latencies) * 0.95)]
            # Score: 1.0 if p95 < 100ms, 0.0 if > 500ms
            scores["latency"] = max(0, min(1.0, (500 - p95) / 400))

        if "error_rate" in metric_names:
            # Error rate score: 1.0 if 0%, 0.0 if > 5%
            error_pct = (errors / len(results)) * 100 if results else 0
            scores["error_rate"] = max(0, min(1.0, (5 - error_pct) / 5))

        if "throughput" in metric_names:
            # Throughput score (normalized)
            rps = len(results) / 30  # Assume 30-second test
            scores["throughput"] = min(1.0, rps / 100)  # Max 100 RPS = 1.0

        return scores

    def generate_test_data(
        self,
        size: int,
        characteristics: dict
    ) -> list[dict]:
        """Generate endpoints to test."""

        endpoints = [
            {"url": f"https://api.example.com/endpoint/{i}", "method": "GET"}
            for i in range(size)
        ]

        if characteristics.get("distribution") == "skewed":
            # Repeat 20% of endpoints (hot paths)
            hot_endpoints = endpoints[:int(size * 0.2)]
            return endpoints + hot_endpoints

        return endpoints
```

## Example Implementation: Security Scanning

```python
class SecurityScanningOrchestrator(SkillOrchestrator):
    """Multi-scenario orchestration for security-scanning skill."""

    async def invoke_skill(
        self,
        input_data: list[dict],
        scenario_params: dict,
    ) -> dict:
        """Invoke security scanner on code files."""

        import random

        # Simulate scanning files
        results = []
        for item in input_data:
            findings = []

            # Simulate vulnerability detection
            if random.random() > 0.9:
                findings.append({
                    "type": "SQL_INJECTION",
                    "severity": "HIGH",
                    "line": random.randint(1, 100)
                })

            results.append({
                "file": item["path"],
                "scanned": True,
                "findings": findings,
                "score": 1.0 - (len(findings) * 0.1),
            })

        return {
            "processed": len(input_data),
            "results": results,
            "quality_score": 0.95,
            "metrics": {
                "vulnerabilities_found": sum(len(r.get("findings", [])) for r in results),
                "files_scanned": len(results),
            },
            "errors": [],
        }

    def get_scenario_configs(self) -> dict:
        return {
            "simple": {
                "input_size": 20,  # 20 files
                "time_budget_seconds": 45,
                "batch_size": 10,
                "dataset_characteristics": {"distribution": "uniform"},
                "quality_metrics": ["coverage", "accuracy"],
                "skill_params": {
                    "scan_depth": "shallow",
                    "rules": "OWASP_TOP_10"
                }
            },
            "medium": {
                "input_size": 100,  # 100 files
                "time_budget_seconds": 120,
                "batch_size": 50,
                "dataset_characteristics": {"distribution": "uniform"},
                "quality_metrics": ["coverage", "accuracy"],
                "skill_params": {
                    "scan_depth": "medium",
                    "rules": "OWASP_TOP_10 + CWE_TOP_25"
                }
            },
            "complex": {
                "input_size": 500,  # 500 files
                "time_budget_seconds": 600,
                "batch_size": 100,
                "dataset_characteristics": {"distribution": "skewed"},
                "quality_metrics": ["coverage", "accuracy", "false_positive_rate"],
                "skill_params": {
                    "scan_depth": "deep",
                    "rules": "ALL",
                    "enable_ml_detection": True
                }
            }
        }

    def calculate_quality_metrics(
        self,
        results: list[dict],
        metric_names: list[str]
    ) -> dict:
        """Calculate security scanning quality metrics."""

        total_files = len(results)
        scanned_files = sum(1 for r in results if r.get("scanned"))
        total_findings = sum(len(r.get("findings", [])) for r in results)

        scores = {}

        if "coverage" in metric_names:
            # Coverage: percentage of files successfully scanned
            scores["coverage"] = scanned_files / max(1, total_files)

        if "accuracy" in metric_names:
            # Accuracy: average finding score (file-level quality)
            avg_score = sum(r.get("score", 0) for r in results) / max(1, total_files)
            scores["accuracy"] = avg_score

        if "false_positive_rate" in metric_names:
            # FPR: simulated (would need manual validation in production)
            scores["false_positive_rate"] = 1.0 - (total_findings / (total_findings + 10))

        return scores

    def generate_test_data(
        self,
        size: int,
        characteristics: dict
    ) -> list[dict]:
        """Generate Python/JS files to scan."""

        files = [
            {"path": f"src/module_{i:03d}.py"}
            for i in range(size)
        ]

        if characteristics.get("distribution") == "skewed":
            # Add some large files (skew toward complexity)
            large_files = [
                {"path": f"src/legacy_module_{i:03d}.py", "size_lines": 5000}
                for i in range(int(size * 0.1))
            ]
            return files + large_files

        return files
```

## Registration and Factory Pattern

```python
class OrchestratorRegistry:
    """Register orchestrators for each skill."""

    _registry: dict[str, type[SkillOrchestrator]] = {}

    @classmethod
    def register(cls, skill_name: str, orchestrator_class: type):
        """Register an orchestrator for a skill."""
        cls._registry[skill_name] = orchestrator_class

    @classmethod
    def get(cls, skill_name: str) -> SkillOrchestrator:
        """Instantiate orchestrator for a skill."""
        if skill_name not in cls._registry:
            raise ValueError(f"No orchestrator registered for {skill_name}")

        return cls._registry[skill_name](skill_name, version="1.0.0")

# Registration
OrchestratorRegistry.register("performance-testing", PerformanceTestingOrchestrator)
OrchestratorRegistry.register("security-scanning", SecurityScanningOrchestrator)

# Usage
orchestrator = OrchestratorRegistry.get("performance-testing")
result = await orchestrator.orchestrate("demo-001")
```

## Integration with LangGraph

```python
async def scenario_worker_generic(state: ScenarioOrchestratorState) -> dict:
    """Generic worker that uses skill-agnostic orchestrator."""

    scenario_id = state.get("scenario_id")
    skill_name = state["skill_name"]

    # Get orchestrator for this skill
    orchestrator = OrchestratorRegistry.get(skill_name)

    # Run scenario
    result = await orchestrator.run_scenario(
        scenario_id=scenario_id,
        orchestration_id=state["orchestration_id"]
    )

    return {f"progress_{scenario_id}": result}
```

## Adding a New Skill

To orchestrate a NEW skill, follow these steps:

### Step 1: Create Orchestrator Class

```python
# file: backend/app/workflows/multi_scenario/my_skill_orchestrator.py

from skill_agnostic_template import SkillOrchestrator

class MySkillOrchestrator(SkillOrchestrator):

    async def invoke_skill(self, input_data, scenario_params):
        # TODO: Call your skill here
        pass

    def get_scenario_configs(self):
        # TODO: Define simple/medium/complex configs
        pass

    def calculate_quality_metrics(self, results, metric_names):
        # TODO: Implement quality scoring
        pass

    def generate_test_data(self, size, characteristics):
        # TODO: Generate test data for your skill
        pass
```

### Step 2: Register

```python
OrchestratorRegistry.register("my-skill", MySkillOrchestrator)
```

### Step 3: Run

```python
orchestrator = OrchestratorRegistry.get("my-skill")
result = await orchestrator.orchestrate("demo-001")
```

**Total implementation time**: 15-30 minutes per skill

## Benefits of Abstraction

| Benefit | Impact |
|---------|--------|
| **No state machine boilerplate** | 10x faster to add new skill |
| **Consistent patterns** | Team learns once, applies everywhere |
| **Automatic comparison** | All skills compared same way |
| **Easy to extend** | Override only the methods you need |
| **LangGraph integration ready** | Works with checkpointing, streaming, etc. |

## Testing Template

```python
@pytest.fixture
def orchestrator():
    return PerformanceTestingOrchestrator("performance-testing", "1.0.0")

@pytest.mark.asyncio
async def test_simple_scenario(orchestrator):
    result = await orchestrator.run_scenario("simple", "test-001")

    assert result["scenario_id"] == "simple"
    assert result["items_processed"] > 0
    assert "quality" in result
    assert result["quality"]["latency"] > 0

@pytest.mark.asyncio
async def test_full_orchestration(orchestrator):
    result = await orchestrator.orchestrate("test-002")

    assert "results_by_scenario" in result
    assert len(result["results_by_scenario"]) == 3
    assert result["success_rate"] > 0.5
```
