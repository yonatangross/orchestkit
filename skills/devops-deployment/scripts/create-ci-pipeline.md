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

## CI/CD Pipeline Template

```yaml
name: $ARGUMENTS

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
!`grep -q "node" package.json 2>/dev/null && echo "  NODE_VERSION: '!`grep -r \"node\" package.json .nvmrc 2>/dev/null | head -1 | grep -oE '[0-9]+' || echo \"20\"`'" || echo "  # Add environment variables"`
!`grep -q "python" pyproject.toml 2>/dev/null && echo "  PYTHON_VERSION: '!`grep -r \"python_requires\" pyproject.toml 2>/dev/null | grep -oE '[0-9]+\\.[0-9]+' || echo \"3.11\"`'" || echo "  # Add Python version if needed"`

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
!`grep -q "node" package.json 2>/dev/null && echo "      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - run: npm ci
      - run: !`grep -r '\"test\"' package.json 2>/dev/null | head -1 | grep -oE '\"[^\"]*test[^\"]*\"' | tr -d '\"' || echo \"npm test\"`" || echo "      # Add test steps for your project type"`

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - run: !`grep -r '\"build\"' package.json 2>/dev/null | head -1 | grep -oE '\"[^\"]*build[^\"]*\"' | tr -d '\"' || echo \"npm run build\"`
```

## Usage

1. Review detected project type above
2. Save to: `.github/workflows/$ARGUMENTS.yml`
3. Customize jobs for your needs
