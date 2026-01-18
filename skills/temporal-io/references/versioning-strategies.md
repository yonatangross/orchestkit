# Versioning Strategies

## The Determinism Problem

Workflows must be deterministic for replay. Changing workflow code breaks running workflows.

## workflow.patched() - Branching

For adding new code paths while supporting running workflows.

```python
@workflow.defn
class PaymentWorkflow:
    @workflow.run
    async def run(self, payment: PaymentInput) -> PaymentResult:
        # Version 1: Old workflows take this path
        # Version 2+: New workflows take patched path

        if workflow.patched("v2-fraud-check"):
            # New: Add fraud check before payment
            fraud_result = await workflow.execute_activity(
                check_fraud,
                payment,
                start_to_close_timeout=timedelta(seconds=30),
            )
            if fraud_result.is_fraudulent:
                return PaymentResult(status="blocked")

        # Both versions execute this
        return await workflow.execute_activity(
            process_payment,
            payment,
            start_to_close_timeout=timedelta(minutes=5),
        )
```

**When to use:**
- Adding new steps to existing workflows
- Changing activity parameters
- Adding error handling

## workflow.deprecate_patch() - Cleanup

Remove old code paths after all old workflows complete.

```python
@workflow.defn
class PaymentWorkflow:
    @workflow.run
    async def run(self, payment: PaymentInput) -> PaymentResult:
        # Phase 1: Use patched() to add new code
        # Phase 2: After all v1 workflows complete, use deprecate_patch()
        # Phase 3: Remove deprecate_patch() entirely

        workflow.deprecate_patch("v2-fraud-check")

        # Now only new code exists
        fraud_result = await workflow.execute_activity(
            check_fraud,
            payment,
            start_to_close_timeout=timedelta(seconds=30),
        )
        if fraud_result.is_fraudulent:
            return PaymentResult(status="blocked")

        return await workflow.execute_activity(
            process_payment,
            payment,
            start_to_close_timeout=timedelta(minutes=5),
        )
```

## Worker Versioning (Build IDs)

Assign workers to specific workflow versions.

```python
from temporalio.worker import Worker

# Register worker with build ID
worker = Worker(
    client,
    task_queue="payments",
    workflows=[PaymentWorkflow],
    activities=[process_payment, check_fraud],
    build_id="v2.1.0",  # Worker version
    use_worker_versioning=True,
)
```

**Server-side versioning rules:**
```bash
# Add new version as default
temporal task-queue update-build-ids add-new-default \
  --task-queue payments \
  --build-id v2.1.0

# Make compatible with previous version
temporal task-queue update-build-ids add-new-compatible \
  --task-queue payments \
  --build-id v2.1.0 \
  --existing-compatible-build-id v2.0.0
```

## Safe Deployment Pattern

1. **Deploy new workers** with version N+1 (do NOT remove old workers yet)
2. **Test** new workflows start on N+1 workers
3. **Wait** for all N workflows to complete
4. **Remove** version N workers

```python
# Deployment script
async def safe_deploy():
    # 1. Deploy new workers
    await deploy_workers("v2.1.0")

    # 2. Verify new workflows use new workers
    handle = await client.start_workflow(
        PaymentWorkflow.run,
        test_payment,
        id="deploy-test",
        task_queue="payments",
    )
    assert (await handle.result()).version == "v2.1.0"

    # 3. Wait for old workflows
    while await count_running_workflows("v2.0.0") > 0:
        await asyncio.sleep(60)

    # 4. Remove old workers
    await remove_workers("v2.0.0")
```

## Activity Versioning

Activities are easier - just deploy new code.

```python
# Old activity signature
@activity.defn
async def send_email(to: str, subject: str, body: str): ...

# New activity signature - NEW NAME required
@activity.defn
async def send_email_v2(input: EmailInput): ...
```

For activity signature changes, create new activity with new name.
