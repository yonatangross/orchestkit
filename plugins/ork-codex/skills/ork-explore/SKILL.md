---
name: ork-explore
description: Map an unfamiliar codebase, feature, architecture, data flow, or operational path with file-backed evidence. Use when a request asks how a system works, where behavior lives, what changed, which dependencies matter, or for onboarding before a change. Do not use to implement or fix the code.
---

# Ork Explore

Stay read-only. Start with the task boundary, repository instructions, entry points, and the smallest searches that can prove the execution path. Cite files and symbols for every material claim; distinguish confirmed behavior from inference.

Explore in one context by default. Fan out only for three or more independent questions such as structure, data flow, tests, and deployment. Use a flat fan-out, make each assignment bounded and read-only, and ask for concise evidence rather than proposed fixes. Prefer `ork_explorer` when installed; otherwise use Codex's built-in `explorer`.

Return a compact map: entry points, important components and dependencies, tests/observability, risks or unknowns, and the next smallest investigation. Do not change files or turn the map into an implementation plan unless asked.
