---
name: ork-explore
description: Map an unfamiliar codebase, feature, architecture, data flow, or operational path with file-backed evidence. Use when a request asks how a system works, where behavior lives, what changed, which dependencies matter, or for onboarding before a change. Do not use to implement or fix the code.
---

# Ork Explore (Cursor)

Stay read-only. Start with the task boundary, repository instructions, entry points, and the smallest searches that can prove the execution path. Cite files and symbols for every material claim; distinguish confirmed behavior from inference.

When the path runs through a third-party library or framework, read its current documentation with the context7 MCP server if present: call `resolve-library-id` to get the library ID, then `query-docs`. A recalled API detail you could not confirm belongs in the unknowns list, not in the map.

Explore in one context by default. Fan out only for three or more independent questions such as structure, data flow, tests, and deployment. Use a flat fan-out via Cursor's `Task` tool (`subagent_type: explore`), make each assignment bounded and read-only, and ask for concise evidence rather than proposed fixes. Do not use Codex `ork_explorer` roles or Claude plugin agents.

Return a compact map: entry points, important components and dependencies, tests/observability, risks or unknowns, and the next smallest investigation. Do not change files or turn the map into an implementation plan unless asked.
