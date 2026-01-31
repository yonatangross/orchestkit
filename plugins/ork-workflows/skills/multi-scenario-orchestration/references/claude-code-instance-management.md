# Claude Code Instance Management: Multi-Scenario Demos

**Structure 3 parallel Claude Code terminal instances for simultaneous scenario execution with shared state synchronization.**

## Instance Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COORDINATOR PROCESS (Python)                      │
│                   (Runs orchestrator graph)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐         │
│  │  Terminal 1 │      │  Terminal 2 │      │  Terminal 3 │         │
│  │  (Simple)   │      │  (Medium)   │      │  (Complex)  │         │
│  │             │      │             │      │             │         │
│  │  Session:   │      │  Session:   │      │  Session:   │         │
│  │  simple-123 │      │  medium-123 │      │  complex-123│         │
│  └─────────────┘      └─────────────┘      └─────────────┘         │
│       │                    │                    │                   │
│  Claude Code instances     Claude Code instances     Claude Code     │
│  (3 parallel processes)    (3 parallel processes)    instance        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │   PostgreSQL Checkpoint Table                            │       │
│  │   (Shared state synchronization across instances)        │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### Step 1: Prepare the Project

Ensure your project has the orchestrator graph and shared utilities:

```bash
# At project root
mkdir -p backend/app/workflows/multi_scenario
cp src/skills/multi-scenario-orchestration/references/langgraph-implementation.py \
   backend/app/workflows/multi_scenario/orchestrator.py

# Create coordinator script
cat > backend/app/workflows/multi_scenario/coordinator.py << 'EOF'
"""
Main coordinator that launches and monitors 3 Claude Code instances.
"""
import asyncio
import subprocess
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
SCENARIOS = ["simple", "medium", "complex"]
SKILL_NAME = "your-skill-name"  # Change this

async def launch_scenario_instance(scenario_id: str, orchestration_id: str):
    """Launch one Claude Code instance for a scenario."""

    env = os.environ.copy()
    env["SCENARIO_ID"] = scenario_id
    env["ORCHESTRATION_ID"] = orchestration_id
    env["PROJECT_ROOT"] = str(PROJECT_ROOT)

    # Launch Claude Code instance
    process = subprocess.Popen(
        [
            "claude", "code",
            str(PROJECT_ROOT),
            "--session", f"scenario-{scenario_id}-{orchestration_id}",
            "--skill", SKILL_NAME,
        ],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    print(f"[COORDINATOR] Launched {scenario_id} instance (PID: {process.pid})")
    return process

async def monitor_instances(processes: dict):
    """Monitor all instances for completion."""

    while any(p.poll() is None for p in processes.values()):
        for scenario_id, process in processes.items():
            if process.poll() is not None:
                print(f"[COORDINATOR] {scenario_id} instance completed")

        await asyncio.sleep(1)

async def main():
    orchestration_id = "demo-001"

    print(f"[COORDINATOR] Starting orchestration {orchestration_id}")
    print(f"[COORDINATOR] Launching 3 parallel instances...")

    # Launch all instances
    processes = {}
    for scenario_id in SCENARIOS:
        process = await launch_scenario_instance(scenario_id, orchestration_id)
        processes[scenario_id] = process

    print(f"[COORDINATOR] All instances launched. Monitoring...")

    # Monitor
    await monitor_instances(processes)

    print(f"[COORDINATOR] All instances completed")

if __name__ == "__main__":
    asyncio.run(main())
EOF
```

### Step 2: Create Scenario Runner Script

Create `/backend/app/workflows/multi_scenario/run_scenario.py`:

```python
"""
Runner for single scenario. Invoked by Claude Code instance.
Sets up environment from SCENARIO_ID and ORCHESTRATION_ID env vars.
"""
import os
import asyncio
from orchestrator import (
    build_scenario_orchestrator,
    ScenarioOrchestratorState,
    ScenarioDefinition,
    ScenarioProgress,
)
from langgraph.checkpoint.postgres import PostgresSaver

async def run_scenario():
    # Read from environment
    scenario_id = os.getenv("SCENARIO_ID", "simple")
    orchestration_id = os.getenv("ORCHESTRATION_ID", "demo-001")
    project_root = os.getenv("PROJECT_ROOT", ".")

    print(f"[{scenario_id.upper()}] Starting scenario execution")
    print(f"[{scenario_id.upper()}] Orchestration ID: {orchestration_id}")

    # Setup checkpointer
    db_url = os.getenv("DATABASE_URL", "postgresql://localhost/orchestkit")
    checkpointer = PostgresSaver.from_conn_string(db_url)

    # Build orchestrator
    app = build_scenario_orchestrator(checkpointer=checkpointer)

    # Prepare scenario definitions
    configs = {
        "simple": {
            "complexity_multiplier": 1.0,
            "input_size": 100,
            "time_budget_seconds": 30,
            "skill_params": {"batch_size": 10, "cache_enabled": True}
        },
        "medium": {
            "complexity_multiplier": 3.0,
            "input_size": 300,
            "time_budget_seconds": 90,
            "skill_params": {"batch_size": 50, "cache_enabled": True}
        },
        "complex": {
            "complexity_multiplier": 8.0,
            "input_size": 800,
            "time_budget_seconds": 300,
            "skill_params": {"batch_size": 100, "cache_enabled": True, "parallel_workers": 4}
        }
    }

    cfg = configs[scenario_id]

    # Build initial state
    initial_state: ScenarioOrchestratorState = {
        "orchestration_id": orchestration_id,
        "start_time_unix": int(time.time()),
        "skill_name": "your-skill-name",
        "skill_version": "1.0.0",

        # Current scenario only
        "scenario_simple": None,
        "scenario_medium": None,
        "scenario_complex": None,
        "progress_simple": None,
        "progress_medium": None,
        "progress_complex": None,
    }

    # Set only the relevant scenario
    initial_state[f"scenario_{scenario_id}"] = ScenarioDefinition(
        name=scenario_id,
        difficulty={"simple": "easy", "medium": "intermediate", "complex": "advanced"}[scenario_id],
        complexity_multiplier=cfg["complexity_multiplier"],
        input_size=cfg["input_size"],
        dataset_characteristics={"distribution": "uniform"},
        time_budget_seconds=cfg["time_budget_seconds"],
        memory_limit_mb={"simple": 256, "medium": 512, "complex": 1024}[scenario_id],
        error_tolerance={"simple": 0.0, "medium": 0.05, "complex": 0.1}[scenario_id],
        skill_params=cfg["skill_params"],
        expected_quality={"simple": "basic", "medium": "good", "complex": "excellent"}[scenario_id],
        quality_metrics=["accuracy", "coverage"]
    )

    initial_state[f"progress_{scenario_id}"] = ScenarioProgress(scenario_id=scenario_id)

    # Run orchestrator
    config = {"configurable": {"thread_id": f"orch-{orchestration_id}"}}

    print(f"[{scenario_id.upper()}] Invoking orchestrator...")

    try:
        # Stream progress
        async for update in app.astream(initial_state, config=config, stream_mode="updates"):
            if f"progress_{scenario_id}" in update:
                progress = update[f"progress_{scenario_id}"]
                print(f"[{scenario_id.upper()}] Progress: {progress.progress_pct:.1f}% "
                      f"({progress.items_processed} items, {progress.elapsed_ms}ms)")

        print(f"[{scenario_id.upper()}] Scenario complete")

    except Exception as e:
        print(f"[{scenario_id.upper()}] Error: {e}")
        raise

if __name__ == "__main__":
    import time
    asyncio.run(run_scenario())
```

## Execution: Three-Terminal Mode

### Terminal 1: Coordinator

```bash
cd /path/to/project
python backend/app/workflows/multi_scenario/coordinator.py
```

**Output:**
```
[COORDINATOR] Starting orchestration demo-001
[COORDINATOR] Launching 3 parallel instances...
[COORDINATOR] Launched simple instance (PID: 1234)
[COORDINATOR] Launched medium instance (PID: 1235)
[COORDINATOR] Launched complex instance (PID: 1236)
[COORDINATOR] All instances launched. Monitoring...
```

### Terminal 2: Simple Scenario

```bash
cd /path/to/project
export SCENARIO_ID=simple
export ORCHESTRATION_ID=demo-001
python backend/app/workflows/multi_scenario/run_scenario.py
```

**Output:**
```
[SIMPLE] Starting scenario execution
[SIMPLE] Orchestration ID: demo-001
[SIMPLE] Invoking orchestrator...
[SIMPLE] Progress: 10.0% (10 items, 100ms)
[SIMPLE] Progress: 20.0% (20 items, 200ms)
...
[SIMPLE] Progress: 100.0% (100 items, 1050ms)
[SIMPLE] Scenario complete
```

### Terminal 3: Medium Scenario

```bash
cd /path/to/project
export SCENARIO_ID=medium
export ORCHESTRATION_ID=demo-001
python backend/app/workflows/multi_scenario/run_scenario.py
```

**Output:**
```
[MEDIUM] Starting scenario execution
[MEDIUM] Orchestration ID: demo-001
[MEDIUM] Invoking orchestrator...
[MEDIUM] Progress: 3.3% (10 items, 100ms)
[MEDIUM] Progress: 6.7% (20 items, 200ms)
...
[MEDIUM] Progress: 100.0% (300 items, 3100ms)
[MEDIUM] Scenario complete
```

### Terminal 4 (Optional): Complex Scenario

If you have 4 terminals, run complex in parallel:

```bash
export SCENARIO_ID=complex
export ORCHESTRATION_ID=demo-001
python backend/app/workflows/multi_scenario/run_scenario.py
```

## Shared State Synchronization

### PostgreSQL Checkpoint Schema

```sql
-- Create checkpoint table (run once)
CREATE TABLE IF NOT EXISTS scenario_orchestration_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orchestration_id VARCHAR(255) NOT NULL,
    scenario_id VARCHAR(50) NOT NULL,
    milestone_name VARCHAR(100),
    progress_pct FLOAT,
    timestamp_unix BIGINT NOT NULL,
    state_snapshot JSONB,
    metrics JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_orchestration_id (orchestration_id),
    INDEX idx_scenario_id (scenario_id),
    INDEX idx_timestamp (timestamp_unix)
);

-- View progress across all scenarios
SELECT
    orchestration_id,
    scenario_id,
    progress_pct,
    milestone_name,
    timestamp_unix,
    (timestamp_unix / 1000.0) as seconds_elapsed
FROM scenario_orchestration_checkpoints
WHERE orchestration_id = 'demo-001'
ORDER BY scenario_id, progress_pct;

-- Example output:
-- orchestration_id | scenario_id | progress_pct | milestone_name | seconds_elapsed
-- demo-001         | simple      | 30           | checkpoint_1   | 1.2
-- demo-001         | simple      | 70           | checkpoint_2   | 2.8
-- demo-001         | simple      | 100          | completion     | 3.1
-- demo-001         | medium      | 30           | checkpoint_1   | 3.5
-- demo-001         | medium      | 70           | checkpoint_2   | 8.2
-- demo-001         | medium      | 100          | completion     | 9.3
-- demo-001         | complex     | 30           | checkpoint_1   | 9.1
-- demo-001         | complex     | 70           | checkpoint_2   | 22.5
-- demo-001         | complex     | 100          | completion     | 25.7
```

### Monitor Progress from Coordinator

```python
"""Monitor script to watch progress across all instances."""
import asyncio
import time
from datetime import datetime
import psycopg2

async def monitor_orchestration(orchestration_id: str, interval: int = 2):
    """Watch progress of all scenarios."""

    conn = psycopg2.connect("dbname=orchestkit user=postgres")
    cursor = conn.cursor()

    print(f"Monitoring orchestration {orchestration_id}...\n")

    while True:
        cursor.execute("""
            SELECT
                scenario_id,
                MAX(progress_pct) as progress,
                MAX(timestamp_unix) as last_update
            FROM scenario_orchestration_checkpoints
            WHERE orchestration_id = %s
            GROUP BY scenario_id
            ORDER BY scenario_id
        """, (orchestration_id,))

        rows = cursor.fetchall()
        if not rows:
            print("No progress yet...")
            await asyncio.sleep(interval)
            continue

        # Clear screen and print progress
        print(f"\r{datetime.now().strftime('%H:%M:%S')}")
        print("-" * 50)

        all_complete = True
        for scenario_id, progress, timestamp in rows:
            bar_length = int(progress / 5)  # 20-char bar
            bar = "█" * bar_length + "░" * (20 - bar_length)

            print(f"{scenario_id:10} │{bar}│ {progress:3.0f}%")

            if progress < 100:
                all_complete = False

        if all_complete:
            print("\n✓ All scenarios complete!")
            break

        await asyncio.sleep(interval)

    conn.close()

if __name__ == "__main__":
    asyncio.run(monitor_orchestration("demo-001"))
```

## Synchronization at Milestones

To enable forced synchronization at milestones (all scenarios pause and wait):

```python
# In run_scenario.py

async def wait_for_milestone_sync(
    orchestration_id: str,
    scenario_id: str,
    milestone_pct: int,
    timeout_seconds: int = 30
):
    """Wait for all scenarios to reach milestone."""

    checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)
    start = time.time()

    while time.time() - start < timeout_seconds:
        # Query checkpoint status
        async with checkpointer.get_connection() as conn:
            result = await conn.fetch("""
                SELECT DISTINCT scenario_id, MAX(progress_pct)
                FROM scenario_orchestration_checkpoints
                WHERE orchestration_id = $1
                GROUP BY scenario_id
            """, orchestration_id)

            scenarios_at_milestone = {
                row["scenario_id"]: row["max"] >= milestone_pct
                for row in result
            }

            if all(scenarios_at_milestone.values()):
                print(f"[{scenario_id.upper()}] All scenarios reached {milestone_pct}%")
                return True

        await asyncio.sleep(0.5)

    print(f"[{scenario_id.upper()}] Sync timeout at {milestone_pct}%")
    return False
```

## Advanced: Multi-Host Execution

For even greater parallelism, run scenarios on different machines:

```bash
# Host 1: Coordinator + Simple
python backend/app/workflows/multi_scenario/coordinator.py

# Host 2: Medium (different machine, same DB)
export DATABASE_URL="postgresql://user:pass@coordinator-host/orchestkit"
export SCENARIO_ID=medium
export ORCHESTRATION_ID=demo-001
python backend/app/workflows/multi_scenario/run_scenario.py

# Host 3: Complex (different machine, same DB)
export DATABASE_URL="postgresql://user:pass@coordinator-host/orchestkit"
export SCENARIO_ID=complex
export ORCHESTRATION_ID=demo-001
python backend/app/workflows/multi_scenario/run_scenario.py
```

PostgreSQL checkpoints serve as the distributed state store.

## Best Practices

1. **Unique Orchestration IDs**: Use timestamp or UUID for each demo run
2. **Session Isolation**: Each instance gets its own Claude Code session
3. **Checkpointing**: Always enable PostgreSQL persistence
4. **Monitoring**: Watch progress via checkpoint table queries
5. **Timeout Handling**: Allow asynchronous completion, don't force lock-step
6. **Error Recovery**: Failed instances can be restarted without resetting state

## Troubleshooting

**Instances get stuck at milestone:**
→ Increase `timeout_seconds` in `wait_for_milestone_sync()`

**Database connection errors:**
→ Check `DATABASE_URL` environment variable, ensure PostgreSQL is running

**One instance much slower than others:**
→ This is expected! Use Mode A (free-running), not lock-step. Slower instance will eventually complete.

**Memory usage grows over time:**
→ Enable checkpointing to disk, reduce batch sizes for complex scenario
