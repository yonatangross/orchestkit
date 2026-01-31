"""
Scheduled/Cron Workflow Template

Implements recurring workflows with:
- Durable timers (survives worker restarts)
- Continue-as-new for unbounded execution
- Configurable schedule
- Proper error handling
"""
import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

from temporalio import activity, workflow
from temporalio.client import Client, Schedule, ScheduleActionStartWorkflow, ScheduleSpec, ScheduleIntervalSpec
from temporalio.common import RetryPolicy


# ============================================================================
# Schedule Types
# ============================================================================
class ScheduleType(Enum):
    INTERVAL = "interval"  # Every N minutes/hours
    CRON = "cron"          # Cron expression
    DAILY = "daily"        # Once per day at specific time


@dataclass
class ScheduleConfig:
    schedule_type: ScheduleType
    interval_seconds: int = 3600  # For INTERVAL type
    cron_expression: str = "0 0 * * *"  # For CRON type
    timezone: str = "UTC"


@dataclass
class ScheduledTaskInput:
    task_name: str
    config: dict[str, Any]
    schedule: ScheduleConfig


@dataclass
class ScheduledTaskResult:
    task_name: str
    execution_time: str
    success: bool
    result: Any = None
    error: str | None = None


# ============================================================================
# Activities
# ============================================================================
@activity.defn
async def execute_scheduled_task(task_name: str, config: dict) -> dict:
    """Execute the actual scheduled task."""
    activity.logger.info(f"Executing scheduled task: {task_name}")

    # Heartbeat for long tasks
    activity.heartbeat(f"Starting {task_name}")

    # Replace with your task implementation
    result = {
        "task": task_name,
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "config": config,
    }

    activity.heartbeat(f"Completed {task_name}")
    return result


@activity.defn
async def send_task_notification(task_name: str, success: bool, error: str | None) -> None:
    """Send notification about task completion."""
    activity.logger.info(f"Task {task_name} completed: success={success}")
    # Implementation: Send Slack/email notification


# ============================================================================
# Scheduled Workflow (Internal Loop)
# ============================================================================
@workflow.defn
class ScheduledWorkflow:
    """
    Self-scheduling workflow using durable timers.
    Uses continue-as-new to prevent unbounded history.
    """

    def __init__(self):
        self._execution_count = 0
        self._last_result: ScheduledTaskResult | None = None

    @workflow.run
    async def run(self, input: ScheduledTaskInput) -> None:
        """Run scheduled task in a loop with continue-as-new."""
        max_iterations = 100  # Continue-as-new after 100 iterations

        while self._execution_count < max_iterations:
            # Execute the task
            result = await self._execute_task(input)
            self._last_result = result
            self._execution_count += 1

            # Notify on failure
            if not result.success:
                await workflow.execute_activity(
                    send_task_notification,
                    args=[input.task_name, False, result.error],
                    start_to_close_timeout=timedelta(seconds=30),
                )

            # Sleep until next execution (durable timer)
            await asyncio.sleep(input.schedule.interval_seconds)

        # Continue-as-new to reset history
        workflow.continue_as_new(input)

    async def _execute_task(self, input: ScheduledTaskInput) -> ScheduledTaskResult:
        """Execute single task iteration."""
        try:
            result = await workflow.execute_activity(
                execute_scheduled_task,
                args=[input.task_name, input.config],
                start_to_close_timeout=timedelta(minutes=10),
                heartbeat_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    initial_interval=timedelta(seconds=5),
                    backoff_coefficient=2.0,
                ),
            )
            return ScheduledTaskResult(
                task_name=input.task_name,
                execution_time=workflow.now().isoformat(),
                success=True,
                result=result,
            )
        except Exception as e:
            return ScheduledTaskResult(
                task_name=input.task_name,
                execution_time=workflow.now().isoformat(),
                success=False,
                error=str(e),
            )

    @workflow.query
    def get_execution_count(self) -> int:
        return self._execution_count

    @workflow.query
    def get_last_result(self) -> ScheduledTaskResult | None:
        return self._last_result


# ============================================================================
# Native Schedule (Temporal Schedules API - Recommended)
# ============================================================================
async def create_schedule(
    client: Client,
    schedule_id: str,
    task_name: str,
    config: dict,
    cron: str = "0 * * * *",  # Every hour
) -> None:
    """
    Create a native Temporal schedule (recommended for production).

    Advantages over workflow-based scheduling:
    - Server-managed, no worker needed between executions
    - Built-in pause/resume/backfill
    - Better visibility in UI
    """
    await client.create_schedule(
        schedule_id,
        Schedule(
            action=ScheduleActionStartWorkflow(
                "ScheduledTaskWorkflow",
                args=[task_name, config],
                id=f"scheduled-{task_name}-{{{{.ScheduleTime.Format `20060102-150405`}}}}",
                task_queue="scheduled-tasks",
            ),
            spec=ScheduleSpec(
                cron_expressions=[cron],
            ),
        ),
    )


async def create_interval_schedule(
    client: Client,
    schedule_id: str,
    task_name: str,
    config: dict,
    interval: timedelta = timedelta(hours=1),
) -> None:
    """Create interval-based schedule."""
    await client.create_schedule(
        schedule_id,
        Schedule(
            action=ScheduleActionStartWorkflow(
                "ScheduledTaskWorkflow",
                args=[task_name, config],
                id=f"scheduled-{task_name}-{{{{.ScheduleTime.Format `20060102-150405`}}}}",
                task_queue="scheduled-tasks",
            ),
            spec=ScheduleSpec(
                intervals=[ScheduleIntervalSpec(every=interval)],
            ),
        ),
    )


# ============================================================================
# One-Shot Scheduled Workflow (for native schedules)
# ============================================================================
@workflow.defn
class ScheduledTaskWorkflow:
    """Single execution workflow for use with native schedules."""

    @workflow.run
    async def run(self, task_name: str, config: dict) -> ScheduledTaskResult:
        try:
            result = await workflow.execute_activity(
                execute_scheduled_task,
                args=[task_name, config],
                start_to_close_timeout=timedelta(minutes=10),
                heartbeat_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            return ScheduledTaskResult(
                task_name=task_name,
                execution_time=workflow.now().isoformat(),
                success=True,
                result=result,
            )
        except Exception as e:
            # Notify on failure
            await workflow.execute_activity(
                send_task_notification,
                args=[task_name, False, str(e)],
                start_to_close_timeout=timedelta(seconds=30),
            )
            return ScheduledTaskResult(
                task_name=task_name,
                execution_time=workflow.now().isoformat(),
                success=False,
                error=str(e),
            )
