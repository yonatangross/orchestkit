---
tags: [lane-0927, ci-debug, fire]
max_turns: 6
timeout_seconds: 240
runs: 3
allowed_tools: [Skill]
---

PR #822 CI is red. Here is the failing job log excerpt from the `install` step:

```
Run pnpm install --frozen-lockfile
Scope: all 14 workspace projects
 ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with <ROOT>/typescript/sdk/package.json
Note that in CI environments this setting is true by default. If you still need to run install in such cases, use "pnpm install --no-frozen-lockfile"
Error: Process completed with exit code 1.
```

Why is it failing and what should I do?
