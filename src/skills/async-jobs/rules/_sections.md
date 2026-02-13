---
title: Async Jobs Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Background Jobs (jobs) — HIGH — 3 rules

Basic async task processing with ARQ, Celery, and FastAPI BackgroundTasks.

- `jobs-task-queue.md` — ARQ setup, task definition, FastAPI enqueue, Celery basic setup
- `jobs-scheduling.md` — Celery Beat periodic tasks, crontab, FastAPI BackgroundTasks
- `jobs-monitoring.md` — Job status tracking, progress updates, status endpoints

## 2. Celery Advanced (celery) — HIGH — 3 rules

Enterprise-grade task orchestration with canvas workflows, priority queues, and monitoring.

- `celery-canvas.md` — Chain, group, chord, map/starmap, signatures, error handling in workflows
- `celery-routing.md` — Priority queues, task routing, rate limiting, multi-queue workers
- `celery-monitoring.md` — Flower dashboard, custom signals, health checks, custom task states
