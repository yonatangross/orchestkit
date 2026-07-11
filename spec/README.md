# `spec/` — hook-event contract

Single source of truth for the hook-event contract shared across the TypeScript
and Python hook implementations.

- **`hook-events.spec.yml`** — the canonical hook-event schema.

## Do not move

This path is **hardcoded** in four CI workflows that gate on it via `paths:`
triggers and drift checks:

- `.github/workflows/contract-parity.yml`
- `.github/workflows/hook-contract.yml`
- `.github/workflows/hook-contract-py.yml`
- `.github/workflows/publish-hook-contract-npm.yml`

It is also consumed by the `@orchestkit/hook-contract` npm and PyPI packages
(`packages/hook-contract`, `packages/hook-contract-py`). Relocating the file
means editing every workflow and both packages — keep it here.
