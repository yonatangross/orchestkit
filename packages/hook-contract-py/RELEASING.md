# Releasing `orchestkit-hook-contract` to PyPI

Tag-driven release flow. Tags matching `hook-contract-py/v<version>` trigger `.github/workflows/publish-hook-contract-py.yml`, which builds, publishes to TestPyPI, runs a fresh-install smoke test, then publishes to public PyPI and cuts a GitHub Release.

## One-time setup (already done if PyPI shows a trusted publisher)

Register this repo as a Trusted Publisher on PyPI so the workflow can publish without storing a PyPI API token as a secret. OIDC handles auth via short-lived tokens.

### TestPyPI

1. Open https://test.pypi.org/manage/account/publishing/ (log in)
2. Click "Add a new pending publisher"
3. Fill in:
   - **PyPI project name**: `orchestkit-hook-contract`
   - **Owner**: `yonatangross`
   - **Repository name**: `orchestkit`
   - **Workflow filename**: `publish-hook-contract-py.yml`
   - **Environment name**: `testpypi`
4. Save

### PyPI (production)

Same process at https://pypi.org/manage/account/publishing/ with:
   - **Environment name**: `pypi`

## Cut a release

1. Bump `version` in `packages/hook-contract-py/pyproject.toml` AND `packages/hook-contract-py/src/orchestkit_hook_contract/__init__.py` (the `__version__` constant)
2. Update `packages/hook-contract-py/CHANGELOG.md` with the new section
3. Commit: `chore(release): hook-contract-py v0.X.Y`
4. Tag and push:
   ```bash
   git tag hook-contract-py/v0.X.Y
   git push origin hook-contract-py/v0.X.Y
   ```
5. Watch CI at https://github.com/yonatangross/orchestkit/actions/workflows/publish-hook-contract-py.yml
6. Verify on https://pypi.org/project/orchestkit-hook-contract/ once the workflow completes

## Recovery

If `git push --tags` lands the tag but the push event silently no-ops (rare GitHub bug), use the manual recovery lever:

1. Open Actions → "Publish orchestkit-hook-contract" → "Run workflow"
2. Enter the tag (e.g. `hook-contract-py/v0.1.0`)
3. Run

The `workflow_dispatch` path pins the checkout to that exact tag and runs the identical pipeline.

## Versioning policy

- **Major (1.0.0 → 2.0.0)**: spec-level breaking changes that consumers must adapt to (e.g. removing a deprecated payload field)
- **Minor (0.1.0 → 0.2.0)**: new events, new optional payload fields, new exported types
- **Patch (0.1.0 → 0.1.1)**: bug fixes, docs, internal refactors that don't change the public surface

For now we're in the 0.x range so minor bumps may include breaking changes — semver strictness kicks in at 1.0.0.

## Why two-stage (TestPyPI then PyPI)

The smoke test installs the just-published wheel from TestPyPI in a fresh Python environment and confirms imports + basic surface assertions before pushing to production PyPI. This catches "the wheel built fine but pip can't install it" failures (wrong metadata, missing platform tags, broken package layout) without polluting the production registry with a broken release.

If the smoke test fails, the release stops at TestPyPI — production PyPI never sees the broken version. To retry, fix the issue, bump the version, re-tag.
