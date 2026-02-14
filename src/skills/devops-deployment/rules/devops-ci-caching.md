---
title: "CI/CD: Pipeline Caching"
category: cicd
impact: HIGH
impactDescription: "Every CI run re-downloads and installs all dependencies from scratch — wasting 2-3 minutes per run and burning through CI minutes budget"
tags: [cicd, github-actions, caching, performance]
---

## CI/CD: Pipeline Caching

Cache dependencies in CI pipelines using lockfile-based cache keys. Proper caching reduces dependency installation from 2-3 minutes to 10-20 seconds (~85% time savings).

**Incorrect:**
```yaml
# No caching: re-downloads everything on every run
steps:
  - uses: actions/checkout@v3
  - run: npm install
  - run: npm test
```

```yaml
# Bad cache key: no lockfile hash, stale deps served indefinitely
- uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-modules
```

**Correct:**
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

- name: Install Dependencies
  run: npm ci

- name: Run Tests
  run: npm test
```

```yaml
# Python example with Poetry
- name: Cache Poetry Dependencies
  uses: actions/cache@v3
  with:
    path: ~/.cache/pypoetry
    key: ${{ runner.os }}-poetry-${{ hashFiles('backend/poetry.lock') }}

- name: Install Dependencies
  run: poetry install
```

**Key rules:**
- Always include `hashFiles()` of the lockfile in the cache key so caches invalidate when dependencies change
- Use `restore-keys` as a fallback prefix to get a partial cache hit when the exact key misses
- Cache the package manager cache directory (`~/.npm`, `~/.cache/pypoetry`), not just `node_modules`
- Use `npm ci` (not `npm install`) after cache restore for reproducible installs
- Cache multiple dependency directories in a single step when possible (npm + pip + venv)
- Set artifact retention policies (`retention-days: 7`) to prevent storage bloat

Reference: `references/ci-cd-pipelines.md` (lines 23-68)
