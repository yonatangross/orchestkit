---
title: Pass build and test gates before release to prevent shipping broken artifacts
impact: CRITICAL
impactDescription: "Shipping a broken build or failing security tests produces a broken release that requires an emergency hotfix"
tags: build, test, security, typecheck, release-gate
---

## Build and Test Gates

All four checks must pass in order. Stop on first failure and suggest a fix before continuing.

### 1. Build

```bash
npm run build
```

- Pass: `plugins/` is populated, no errors printed
- Fail: check edits in `src/`, re-run. If interrupted mid-build, `plugins/` is left empty — re-run before retrying

### 2. Full Test Suite

```bash
npm test
```

- Pass: all test suites green
- Fail: fix failing tests; do not proceed

### 3. Security Tests

```bash
npm run test:security
```

**MUST pass. No exceptions.** Security failures block the release unconditionally.

### 4. TypeScript

```bash
npm run typecheck
```

- Pass: zero type errors in hooks TypeScript
- Fail: fix errors in `src/hooks/src/` then rebuild with `cd src/hooks && npm run build`

**Incorrect:**

```bash
# Running tests before building — tests validate stale plugins/
npm test
npm run build
```

**Correct:**

```bash
# Build first, then test against fresh output
npm run build
npm test
npm run test:security
npm run typecheck
```

**Key rules:**
- Run in order: build → test → security → typecheck
- Any single failure stops the checklist
- Do not skip security tests under any circumstance
- A failed build leaves `plugins/` empty — re-run `npm run build` before retrying count validation
