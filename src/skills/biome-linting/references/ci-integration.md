# Biome CI Integration

Setting up Biome in CI/CD pipelines.

## GitHub Actions

### Basic Workflow

```yaml
# .github/workflows/lint.yml
name: Code Quality

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Biome
        uses: biomejs/setup-biome@v2
        with:
          version: latest

      - name: Run Biome
        run: biome ci .
```

### With Node.js

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Biome
        run: npx biome ci .
```

### Combined with Tests

```yaml
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      # Run in parallel
      - name: Lint
        run: npx biome ci .

      - name: Type Check
        run: npx tsc --noEmit

      - name: Test
        run: npm test
```

## Pre-commit Hooks

### With Lefthook

```yaml
# lefthook.yml
pre-commit:
  commands:
    biome:
      glob: '*.{js,ts,jsx,tsx,json,css}'
      run: npx biome check --write {staged_files}
      stage_fixed: true
```

### With Husky + lint-staged

```bash
npm install -D husky lint-staged
npx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx}": [
      "biome check --write"
    ],
    "*.{json,css}": [
      "biome format --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

## GitLab CI

```yaml
# .gitlab-ci.yml
lint:
  image: node:20
  script:
    - npm ci
    - npx biome ci .
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## CLI Commands for CI

### biome ci

Strict mode for CI environments:

```bash
# Fails on any error or warning
biome ci .

# Same as:
biome check --max-diagnostics=0 .
```

### biome check

More control over output:

```bash
# Check with specific max diagnostics
biome check --max-diagnostics=20 .

# Check specific files
biome check src/

# With specific config
biome check --config-path=./biome.json .
```

### Formatting Only

```bash
# Check formatting (no fix)
biome format --check .

# Fix formatting
biome format --write .
```

### Linting Only

```bash
# Lint only (no format)
biome lint .

# Lint with auto-fix
biome lint --write .
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Errors found |
| `2` | Invalid arguments |
| `3` | Config error |

## Performance Tips

### Parallel Execution

Biome is multi-threaded by default. For large repos:

```bash
# Limit threads if needed
BIOME_MAX_THREADS=4 biome ci .
```

### Caching

```yaml
# GitHub Actions with caching
- name: Cache Biome
  uses: actions/cache@v4
  with:
    path: ~/.cache/biome
    key: biome-${{ hashFiles('biome.json') }}
```

## Reporter Options

```bash
# Default: human-readable
biome ci .

# JSON output for parsing
biome ci --reporter=json .

# GitHub Actions annotations
biome ci --reporter=github .

# Summary only
biome ci --reporter=summary .
```

## Integration with PR Comments

```yaml
- name: Run Biome
  id: biome
  run: npx biome ci --reporter=json . > biome-results.json
  continue-on-error: true

- name: Comment on PR
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs')
      const results = JSON.parse(fs.readFileSync('biome-results.json', 'utf8'))
      // Process and comment
```
