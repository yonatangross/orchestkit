# CI/CD Pipelines

Comprehensive CI/CD patterns for GitHub Actions, caching, matrix testing, and artifact management.

## Branch Strategy

**Recommended: Git Flow with Feature Branches**
```
main (production) ─────●────────●──────>
                       ┃        ┃
dev (staging) ─────●───●────●───●──────>
                   ┃        ┃
feature/* ─────────●────────┘
                   ▲
                   └─ PR required, CI checks, code review
```

**Branch protection rules:**
- `main`: Require PR + 2 approvals + all checks pass
- `dev`: Require PR + 1 approval + all checks pass
- Feature branches: No direct commits to main/dev

## GitHub Actions Caching Strategy

```yaml
- name: Cache Dependencies
  uses: actions/cache@v3
  with:
    path: |
      ~/.npm
      node_modules
      backend/.venv
    key: ${{ runner.os }}-deps-${{ hashFiles('**/package-lock.json', '**/poetry.lock') }}
    restore-keys: |
      ${{ runner.os }}-deps-
```

**Cache hit ratio impact:**
- Without cache: 2-3 min install time
- With cache: 10-20 sec install time
- **~85% time savings** on typical workflows

## Artifact Management

```yaml
# Build and upload artifact
- name: Build Application
  run: npm run build

- name: Upload Build Artifact
  uses: actions/upload-artifact@v3
  with:
    name: build-${{ github.sha }}
    path: dist/
    retention-days: 7

# Download in deployment job
- name: Download Build Artifact
  uses: actions/download-artifact@v3
  with:
    name: build-${{ github.sha }}
    path: dist/
```

**Benefits:**
- Avoid rebuilding in deployment job
- Deploy exact tested artifact (byte-for-byte match)
- Retention policies prevent storage bloat

## Matrix Testing

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
    os: [ubuntu-latest, windows-latest]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm test
```

## Complete Backend CI/CD Example

```yaml
name: Backend CI/CD

on:
  push:
    branches: [main, dev]
    paths: ['backend/**']
  pull_request:
    branches: [main, dev]
    paths: ['backend/**']

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Cache Poetry Dependencies
        uses: actions/cache@v3
        with:
          path: ~/.cache/pypoetry
          key: ${{ runner.os }}-poetry-${{ hashFiles('backend/poetry.lock') }}

      - name: Install Poetry
        run: pip install poetry

      - name: Install Dependencies
        run: poetry install

      - name: Run Ruff Format Check
        run: poetry run ruff format --check app/

      - name: Run Ruff Lint
        run: poetry run ruff check app/

      - name: Run Type Check
        run: poetry run mypy app/ --ignore-missing-imports

      - name: Run Tests
        run: poetry run pytest tests/ --cov=app --cov-report=xml

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage.xml

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Trivy Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'backend/'
          severity: 'CRITICAL,HIGH'
```

**Key features:**
- Path filtering (only run on backend changes)
- Poetry dependency caching
- Comprehensive quality checks (format, lint, type, test)
- Security scanning with Trivy

## Pipeline Stages

1. **Lint & Type Check** - Code quality gates
2. **Unit Tests** - Test coverage with reporting
3. **Security Scan** - npm audit + Trivy vulnerability scanner
4. **Build & Push** - Docker image to container registry
5. **Deploy Staging** - Environment-gated deployment
6. **Deploy Production** - Manual approval or automated

## Best Practices

1. **Fast feedback** - tests complete in < 5 min
2. **Fail fast** - stop on first failure
3. **Cache dependencies** - npm/pip cache
4. **Matrix testing** - multiple Node/Python versions
5. **Secrets management** - use GitHub Secrets
6. **Branch protection** - require passing tests

See `scripts/github-actions-pipeline.yml` for complete examples.