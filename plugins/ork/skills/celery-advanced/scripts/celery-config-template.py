"""
Production Celery Configuration Template

Features:
- Redis broker with connection pooling
- Priority queues (high/default/low)
- Rate limiting support
- Task routing
- Health checks
- Prometheus metrics

Usage:
    from celery_config import celery_app

Requirements:
    celery>=5.4.0
    redis>=5.0.0
    kombu>=5.3.0
"""

from celery import Celery
from kombu import Queue, Exchange
from datetime import timedelta
import ssl

# =============================================================================
# BROKER AND BACKEND CONFIGURATION
# =============================================================================

REDIS_URL = "redis://localhost:6379/0"
REDIS_BACKEND_URL = "redis://localhost:6379/1"

# For production with TLS
REDIS_TLS_URL = "rediss://user:password@redis.example.com:6380/0"

celery_app = Celery(
    "app",
    broker=REDIS_URL,
    backend=REDIS_BACKEND_URL,
    include=["app.tasks"],  # List of task modules
)

# =============================================================================
# BROKER TRANSPORT OPTIONS
# =============================================================================

celery_app.conf.broker_transport_options = {
    # Priority queue support (Redis 5+)
    "priority_steps": list(range(10)),  # 0-9 priority levels (0=highest)
    "sep": ":",
    "queue_order_strategy": "priority",

    # Connection settings
    "visibility_timeout": 43200,  # 12 hours - for long-running tasks
    "socket_timeout": 30,
    "socket_connect_timeout": 30,
    "retry_on_timeout": True,

    # Health check interval
    "health_check_interval": 25,
}

# Connection pool settings
celery_app.conf.broker_pool_limit = 10  # Max connections in pool
celery_app.conf.broker_connection_retry_on_startup = True
celery_app.conf.broker_connection_max_retries = 10

# =============================================================================
# QUEUE CONFIGURATION
# =============================================================================

default_exchange = Exchange("default", type="direct")
priority_exchange = Exchange("priority", type="direct")

celery_app.conf.task_queues = (
    # High priority queue - for urgent tasks
    Queue(
        "high",
        exchange=priority_exchange,
        routing_key="high",
        queue_arguments={"x-max-priority": 10},
    ),
    # Default queue - standard processing
    Queue(
        "default",
        exchange=default_exchange,
        routing_key="default",
        queue_arguments={"x-max-priority": 10},
    ),
    # Low priority queue - bulk/batch operations
    Queue(
        "low",
        exchange=priority_exchange,
        routing_key="low",
        queue_arguments={"x-max-priority": 10},
    ),
    # Dedicated queues for specific task types
    Queue(
        "notifications",
        exchange=default_exchange,
        routing_key="notifications",
    ),
    Queue(
        "analytics",
        exchange=default_exchange,
        routing_key="analytics",
    ),
)

celery_app.conf.task_default_queue = "default"
celery_app.conf.task_default_exchange = "default"
celery_app.conf.task_default_routing_key = "default"

# =============================================================================
# TASK ROUTING
# =============================================================================

celery_app.conf.task_routes = {
    # Route by task name pattern
    "app.tasks.critical_*": {"queue": "high", "priority": 9},
    "app.tasks.bulk_*": {"queue": "low", "priority": 1},
    "app.tasks.send_*": {"queue": "notifications"},
    "app.tasks.analytics_*": {"queue": "analytics"},

    # Specific task routing
    "app.tasks.process_payment": {"queue": "high", "priority": 10},
    "app.tasks.generate_report": {"queue": "low", "priority": 0},
}

# =============================================================================
# TASK EXECUTION SETTINGS
# =============================================================================

celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.timezone = "UTC"
celery_app.conf.enable_utc = True

# Task acknowledgment - ack AFTER task completes for reliability
celery_app.conf.task_acks_late = True
celery_app.conf.task_reject_on_worker_lost = True

# Prefetch settings - limit how many tasks workers grab at once
celery_app.conf.worker_prefetch_multiplier = 1  # Recommended for priority queues

# Task execution limits
celery_app.conf.task_time_limit = 3600  # 1 hour hard limit
celery_app.conf.task_soft_time_limit = 3000  # 50 minutes soft limit

# Track task start time
celery_app.conf.task_track_started = True

# =============================================================================
# RESULT BACKEND SETTINGS
# =============================================================================

celery_app.conf.result_backend = REDIS_BACKEND_URL
celery_app.conf.result_expires = timedelta(days=1)  # Results expire after 1 day
celery_app.conf.result_extended = True  # Store task name, args, kwargs with result

# Compression for large results
celery_app.conf.result_compression = "gzip"

# =============================================================================
# RETRY SETTINGS
# =============================================================================

celery_app.conf.task_default_retry_delay = 30  # seconds
celery_app.conf.task_max_retries = 3

# =============================================================================
# RATE LIMITING
# =============================================================================

# Global rate limits per task (can be overridden per-task)
celery_app.conf.task_annotations = {
    "app.tasks.call_external_api": {"rate_limit": "100/m"},  # 100 per minute
    "app.tasks.send_email": {"rate_limit": "10/s"},  # 10 per second
    "app.tasks.bulk_import": {"rate_limit": "5/m"},  # 5 per minute
}

# =============================================================================
# WORKER SETTINGS
# =============================================================================

# Concurrency (override with -c flag)
celery_app.conf.worker_concurrency = 4

# Worker hijack root logger for structured logging
celery_app.conf.worker_hijack_root_logger = False

# Send events for monitoring (Flower)
celery_app.conf.worker_send_task_events = True
celery_app.conf.task_send_sent_event = True

# Autoscaling (commented - use HPA in Kubernetes instead)
# celery_app.conf.worker_autoscaler = "celery.worker.autoscale:Autoscaler"
# celery_app.conf.worker_min_concurrency = 2
# celery_app.conf.worker_max_concurrency = 10

# =============================================================================
# BEAT SCHEDULER (Periodic Tasks)
# =============================================================================

celery_app.conf.beat_schedule = {
    "cleanup-expired-sessions": {
        "task": "app.tasks.cleanup_sessions",
        "schedule": timedelta(hours=1),
        "options": {"queue": "low"},
    },
    "generate-daily-report": {
        "task": "app.tasks.generate_daily_report",
        "schedule": timedelta(days=1),
        "options": {"queue": "analytics"},
    },
    "health-check": {
        "task": "app.tasks.health_check",
        "schedule": timedelta(minutes=5),
        "options": {"queue": "high", "priority": 10},
    },
}

# Store beat schedule in Redis for multi-instance deployments
# Requires: pip install celery-redbeat
# celery_app.conf.beat_scheduler = "redbeat.RedBeatScheduler"
# celery_app.conf.redbeat_redis_url = REDIS_URL

# =============================================================================
# SECURITY (Production)
# =============================================================================

# For production with TLS
# celery_app.conf.broker_use_ssl = {
#     "ssl_cert_reqs": ssl.CERT_REQUIRED,
#     "ssl_ca_certs": "/path/to/ca.pem",
#     "ssl_certfile": "/path/to/client-cert.pem",
#     "ssl_keyfile": "/path/to/client-key.pem",
# }

# celery_app.conf.redis_backend_use_ssl = {
#     "ssl_cert_reqs": ssl.CERT_REQUIRED,
#     "ssl_ca_certs": "/path/to/ca.pem",
# }

# =============================================================================
# PROMETHEUS METRICS (Optional)
# =============================================================================

# Requires: pip install celery-exporter
# Run: celery-exporter --broker-url=$REDIS_URL --listen-address=0.0.0.0:9808


# =============================================================================
# ENVIRONMENT-BASED CONFIGURATION
# =============================================================================

import os

if os.getenv("CELERY_ENV") == "production":
    celery_app.conf.update(
        broker_url=os.getenv("REDIS_URL"),
        result_backend=os.getenv("REDIS_BACKEND_URL"),
        worker_prefetch_multiplier=1,
        task_acks_late=True,
        task_reject_on_worker_lost=True,
    )
elif os.getenv("CELERY_ENV") == "development":
    celery_app.conf.update(
        worker_prefetch_multiplier=4,
        task_always_eager=False,  # Set True for synchronous testing
        task_eager_propagates=True,
    )

# =============================================================================
# HEALTH CHECK ENDPOINT
# =============================================================================


def celery_health_check() -> dict:
    """Check Celery health for Kubernetes probes."""
    try:
        # Check broker connection
        conn = celery_app.connection()
        conn.ensure_connection(max_retries=3)

        # Check workers
        inspector = celery_app.control.inspect()
        active_workers = inspector.active()

        if not active_workers:
            return {
                "status": "degraded",
                "broker": "connected",
                "workers": 0,
            }

        return {
            "status": "healthy",
            "broker": "connected",
            "workers": len(active_workers),
            "active_tasks": sum(len(tasks) for tasks in active_workers.values()),
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
        }
