---
name: ork-verify
description: Verify that existing work is ready to merge, release, or hand off using an explicit evidence contract. Use when a request asks to verify, validate, prove, check readiness, run the relevant tests, or distinguish a claimed result from an observed one. Do not use to write missing tests or fix failures.
---

# Ork Verify

Write the evidence contract first: target, required checks, environment, success condition, and budget. Read the repository instructions for canonical commands and run the narrowest relevant checks before broad suites.

Report each command and its summary exactly. A passing test or check proves only the path it executed; verify that every required signal actually ran. Treat missing logs, unavailable external services, and skipped gates as unknown—not as success.

For material changes, use a separate `ork_verifier` role when installed (or a fresh Codex reviewer) with the original task and final artifacts, not the implementer's reasoning. Return a binary verdict—PASS, FAIL, or BLOCKED—with evidence, gaps, and the next action. Do not change source files or tests.
