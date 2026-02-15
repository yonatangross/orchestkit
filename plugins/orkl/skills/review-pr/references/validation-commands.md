# Validation Commands

## Backend

```bash
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run pytest tests/unit/ -v --tb=short
```

## Frontend

```bash
cd frontend
npm run format:check
npm run lint
npm run typecheck
npm run test
```
