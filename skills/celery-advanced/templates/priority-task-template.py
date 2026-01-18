"""
Priority Task Template with Queue Routing

Demonstrates:
- Priority-based task definition
- Queue routing by task type and user tier
- Per-user rate limiting with Redis
- Automatic retries with exponential backoff

Usage:
    from priority_tasks import PriorityTask, submit_prioritized

    # Define a priority task
    @celery_app.task(base=PriorityTask, queue="high", priority=8)
    def premium_task(user_id: str, data: dict) -> dict:
        return {"processed": True}

    # Submit with automatic routing
    result = submit_prioritized(
        task=premium_task,
        kwargs={"user_id": "usr-123", "data": {"key": "value"}},
        user_tier="premium",
    )

Requirements:
    celery>=5.4.0
    redis>=5.0.0
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from enum import IntEnum
from functools import wraps
from typing import Any, Callable, TypeVar

from celery import Celery, Task
from celery.result import AsyncResult
import redis
import structlog

logger = structlog.get_logger()

# Type variables for generic task definitions
T = TypeVar("T")
TaskResult = TypeVar("TaskResult")


# =============================================================================
# CONFIGURATION
# =============================================================================

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL)


class Priority(IntEnum):
    """
    Task priority levels (higher number = higher priority).

    Redis priority queues process higher numbers first.
    """

    BULK = 0  # Background batch jobs, reports
    LOW = 2  # Analytics, non-urgent notifications
    NORMAL = 5  # Default priority
    HIGH = 7  # Important user-initiated actions
    CRITICAL = 9  # Payments, security events


class UserTier:
    """User tier definitions for routing decisions."""

    FREE = "free"
    STANDARD = "standard"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"


# Tier configuration: queue, priority, rate limits
TIER_CONFIG = {
    UserTier.FREE: {
        "queue": "low",
        "priority": Priority.LOW,
        "rate_limit": "10/m",  # 10 per minute
        "burst": 5,
    },
    UserTier.STANDARD: {
        "queue": "default",
        "priority": Priority.NORMAL,
        "rate_limit": "30/m",
        "burst": 15,
    },
    UserTier.PREMIUM: {
        "queue": "high",
        "priority": Priority.HIGH,
        "rate_limit": "100/m",
        "burst": 50,
    },
    UserTier.ENTERPRISE: {
        "queue": "critical",
        "priority": Priority.CRITICAL,
        "rate_limit": "1000/m",
        "burst": 200,
    },
}


# =============================================================================
# BASE PRIORITY TASK
# =============================================================================


class PriorityTask(Task):
    """
    Base task class with priority and rate limiting support.

    Features:
    - Per-user rate limiting using Redis sliding window
    - Automatic retry with exponential backoff
    - Structured logging
    - Task tracking

    Usage:
        @celery_app.task(base=PriorityTask, user_rate_limit="50/m")
        def my_task(user_id: str, data: dict) -> dict:
            pass
    """

    abstract = True

    # Override in task definition
    user_rate_limit: str = "30/m"  # Default: 30 per minute per user

    # Retry configuration
    autoretry_for = (ConnectionError, TimeoutError)
    max_retries = 3
    retry_backoff = True
    retry_backoff_max = 600  # Max 10 minutes between retries
    retry_jitter = True

    def _parse_rate_limit(self, rate_str: str) -> tuple[int, int]:
        """
        Parse rate limit string.

        Args:
            rate_str: Rate limit in format "N/s", "N/m", or "N/h"

        Returns:
            Tuple of (max_requests, window_seconds)
        """
        value, unit = rate_str.split("/")
        periods = {"s": 1, "m": 60, "h": 3600}
        return int(value), periods[unit]

    def _check_rate_limit(self, user_id: str) -> tuple[bool, int]:
        """
        Check if user is within rate limit using sliding window.

        Args:
            user_id: User identifier

        Returns:
            Tuple of (is_allowed, retry_after_seconds)
        """
        if not user_id:
            return True, 0

        max_requests, window = self._parse_rate_limit(self.user_rate_limit)
        key = f"rate:{self.name}:{user_id}"
        now = datetime.now(timezone.utc).timestamp()

        # Sliding window counter using Redis sorted set
        pipe = redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, now - window)  # Remove old entries
        pipe.zcard(key)  # Count current
        pipe.zadd(key, {str(now): now})  # Add current request
        pipe.expire(key, window + 1)  # Set TTL
        results = pipe.execute()

        current_count = results[1]

        if current_count >= max_requests:
            # Calculate retry_after from oldest entry
            oldest = redis_client.zrange(key, 0, 0, withscores=True)
            if oldest:
                retry_after = int(oldest[0][1] + window - now) + 1
                return False, max(retry_after, 1)
            return False, window

        return True, 0

    def before_start(self, task_id: str, args: tuple, kwargs: dict) -> None:
        """Called just before task execution starts."""
        logger.info(
            "task_starting",
            task_id=task_id,
            task_name=self.name,
            user_id=kwargs.get("user_id"),
        )

    def on_success(self, retval: Any, task_id: str, args: tuple, kwargs: dict) -> None:
        """Called when task completes successfully."""
        logger.info(
            "task_completed",
            task_id=task_id,
            task_name=self.name,
            user_id=kwargs.get("user_id"),
        )

    def on_failure(
        self,
        exc: Exception,
        task_id: str,
        args: tuple,
        kwargs: dict,
        einfo: Any,
    ) -> None:
        """Called when task fails after all retries."""
        logger.error(
            "task_failed",
            task_id=task_id,
            task_name=self.name,
            user_id=kwargs.get("user_id"),
            error=str(exc),
            exc_info=True,
        )

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        """Execute task with rate limiting check."""
        user_id = kwargs.get("user_id")

        allowed, retry_after = self._check_rate_limit(user_id)
        if not allowed:
            logger.warning(
                "rate_limit_exceeded",
                task_name=self.name,
                user_id=user_id,
                retry_after=retry_after,
            )
            raise self.retry(countdown=retry_after)

        return super().__call__(*args, **kwargs)


# =============================================================================
# PRIORITIZED TASK SUBMISSION
# =============================================================================


def submit_prioritized(
    task: Task,
    args: tuple = (),
    kwargs: dict | None = None,
    user_id: str | None = None,
    user_tier: str = UserTier.STANDARD,
    force_priority: Priority | None = None,
    force_queue: str | None = None,
) -> AsyncResult:
    """
    Submit a task with automatic priority and queue routing.

    Args:
        task: Celery task to submit
        args: Positional arguments for task
        kwargs: Keyword arguments for task
        user_id: User identifier (for rate limiting)
        user_tier: User tier (determines queue and priority)
        force_priority: Override automatic priority
        force_queue: Override automatic queue

    Returns:
        AsyncResult for tracking the task

    Example:
        result = submit_prioritized(
            process_payment,
            kwargs={"amount": 100, "currency": "USD"},
            user_id="usr-123",
            user_tier="premium",
        )
    """
    kwargs = kwargs or {}
    kwargs["user_id"] = user_id

    # Get tier configuration
    tier_config = TIER_CONFIG.get(user_tier, TIER_CONFIG[UserTier.STANDARD])

    # Determine queue and priority
    queue = force_queue or tier_config["queue"]
    priority = force_priority or tier_config["priority"]

    logger.info(
        "submitting_task",
        task_name=task.name,
        user_id=user_id,
        user_tier=user_tier,
        queue=queue,
        priority=priority,
    )

    return task.apply_async(
        args=args,
        kwargs=kwargs,
        queue=queue,
        priority=priority,
    )


def submit_urgent(
    task: Task,
    args: tuple = (),
    kwargs: dict | None = None,
    user_id: str | None = None,
) -> AsyncResult:
    """
    Submit a task with critical priority.

    Use sparingly - for genuinely urgent tasks only.

    Args:
        task: Celery task to submit
        args: Positional arguments
        kwargs: Keyword arguments
        user_id: User identifier

    Returns:
        AsyncResult for tracking
    """
    return submit_prioritized(
        task=task,
        args=args,
        kwargs=kwargs,
        user_id=user_id,
        user_tier=UserTier.ENTERPRISE,
        force_priority=Priority.CRITICAL,
        force_queue="critical",
    )


# =============================================================================
# SAMPLE TASKS
# =============================================================================

# These would be defined in your actual application
# Shown here for reference

"""
from your_app.celery import celery_app

@celery_app.task(
    base=PriorityTask,
    queue="high",
    priority=Priority.HIGH,
    user_rate_limit="10/m",
)
def process_payment(
    user_id: str,
    amount: int,
    currency: str = "USD",
) -> dict:
    '''Process a payment - high priority, strict rate limit.'''
    # Payment processing logic
    return {
        "payment_id": f"pay_{user_id}_{datetime.now(timezone.utc).timestamp()}",
        "status": "completed",
    }


@celery_app.task(
    base=PriorityTask,
    queue="default",
    priority=Priority.NORMAL,
    user_rate_limit="100/m",
)
def send_notification(
    user_id: str,
    message: str,
    channel: str = "email",
) -> dict:
    '''Send notification - normal priority.'''
    return {"user_id": user_id, "channel": channel, "status": "sent"}


@celery_app.task(
    base=PriorityTask,
    queue="low",
    priority=Priority.BULK,
    user_rate_limit="1000/h",
)
def generate_report(
    user_id: str,
    report_type: str,
    params: dict,
) -> dict:
    '''Generate report - bulk queue, relaxed rate limit.'''
    return {
        "report_id": f"rpt_{report_type}_{datetime.now(timezone.utc).isoformat()}",
        "status": "completed",
    }
"""


# =============================================================================
# QUEUE MONITORING
# =============================================================================


def get_queue_depths() -> dict[str, int]:
    """Get current depth of all priority queues."""
    queues = ["critical", "high", "default", "low", "bulk"]
    return {queue: redis_client.llen(queue) for queue in queues}


def get_task_position(task_id: str, queue: str) -> int | None:
    """
    Get approximate position of a task in queue.

    Note: This is approximate due to Redis list structure.

    Args:
        task_id: Task ID to find
        queue: Queue name

    Returns:
        Position (0-indexed) or None if not found
    """
    # This requires scanning the queue, use sparingly
    items = redis_client.lrange(queue, 0, -1)
    for i, item in enumerate(items):
        if task_id.encode() in item:
            return i
    return None
