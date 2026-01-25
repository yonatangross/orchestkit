# GitHub Actions CI/CD Example

Complete pipeline for a Python FastAPI + React application.

## Repository Structure

```
├── .github/workflows/
│   ├── ci.yml          # Test on every PR
│   ├── deploy.yml      # Deploy on main merge
│   └── security.yml    # Weekly security scan
├── backend/            # FastAPI
├── frontend/           # React
└── docker-compose.yml
```

## CI Pipeline (`ci.yml`)

```yaml
name: CI

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install Poetry
        uses: snok/install-poetry@v1
        with:
          virtualenvs-create: true
          virtualenvs-in-project: true

      - name: Cache dependencies
        uses: actions/cache@v4
        with:
          path: backend/.venv
          key: venv-${{ runner.os }}-${{ hashFiles('backend/poetry.lock') }}

      - name: Install dependencies
        working-directory: backend
        run: poetry install --no-interaction

      - name: Lint
        working-directory: backend
        run: |
          poetry run ruff format --check app/
          poetry run ruff check app/

      - name: Type check
        working-directory: backend
        run: poetry run mypy app/ --ignore-missing-imports

      - name: Test
        working-directory: backend
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
        run: poetry run pytest --cov=app --cov-report=xml -v

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: backend/coverage.xml

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install
        working-directory: frontend
        run: npm ci

      - name: Lint
        working-directory: frontend
        run: npm run lint

      - name: Type check
        working-directory: frontend
        run: npm run typecheck

      - name: Test
        working-directory: frontend
        run: npm run test:coverage

      - name: Build
        working-directory: frontend
        run: npm run build
```

## Deploy Pipeline (`deploy.yml`)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires approval

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build & push backend
        run: |
          docker build -t $ECR_REGISTRY/backend:${{ github.sha }} ./backend
          docker push $ECR_REGISTRY/backend:${{ github.sha }}

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster production \
            --service backend \
            --force-new-deployment

      - name: Deploy frontend to S3
        run: |
          cd frontend && npm ci && npm run build
          aws s3 sync dist/ s3://$S3_BUCKET --delete
          aws cloudfront create-invalidation --distribution-id $CF_DIST --paths "/*"
```

## Security Scan (`security.yml`)

```yaml
name: Security

on:
  schedule:
    - cron: "0 0 * * 0"  # Weekly Sunday midnight
  workflow_dispatch:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Python dependencies
        run: |
          pip install pip-audit
          pip-audit -r backend/requirements.txt

      - name: Node dependencies
        working-directory: frontend
        run: npm audit --audit-level=high

      - name: Docker scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: backend:latest
          severity: HIGH,CRITICAL
```

## Key Patterns

| Pattern | Implementation |
|---------|---------------|
| Caching | Poetry venv, npm cache |
| Concurrency | Cancel in-progress on new push |
| Services | Postgres container for tests |
| Environments | Production requires approval |
| Artifacts | Coverage reports to Codecov |
