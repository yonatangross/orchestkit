# Anti-Patterns (FORBIDDEN)

```python
# NEVER run long tasks synchronously in request handlers
@router.post("/api/v1/reports")
async def create_report(data: ReportRequest):
    pdf = await generate_pdf(data)  # Blocks for minutes!

# NEVER block on results inside tasks (causes deadlock)
@celery_app.task
def bad_task():
    result = other_task.delay()
    return result.get()  # Blocks worker!

# NEVER store large results in Redis
@shared_task
def process_file(file_id: str) -> bytes:
    return large_file_bytes  # Store in S3/DB instead!

# NEVER skip idempotency for retried tasks
@celery_app.task(max_retries=3)
def create_order(order):
    Order.create(order)  # Creates duplicates on retry!

# NEVER use BackgroundTasks for distributed work
background_tasks.add_task(long_running_job)  # Lost if server restarts

# NEVER ignore task acknowledgment settings
celery_app.conf.task_acks_late = False  # Default loses tasks on crash

# ALWAYS use immutable signatures in chords
chord([task.s(x) for x in items], callback.si())  # si() prevents arg pollution
```
