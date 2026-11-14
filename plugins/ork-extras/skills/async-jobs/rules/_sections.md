---
title: Async Jobs Rule Categories
version: 2.0.0
---

# Rule Categories

3 categories, 6 rules.

## 1. Jobs (jobs) - HIGH - 3 rules

Task queue setup, scheduling, and job status tracking for Celery and ARQ.

| Rule | Impact | File |
|------|--------|------|
| Task Queue Setup | HIGH | `jobs-task-queue.md` |
| Scheduling and Background Tasks | HIGH | `jobs-scheduling.md` |
| Job Status Tracking | HIGH | `jobs-monitoring.md` |

## 2. Celery Canvas (celery) - HIGH - 1 rule

Celery canvas primitives for multi-step task orchestration.

| Rule | Impact | File |
|------|--------|------|
| Canvas Workflows | HIGH | `celery-canvas.md` |

## 3. Temporal Workflows (temporal) - HIGH - 2 rules

Temporal.io durable execution engine for long-running, fault-tolerant distributed workflows.

| Rule | Impact | File |
|------|--------|------|
| Temporal Workflow Definitions | HIGH | `temporal-workflows.md` |
| Temporal Activity and Worker Patterns | HIGH | `temporal-activities.md` |
