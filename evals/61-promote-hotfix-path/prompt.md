---
tags: [lane-0927, promote, fire]
max_turns: 6
timeout_seconds: 240
runs: 3
allowed_tools: [Skill]
---

Production login is down. I have a one-line fix on branch `fix/login-null-session`. Our flow is feature
PRs into `dev`, and `dev` gets promoted to `main` weekly. What is the right way to get this fix to
production now without breaking that flow? Short answer, steps only.
