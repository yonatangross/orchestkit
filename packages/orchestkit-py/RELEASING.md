# Releasing `orchestkit` to PyPI

Tag-driven. Tags matching `orchestkit-py/v<version>` trigger
`.github/workflows/publish-orchestkit-py.yml`.

## One-time trusted publisher

Same account as `orchestkit-hook-contract` (1Password tag `pypi,orchestkit,trusted-publisher`).

### TestPyPI

1. https://test.pypi.org/manage/account/publishing/
2. Add a pending publisher:
   - PyPI project name: `orchestkit`
   - Owner: `yonatangross`
   - Repository name: `orchestkit`
   - Workflow filename: `publish-orchestkit-py.yml`
   - Environment name: `testpypi`

### PyPI

https://pypi.org/manage/account/publishing/ with environment name `pypi`.

## Cut a release

1. Bump `version` in `pyproject.toml` and `__version__` in `src/orchestkit/__init__.py`
2. Update CHANGELOG.md
3. Tag: `git tag orchestkit-py/v0.1.0 && git push origin orchestkit-py/v0.1.0`
