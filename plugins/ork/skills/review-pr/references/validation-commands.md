# Validation Commands

## Backend

```bash
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run pytest tests/unit/ -v --tb=short
poetry run pytest tests/ -v --cov=app --cov-report=term-missing
```

## Frontend

```bash
cd frontend
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test -- --coverage
```

## Integration Tests (if infrastructure detected)

```bash
# Detect real service testing capability
ls **/docker-compose*.yml 2>/dev/null
ls **/testcontainers* 2>/dev/null

# If detected, run integration tests against real services
docker-compose -f docker-compose.test.yml up -d
poetry run pytest tests/integration/ -v
docker-compose -f docker-compose.test.yml down
```

## Test Adequacy Check

```bash
# List changed files without corresponding test files
gh pr diff $ARGUMENTS --name-only | while read f; do
  # Skip test files, configs, docs
  case "$f" in
    tests/*|*test*|*.md|*.json|*.yml) continue ;;
  esac
  # Check if a test file exists
  test_file="tests/$(basename "$f" .py)_test.py"
  if [ ! -f "$test_file" ]; then
    echo "NO TEST: $f"
  fi
done
```
