---
tags: [commit, fire, hard, atomic]
max_turns: 6
timeout_seconds: 180
runs: 3
allowed_tools: [Skill]
---

Use the commit skill. It is all done and tested, make it one commit please.

Staged changes:
- `src/auth/token.ts`: fixes the refresh-token expiry check. It was off by one minute, so a token stayed valid a minute too long.
- `src/auth/token.test.ts`: a regression test for that.
- `src/search/filters.ts`: new date-range filter for the search page.
- `src/search/filters.test.ts`: tests for the new filter.
- `README.md`: fixed a typo in the install section.
- `package.json` and `package-lock.json`: bumped the dev dependency `eslint` from 9.8.0 to 9.12.0.

I cannot run git here, so give me the exact commit message or messages you would use.
