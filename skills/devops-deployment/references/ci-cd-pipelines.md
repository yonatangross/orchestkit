# CI/CD Pipelines

Continuous Integration and Continuous Deployment best practices.

## GitHub Actions (Recommended)

```yaml
name: Test & Deploy

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./deploy.sh
```

## Best Practices

1. **Fast feedback** - tests complete in < 5 min
2. **Fail fast** - stop on first failure
3. **Cache dependencies** - npm/pip cache
4. **Matrix testing** - multiple Node/Python versions
5. **Secrets management** - use GitHub Secrets
6. **Branch protection** - require passing tests

See `templates/github-actions-pipeline.yml` for complete examples.
