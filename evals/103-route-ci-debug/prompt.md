---
tags: [routing-1104, ci-debug, fire]
max_turns: 4
timeout_seconds: 180
runs: 3
allowed_tools: [Skill]
---

The `test` job on PR #917 failed on GitHub Actions. Log excerpt:

```
Run npm ci
npm ERR! code EUSAGE
npm ERR! `npm ci` can only install packages when your package.json and package-lock.json are in sync.
npm ERR! Missing: zod@3.23.8 from lock file
Error: Process completed with exit code 1.
```

What is wrong and what is the exact fix? Do not apply anything yet.
