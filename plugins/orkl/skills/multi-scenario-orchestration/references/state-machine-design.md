# State Machine Design: Multi-Scenario Orchestration

**Detailed state machine and abstraction patterns for ANY user-invocable skill.**

## Core State Machine

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         SCENARIO STATE MACHINE                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌──────────────────────────────┐                        │
│                    │  PENDING                     │                        │
│                    │ (awaiting start signal)       │                        │
│                    └──────┬───────────────────────┘                        │
│                           │ supervisor.route_scenarios()                  │
│                           ▼                                               │
│                    ┌──────────────────────────────┐                        │
│                    │  RUNNING                     │                        │
│                    │ (executing skill batches)    │◄──────────┐           │
│                    └──────┬───────────────────────┘           │           │
│                           │                                   │           │
│              ┌────────────┼────────────┐                      │           │
│              │            │            │                      │           │
│         [pause]        [milestone]  [error]              [resume]         │
│              │            │            │                      │           │
│              ▼            ▼            ▼                      │           │
│         ┌────────┐  ┌─────────┐  ┌──────────┐               │           │
│         │ PAUSED │  │MILESTONE│  │ FAILED   │               │           │
│         │(waiting)│  │(sync pt)│  │(error)   │               │           │
│         └────┬───┘  └────┬────┘  └──────────┘               │           │
│              │           │                                    │           │
│              │[resume]   │[continue]                          │           │
│              │           │                                    │           │
│              └─────┬─────┘                                    │           │
│                    │                                          │           │
│              [error recovery]──────────────────────────────────┘          │
│                    │                                                       │
│                    ▼                                                       │
│            ┌──────────────────────────────┐                              │
│            │  COMPLETE                    │                              │
│            │ (all batches processed)      │                              │
│            └──────────────────────────────┘                              │
│                    │                                                       │
│                    │ aggregator.collect_and_aggregate()                  │
│                    ▼                                                       │
│            ┌──────────────────────────────┐                              │
│            │  FINAL_RESULTS               │                              │
│            │ (ready for comparison)       │                              │
│            └──────────────────────────────┘                              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

Legend:
─────────────────
→ Transition
[action] = trigger/activity
```

## Detailed State Definitions

### State: PENDING

**Entry Point**: Created at orchestration start

```python
@dataclass
class PendingState:
    scenario_id: str = "simple|medium|complex"
    orchestration_id: str
    created_at: datetime
    definition: ScenarioDefinition

    # Awaiting signal from supervisor
    waiting_for_start: bool = True

# Supervisor signal triggers transition
# Event: supervisor.route_scenarios() returns Send("scenario_worker", ...)
# Transition: PENDING → RUNNING
```

**Exit Condition**: Supervisor sends routing command

### State: RUNNING

**Active Work State**: Executing skill batches

```python
@dataclass
class RunningState:
    scenario_id: str
    status: Literal["running"] = "running"

    # Progress tracking
    progress_pct: float = 0.0  # 0-100
    current_milestone: str = "batch_1"
    milestones_reached: list[str] = field(default_factory=list)

    # Metrics (accumulating)
    items_processed: int = 0
    batch_count: int = 0
    elapsed_ms: int = 0
    memory_used_mb: int = 0

    # Results (partial)
    partial_results: list[dict] = field(default_factory=list)
    quality_scores: dict = field(default_factory=dict)

    # Error tracking
    errors: list[dict] = field(default_factory=list)

    # Transition flags
    should_pause: bool = False
    should_continue: bool = True
```

**Activities**:
- Execute skill batch N
- Update progress_pct = (items_processed / input_size) * 100
- Check if progress_pct reached milestone (30%, 50%, 70%, 90%)
- Record partial results
- Monitor memory and elapsed time

**Exit Conditions**:
1. `progress_pct >= 100` → COMPLETE
2. `error_occurred and recovery_possible` → PAUSE (or retry)
3. `error_occurred and recovery_failed` → FAILED

### State: PAUSED

**Waiting State**: At milestone synchronization point or for recovery

```python
@dataclass
class PausedState:
    scenario_id: str
    status: Literal["paused"] = "paused"

    # Why paused?
    pause_reason: Literal["sync_point", "waiting_for_recovery", "user_halt"] = "sync_point"

    # Checkpoint (for resuming)
    checkpoint_index: int  # Which batch to resume from
    checkpoint_state: dict  # Full state snapshot

    # Sync info (for milestone pause)
    milestone_pct: int
    other_scenarios_status: dict  # {"simple": 45, "medium": 30, "complex": 10}
    time_paused_ms: int = 0

    # Recovery info (for error pause)
    retry_count: int = 0
    max_retries: int = 3
    last_error: str = ""
```

**Activities**:
- Wait for other scenarios (if sync_point)
- Wait for recovery decision (if error)
- Monitor timeout (max 60 seconds)
- Record checkpoint for resumption

**Exit Conditions**:
1. `all_scenarios_at_milestone` → RUNNING (resume)
2. `timeout and waiting_for_others` → RUNNING (proceed anyway)
3. `retry_count < max_retries` → RUNNING (retry)
4. `retry_count >= max_retries` → FAILED

### State: FAILED

**Terminal Error State**: Unrecoverable error

```python
@dataclass
class FailedState:
    scenario_id: str
    status: Literal["failed"] = "failed"

    # Error details
    error_message: str
    error_type: str  # "timeout", "exception", "memory", "validation"
    stack_trace: str

    # Progress at failure
    progress_pct: float
    items_processed: int
    batch_failed: int

    # Attempted recovery
    recovery_attempted: bool = False
    recovery_method: str = ""

    # Partial results (if any)
    partial_results: list[dict] = field(default_factory=list)
```

**Activities**:
- Log error with full context
- Store partial results (won't complete, but data preserved)
- Notify coordinator
- Update checkpoint for debugging

**Exit Condition**: Terminal state (no transition out)

### State: COMPLETE

**Success State**: All batches processed

```python
@dataclass
class CompleteState:
    scenario_id: str
    status: Literal["complete"] = "complete"

    # Final metrics
    total_items_processed: int
    total_batches: int
    total_elapsed_ms: int
    peak_memory_mb: int

    # Final results
    results: dict  # Full aggregated output
    quality_scores: dict
    error_count: int = 0

    # Comparison data
    time_per_item_ms: float = 0.0
    items_per_second: float = 0.0

    # Quality assessment
    quality_rank: Literal["basic", "good", "excellent"]
    recommendation: str
```

**Activities**:
- Calculate final metrics
- Score results
- Prepare for comparison
- Signal readiness for aggregation

**Exit Condition**: Transition to aggregator

### State: FINAL_RESULTS

**Aggregated State**: All scenarios combined

```python
@dataclass
class AggregatedFinalResults:
    orchestration_id: str
    timestamp: datetime

    # Per-scenario results
    results: dict  # {"simple": {...}, "medium": {...}, "complex": {...}}

    # Comparative analysis
    quality_ranking: dict
    time_complexity: dict  # {"simple": 1.2ms/item, "medium": 1.8ms/item, ...}
    scaling_efficiency: float  # simple_time / complex_time / (simple_size / complex_size)

    # Cross-scenario patterns
    success_patterns: list[str]
    failure_modes: list[str]
    optimization_opportunities: list[str]

    # Recommendations
    best_difficulty: Literal["simple", "medium", "complex"]
    resource_requirements: dict
    estimated_production_scaling: dict
```

## Transition Rules

### PENDING → RUNNING

**Trigger**: `supervisor.route_scenarios()` returns Send commands

```python
async def supervisor_trigger(state):
    return [
        Send("scenario_worker", {"scenario_id": "simple", ...}),
        Send("scenario_worker", {"scenario_id": "medium", ...}),
        Send("scenario_worker", {"scenario_id": "complex", ...}),
    ]
```

**Guard**: None (always allowed)

**Actions on Entry**:
- Set `status = "running"`
- Initialize `start_time_ms = now()`
- Start processing first batch

### RUNNING → MILESTONE (PAUSED at sync point)

**Trigger**: `progress_pct in [30, 50, 70, 90]` AND `synchronize_at_milestone`

```python
# In scenario_worker
if progress_pct in [30, 50, 70, 90]:
    should_sync = await synchronize_at_milestone(milestone_pct, state)
    if should_sync:
        # Transition to PAUSED
        state.status = "paused"
        state.pause_reason = "sync_point"
        state.milestone_pct = progress_pct
```

**Guard**: Other scenarios must be within 5% of milestone OR timeout expires

**Actions on Entry**:
- Record checkpoint
- Wait for other scenarios (max 60s)
- Monitor progress of siblings

### PAUSED → RUNNING (Resume after sync)

**Trigger**: All scenarios reached milestone OR timeout

```python
# Monitor loop in sync node
if all_at_milestone or timeout_expired:
    # Resume
    state.status = "running"
    state.pause_reason = None
    # Continue from checkpoint
```

**Guard**: None (always allowed)

**Actions on Entry**:
- Load checkpoint
- Resume from interrupted batch
- Continue processing

### RUNNING → COMPLETE

**Trigger**: `items_processed >= input_size`

```python
# In scenario_worker
for batch_idx, batch in enumerate(batches):
    await invoke_skill(batch)
    items_processed += len(batch)

    if items_processed >= scenario_def.input_size:
        state.status = "complete"
        break
```

**Guard**: None

**Actions on Entry**:
- Calculate final metrics
- Score all results
- Prepare aggregation data

### RUNNING → PAUSED (Error recovery pause)

**Trigger**: Exception in skill invocation, recovery possible

```python
try:
    result = await invoke_skill(batch)
except SkillException as e:
    if can_recover(e):
        state.status = "paused"
        state.pause_reason = "waiting_for_recovery"
        state.last_error = str(e)
        state.retry_count += 1
        # Decision logic for retry
```

**Guard**: `retry_count < max_retries` (usually 3)

**Actions on Entry**:
- Save checkpoint before error
- Log error details
- Increment retry counter
- Wait for retry decision

### PAUSED → RUNNING (Retry after error)

**Trigger**: Manual retry decision or automatic retry eligible

```python
if error_state.retry_count < max_retries:
    state.status = "running"
    # Load checkpoint, try again
```

**Guard**: `retry_count < max_retries`

### RUNNING → FAILED

**Trigger**: Exception and recovery not possible

```python
try:
    result = await invoke_skill(batch)
except FatalException as e:
    state.status = "failed"
    state.error_message = str(e)
    state.error_type = type(e).__name__
```

**Guard**: `retry_count >= max_retries` OR `is_fatal_error`

**Actions on Entry**:
- Log full error context
- Store partial results (if any)
- Notify aggregator about failure
- Don't block other scenarios

### COMPLETE → FINAL_RESULTS

**Trigger**: All 3 scenarios reached COMPLETE or FAILED

```python
# In aggregator_node
simple_complete = state.progress_simple.status in ["complete", "failed"]
medium_complete = state.progress_medium.status in ["complete", "failed"]
complex_complete = state.progress_complex.status in ["complete", "failed"]

if simple_complete and medium_complete and complex_complete:
    return aggregate_results(state)
```

**Guard**: All scenarios in terminal state

**Actions on Entry**:
- Merge results from all scenarios
- Calculate comparisons
- Extract patterns
- Generate recommendations

## Abstraction for ANY Skill

The state machine remains **skill-agnostic**. Customization happens in:

1. **Skill Invocation**: `invoke_skill()` (your skill here)
2. **Quality Metrics**: `calculate_quality_metrics()` (what to measure)
3. **Scenario Parameters**: Batch size, timeout, memory (adjust per skill)

### Skill Integration Point

```python
async def invoke_skill(
    skill_name: str,           # "performance-testing", "security-scanning", etc.
    input_data: list,          # Items to process
    skill_params: dict,        # Skill-specific config
) -> dict:
    """
    Call any user-invocable skill.

    This is the ONLY skill-specific code in the state machine.
    """

    # Match skill_name and invoke appropriately
    if skill_name == "performance-testing":
        return await invoke_performance_testing(input_data, skill_params)
    elif skill_name == "security-scanning":
        return await invoke_security_scanning(input_data, skill_params)
    elif skill_name == "your-skill":
        return await invoke_your_skill(input_data, skill_params)
    else:
        raise ValueError(f"Unknown skill: {skill_name}")
```

### Quality Metrics Adapter

```python
def calculate_quality_metrics(
    skill_name: str,
    results: list[dict],
    metric_names: list[str]
) -> dict:
    """
    Calculate quality metrics (skill-specific).
    """

    scores = {}

    # Skill-agnostic metrics (always available)
    scores["completion_rate"] = len(results) / max(1, len(results))
    scores["error_rate"] = sum(1 for r in results if r.get("error")) / max(1, len(results))

    # Skill-specific metrics
    if "accuracy" in metric_names:
        # For security-scanning: vulnerability count vs. expected
        # For performance-testing: actual latency vs. threshold
        scores["accuracy"] = calculate_accuracy(skill_name, results)

    if "coverage" in metric_names:
        # For security-scanning: percentage of codebase scanned
        # For performance-testing: percentage of endpoints tested
        scores["coverage"] = calculate_coverage(skill_name, results)

    return scores
```

### Scenario Parameter Templates

```python
SCENARIO_TEMPLATES = {
    # Generic: 1x, 3x, 8x scaling
    "default": {
        "simple": {"multiplier": 1.0, "timeout": 30, "batch_size": 10},
        "medium": {"multiplier": 3.0, "timeout": 90, "batch_size": 50},
        "complex": {"multiplier": 8.0, "timeout": 300, "batch_size": 100},
    },

    # Performance-testing: lighter loads
    "performance-testing": {
        "simple": {"multiplier": 1.0, "timeout": 60, "batch_size": 5},
        "medium": {"multiplier": 2.0, "timeout": 180, "batch_size": 20},
        "complex": {"multiplier": 4.0, "timeout": 600, "batch_size": 50},
    },

    # Security-scanning: heavier loads
    "security-scanning": {
        "simple": {"multiplier": 1.0, "timeout": 45, "batch_size": 20},
        "medium": {"multiplier": 2.5, "timeout": 120, "batch_size": 100},
        "complex": {"multiplier": 10.0, "timeout": 900, "batch_size": 500},
    },
}

def get_scenario_config(skill_name: str, difficulty: str) -> dict:
    template = SCENARIO_TEMPLATES.get(skill_name, SCENARIO_TEMPLATES["default"])
    return template[difficulty]
```

## Key State Machine Patterns

### Pattern 1: Optimistic Completion

Assume success, handle errors reactively:

```python
# Default behavior: run until complete
for batch in batches:
    result = await invoke_skill(batch)
    # No error checking—complete normally

# Only if exception: enter error recovery
```

**Pro**: Efficient for reliable skills
**Con**: Slower error detection

### Pattern 2: Pessimistic Validation

Validate each batch before continuing:

```python
for batch in batches:
    result = await invoke_skill(batch)

    # Validate result
    if not validate_result(result, scenario_def.expected_quality):
        # Error recovery
        retry_count += 1
```

**Pro**: Catches issues early
**Con**: Higher overhead

### Pattern 3: Timeout-Based State Transitions

Use elapsed time to trigger state changes:

```python
@dataclass
class TimedState:
    created_at: int
    timeout_seconds: int

    def is_expired(self) -> bool:
        return (now() - created_at) > timeout_seconds * 1000

# Check in state machine
if paused_state.is_expired():
    # Force transition (to RUNNING or FAILED)
```

## Visualizing State Transitions

```python
# Generate state transition diagram for debugging
import graphviz

def generate_state_diagram():
    dot = graphviz.Digraph(comment="Scenario State Machine")

    states = ["PENDING", "RUNNING", "PAUSED", "COMPLETE", "FAILED", "FINAL_RESULTS"]
    for state in states:
        dot.node(state, shape="ellipse")

    transitions = [
        ("PENDING", "RUNNING", "supervisor.route()"),
        ("RUNNING", "PAUSED", "milestone reached"),
        ("RUNNING", "COMPLETE", "all items processed"),
        ("RUNNING", "FAILED", "fatal error"),
        ("PAUSED", "RUNNING", "sync complete or timeout"),
        ("PAUSED", "FAILED", "max retries exceeded"),
        ("COMPLETE", "FINAL_RESULTS", "aggregation trigger"),
        ("FAILED", "FINAL_RESULTS", "aggregation trigger"),
    ]

    for src, dst, label in transitions:
        dot.edge(src, dst, label=label)

    dot.render("/tmp/state_machine", format="png", view=True)
```

## Testing State Transitions

```python
@pytest.mark.asyncio
async def test_state_transition_pending_to_running():
    state = ScenarioOrchestratorState(...)
    assert state.progress_simple.status == "pending"

    # Trigger supervisor
    commands = await scenario_supervisor(state)

    assert len(commands) == 3  # 3 Send commands

@pytest.mark.asyncio
async def test_state_transition_running_to_complete():
    state = ScenarioOrchestratorState(...)
    state.progress_simple.status = "running"

    # Simulate processing all items
    state.progress_simple.items_processed = 100

    # Invoke worker
    result = await scenario_worker(state)

    assert result["progress_simple"]["status"] == "complete"
```
