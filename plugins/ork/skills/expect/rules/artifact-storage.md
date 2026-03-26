---
title: Artifact storage conventions for reports, screenshots, and fingerprints
impact: MEDIUM
impactDescription: "Inconsistent artifact paths make it hard to find test results and debug failures"
tags: artifacts, screenshots, reports, storage
---

## Artifact Storage

All expect artifacts live under `.expect/` with a consistent directory structure.

**Incorrect — scattered artifact locations:**
```bash
# Wrong: artifacts in random locations
/tmp/test-screenshot-1.png
~/Desktop/test-report.json
./screenshots/login-fail.png
```

**Correct — structured under .expect/:**
```
.expect/
├── config.yaml              # Project config (committed)
├── flows/                   # Saved test flows (committed)
│   ├── login.yaml
│   └── checkout.yaml
├── fingerprints.json         # SHA-256 hashes (gitignored)
├── reports/                  # Test run reports (gitignored)
│   ├── 2026-03-26T16-30-00.json
│   └── 2026-03-26T17-00-00.json
├── screenshots/              # Failure screenshots (gitignored)
│   ├── dashboard-step2-fail.png
│   └── login-step5-fail.png
└── snapshots/                # ARIA snapshots (committed)
    ├── login.json
    └── dashboard.json
```

**Key rules:**
- Reports use ISO timestamp filenames (UTC, replace `:` with `-`)
- Keep last N reports (default 10, configurable in config.yaml)
- Screenshots only on failure (`on_fail` default)
- ARIA snapshots and flows are committed (they're baseline references)
- Fingerprints, reports, and screenshots are gitignored (ephemeral)
