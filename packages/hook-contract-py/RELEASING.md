# Releasing `orchestkit-hook-contract` to PyPI

Tag-driven release flow. Tags matching `hook-contract-py/v<version>` trigger `.github/workflows/publish-hook-contract-py.yml`, which builds, publishes to TestPyPI, runs a fresh-install smoke test, then publishes to public PyPI and cuts a GitHub Release.

## Accounts

| Registry | Username | Credential stored in |
|---|---|---|
| https://pypi.org | `<your-pypi-username>` | 1Password: `op://<vault>/PyPI` (tag: `pypi,orchestkit,trusted-publisher`) |
| https://test.pypi.org | `<your-pypi-username>` (register if not yet) | Same 1Password entry |

<!-- Real account handle + vault path are intentionally NOT committed to this public repo (recon hardening). The maintainer's actual values live in 1Password; substitute your own when following this runbook. PyPI project ownership is already visible on pypi.org, so no functional detail is lost. -->

> The PyPI package's maintainers are visible on the pypi.org project page — this table names the *role*, not a specific person.

> No API token stored in GitHub Actions secrets — OIDC trusted publishing handles auth via short-lived tokens minted per-run.

## One-time setup (already done if PyPI shows a trusted publisher)

Register this repo as a Trusted Publisher on PyPI so the workflow can publish without storing a PyPI API token as a secret.

### TestPyPI

1. Log in as `<your-pypi-username>` at https://test.pypi.org/manage/account/publishing/
2. (If you haven't registered `<your-pypi-username>` on TestPyPI yet, register the account first — same email recommended.)
3. Click "Add a new pending publisher"
4. Fill in:
   - **PyPI project name**: `orchestkit-hook-contract`
   - **Owner**: `yonatangross`
   - **Repository name**: `orchestkit`
   - **Workflow filename**: `publish-hook-contract-py.yml`
   - **Environment name**: `testpypi`
5. Save

### PyPI (production)

Log in as `<your-pypi-username>` at https://pypi.org/manage/account/publishing/ and repeat the same form with:
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
