---
name: create-ci-pipeline
description: Create GitHub Actions CI/CD pipeline with auto-detected project type. Use when setting up CI/CD.
user-invocable: true
argument-hint: [workflow-name]
---

Create CI pipeline: $ARGUMENTS

## Pipeline Context (Auto-Detected)

- **Project Type**: !`grep -r "python\|node\|rust\|go" package.json pyproject.toml Cargo.toml go.mod 2>/dev/null | head -1 | grep -oE 'python|node|rust|go' || echo "Node.js"`
- **Node Version**: !`grep -r '"node"' package.json .nvmrc 2>/dev/null | head -1 | grep -oE '[0-9]+' || echo "20"`
- **Python Version**: !`grep -r "python_requires\|python" pyproject.toml 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+' || echo "3.11"`
- **Existing Workflows**: !`ls .github/workflows/*.yml 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Test Command**: !`grep -r '"test"' package.json 2>/dev/null | head -1 | grep -oE '"[^"]*test[^"]*"' || echo '"npm test"'`
- **Build Command**: !`grep -r '"build"' package.json 2>/dev/null | head -1 | grep -oE '"[^"]*build[^"]*"' || echo '"npm run build"'`
- **Has package.json**: !`test -f package.json && echo "Yes" || echo "No"`
- **Has pyproject.toml**: !`test -f pyproject.toml && echo "Yes" || echo "No"`

## Your Task

Based on the detected context above, create a GitHub Actions workflow file at `.github/workflows/$ARGUMENTS.yml`.

Use the detected values to fill in the template below.

## CI/CD Pipeline Template (Node.js)

Use this template if **Project Type** is Node.js:

```yaml
name: $ARGUMENTS

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '${DETECTED_NODE_VERSION}'  # Use detected value above

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: ${DETECTED_TEST_COMMAND}  # Use detected test command above

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: ${DETECTED_BUILD_COMMAND}  # Use detected build command above
```

## CI/CD Pipeline Template (Python)

Use this template if **Project Type** is Python:

```yaml
name: $ARGUMENTS

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  PYTHON_VERSION: '${DETECTED_PYTHON_VERSION}'  # Use detected value above

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'

      - run: pip install -e ".[dev]"
      - run: pytest

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - run: pip install build
      - run: python -m build
```

## Usage

1. Review detected project type and versions above
2. Choose the appropriate template (Node.js or Python)
3. Replace `${DETECTED_*}` placeholders with detected values
4. Save to: `.github/workflows/$ARGUMENTS.yml`
5. Customize jobs for your needs
