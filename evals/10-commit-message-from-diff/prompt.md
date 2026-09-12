---
max_turns: 6
timeout_seconds: 180
runs: 3
allowed_tools: [Skill]
---

I have these staged changes and I want a commit created for them. Use the commit skill.

Staged diff summary:
- `src/auth/session.ts`: the session cookie was being set without `SameSite`, so a
  cross-site POST could ride an existing session. Added `SameSite=Lax` and
  `Secure` to the cookie options.
- `src/auth/session.test.ts`: added two cases covering the new cookie attributes.

I cannot run git here, so just give me the exact commit message you would use.
