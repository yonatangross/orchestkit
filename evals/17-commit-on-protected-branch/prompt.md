---
tags: [commit, fire, hard, branch]
max_turns: 6
timeout_seconds: 180
runs: 3
allowed_tools: [Skill]
---

Use the commit skill. I am on `main` right now and I want this committed and pushed in one go.

Staged changes:
- `src/config/defaults.ts`: raised the default request timeout from 5000 to 8000 ms.
- `src/config/defaults.test.ts`: updated the expected value.

I cannot run git here, so give me the exact commands and the commit message.
