---
title: CI Integration
impact: HIGH
impactDescription: "Without automated CI/CD integration, golden dataset backups become stale, validation gaps go undetected, and deployment risks increase"
tags: ci-cd, github-actions, automation, scheduled-backup, deployment
---

## CI Integration

GitHub Actions automation, pre-deployment validation, and scheduled backup patterns.

**Automated Weekly Backup:**
```yaml
# .github/workflows/backup-golden-dataset.yml
name: Backup Golden Dataset

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2am
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          poetry install

      - name: Run backup
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
        run: |
          cd backend
          poetry run python scripts/backup_golden_dataset.py backup

      - name: Commit backup
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add backend/data/golden_dataset_backup.json
          git add backend/data/golden_dataset_metadata.json
          git diff-index --quiet HEAD || git commit -m "chore: automated golden dataset backup [skip ci]"
          git push
```

**Validation on Pull Request:**
```yaml
# .github/workflows/validate-golden-dataset.yml
name: Validate Golden Dataset

on:
  pull_request:
    paths:
      - 'backend/data/golden_dataset_backup.json'
  schedule:
    - cron: '0 8 * * 1'  # Weekly on Monday 8am

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          poetry install

      - name: Start PostgreSQL
        run: docker compose up -d postgres

      - name: Run migrations
        run: |
          cd backend
          poetry run alembic upgrade head

      - name: Restore golden dataset
        run: |
          cd backend
          poetry run python scripts/backup_golden_dataset.py restore

      - name: Validate dataset
        run: |
          cd backend
          poetry run python scripts/backup_golden_dataset.py verify

      - name: Run retrieval tests
        run: |
          cd backend
          poetry run pytest tests/integration/test_retrieval_quality.py -v
```

**Pre-Deployment Checklist:**
```bash
cd backend

# 1. Backup current data
poetry run python scripts/backup_golden_dataset.py backup

# 2. Verify backup integrity
poetry run python scripts/backup_golden_dataset.py verify

# 3. Run retrieval quality tests
poetry run pytest tests/integration/test_retrieval_quality.py

# 4. Check for regressions
# Expected: 91.6% pass rate, 0.777 MRR
# If lower, investigate before deploying
```

**Manual CI Trigger:**
```bash
# Trigger workflow manually
gh workflow run backup-golden-dataset.yml

# Check workflow status
gh run list --workflow=backup-golden-dataset.yml

# View logs
gh run view --log
```

**Pre-Commit Hook:**
```bash
#!/bin/bash
# Only run if golden dataset files changed
CHANGED_FILES=$(git diff --cached --name-only)

if echo "$CHANGED_FILES" | grep -q "fixtures/documents_expanded.json\|fixtures/queries.json"; then
    echo "Validating golden dataset changes..."

    cd backend
    poetry run python scripts/data/add_to_golden_dataset.py validate-all

    if [ $? -ne 0 ]; then
        echo "Golden dataset validation failed!"
        exit 1
    fi

    echo "Golden dataset validation passed"
fi
```

**Incorrect — Backup without validation:**
```yaml
# Missing verification step
- name: Run backup
  run: poetry run python scripts/backup_golden_dataset.py backup
- name: Commit backup
  run: git commit -m "chore: backup"
```

**Correct — Backup with verification:**
```yaml
# Verify backup integrity
- name: Run backup
  run: poetry run python scripts/backup_golden_dataset.py backup
- name: Verify backup
  run: poetry run python scripts/backup_golden_dataset.py verify
- name: Commit backup
  run: git commit -m "chore: automated golden dataset backup [skip ci]"
```

**Key rules:**
- Set up weekly automated backups to prevent data staleness
- Validate golden dataset on every PR that modifies dataset files
- Always run verification after automated backup creation
- Use `[skip ci]` in automated commit messages to prevent infinite loops
- Include pre-deployment validation in release checklists
