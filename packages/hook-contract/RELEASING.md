# Releasing `@orchestkit/hook-contract` (npm)

Twin of `packages/hook-contract-py/RELEASING.md`. The npm and PyPI packages ship
in **lockstep** off `spec/hook-events.spec.yml` — one version across both
registries. The publish itself runs in CI via OIDC; no `NPM_TOKEN` is stored.

## One-time setup (DONE — recorded for posterity / re-bootstrap)

1. **npm org** — `orchestkit` org created on npmjs.com (free, public). Owns the
   `@orchestkit/*` scope. ✅ (2026-05-30)
2. **First publish** — `@orchestkit/hook-contract@0.1.0` was published manually
   (`npm publish --access public`) to create the package, since npm only lets
   you attach a Trusted Publisher to a package that already exists. ✅
3. **Trusted Publisher** — on npmjs.com → package Settings → Trusted Publisher:
   repo `yonatangross/orchestkit`, workflow `publish-hook-contract-npm.yml`,
   environment `npm`. ✅
4. **GitHub environment** — create an environment named `npm` in the repo
   (Settings → Environments). The publish job pins `environment: name: npm`.
   Add reviewers/branch protections here if you want a manual gate before publish.

## Cutting a release (every version after 0.1.0)

The contract ships as ONE version number. To release `X.Y.Z`:

1. Edit `spec/hook-events.spec.yml` as needed and run codegen on both packages
   (`npm run codegen` here, `python scripts/codegen-py.py` on the py side).
2. Bump **all** version sources to the SAME `X.Y.Z`:
   - `packages/hook-contract/package.json` → `version`
   - `packages/hook-contract/src/index.ts` → `HOOK_CONTRACT_VERSION`
   - `packages/hook-contract-py/pyproject.toml` → `version`
3. Commit + merge to `main`.
4. Tag **both** registries at the same version and push:
   ```bash
   git tag hook-contract-npm/vX.Y.Z
   git tag hook-contract-py/vX.Y.Z
   git push origin hook-contract-npm/vX.Y.Z hook-contract-py/vX.Y.Z
   ```

Each tag triggers its publish workflow. The preflight **refuses to publish**
unless `tag == package.json == HOOK_CONTRACT_VERSION == pyproject` (the lockstep
parity gate, enforced symmetrically in both workflows), and both depend on
`contract-parity.yml` proving the generated code matches the spec.

## Recovery lever

If a `git push --tags` lands the tag on origin but the push event no-ops, run
the workflow manually: Actions → "Publish @orchestkit/hook-contract" →
Run workflow → `tag = hook-contract-npm/vX.Y.Z`.

## CI publishes are provenanced

CI runs `npm publish --provenance` via OIDC, so every release after the manual
0.1.0 carries a verifiable provenance attestation. The first 0.1.0 (manual) does
not — that is expected.
