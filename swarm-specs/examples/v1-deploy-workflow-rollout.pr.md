## Summary

Migrate this repo's deploy workflow to the canonical reusable workflow
at `yonatangross/.github/.github/workflows/deploy.yml@v1`. Opened by
`/ork:swarm-migrate` from
`swarm-specs/examples/v1-deploy-workflow-rollout.yaml`.

## Change

`.github/workflows/deploy.yml` is now a thin caller:

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    uses: yonatangross/.github/.github/workflows/deploy.yml@v1
    secrets: inherit
```

The original workflow is preserved at
`.github/workflows/deploy.yml.pre-v1.bak` for reviewer comparison. Delete
that backup file in a follow-up commit once you've eyeballed the diff
and confirmed nothing custom is being lost.

## Why

- Single source of truth for deploy logic (the @v1 workflow).
- Bug fixes and observability improvements in @v1 propagate to every
  consumer without touching N repos.
- Eliminates the historic CI-debug-by-drift sessions (per the 2026-05-16
  insights audit, drift between deploy workflows contributed to multiple
  of the 28 CI-debug sessions logged in the prior month).

## Test plan

- [ ] CI `build`, `test`, `lint` all green on this PR
- [ ] After merge: trigger a manual `workflow_dispatch` and confirm the
      deploy completes
- [ ] After merge: delete `deploy.yml.pre-v1.bak` in a follow-up

## If something in the original workflow doesn't map to @v1

Don't merge. The coordinator will have paused this repo's branch. Add a
comment here describing the missing capability, and either:
1. File an issue against `yonatangross/.github` to extend @v1, OR
2. Pin THIS repo to a bespoke workflow with a comment explaining why.

## Rollback

Single revert commit. The bespoke workflow is in
`.github/workflows/deploy.yml.pre-v1.bak` until you delete it.
