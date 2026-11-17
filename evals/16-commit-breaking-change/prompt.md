---
tags: [commit, fire, hard, breaking]
max_turns: 6
timeout_seconds: 180
runs: 3
allowed_tools: [Skill]
---

Use the commit skill for these staged changes.

- `src/parser/index.ts`: `parse(input, opts?)` is now `parse(opts)`. The positional `input` argument is gone and `opts.input` is required. The deprecated `parseSync` export is removed. The package is published to npm and other projects call both functions.
- `src/parser/index.test.ts`: updated for the new signature.
- `docs/api.md`: updated examples.

I cannot run git here, so just give me the exact commit message you would use.
