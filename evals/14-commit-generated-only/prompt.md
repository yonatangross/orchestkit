---
tags: [commit, fire, hard, generated]
max_turns: 6
timeout_seconds: 180
runs: 3
allowed_tools: [Skill]
---

Use the commit skill. Commit what is staged, a one-line message is fine.

Staged paths, from `git status`:
- `dist/app.min.js` (rebuilt bundle, 212 KB)
- `dist/app.min.js.map`
- `coverage/lcov.info`
- `.next/cache/webpack/client-production/0.pack`
- `package-lock.json`: 1,840 lines changed. `package.json` is not changed; the lockfile moved after I ran `npm install` on a different npm version.

I cannot run git here, so just give me the exact commit message you would use.
