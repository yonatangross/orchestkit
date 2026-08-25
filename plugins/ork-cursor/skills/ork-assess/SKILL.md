---
name: ork-assess
description: Assess a code change, design, architecture, workflow, or competing options against explicit criteria and evidence. Use when a request asks to assess, rate, compare, identify trade-offs, evaluate readiness, or decide whether an approach is good enough. Do not use for a full pull-request review or to implement a chosen solution.
---

# Ork Assess (Cursor)

State the decision, scope, and criteria before scoring. Choose criteria appropriate to the task—normally correctness, maintainability, security, operability, testability, cost, and reversibility—and omit criteria that have no bearing on the decision.

Collect evidence from the code, repository guidance, tests, or authoritative documentation. For a third-party library, framework, or service, the authoritative source is the context7 MCP server if present: call `resolve-library-id`, then `query-docs`. Separate facts, assumptions, and unknowns. Do not invent numeric precision: use a score only when it makes the comparison clearer, and attach the evidence and confidence to it.

For high-impact choices, ask an independent read-only reviewer via Cursor's `Task` tool (`subagent_type: generalPurpose` or `explore`) to challenge the leading conclusion. Do not spawn Codex `ork_reviewer` roles. End with a recommendation, conditions for approval, and concrete follow-up actions. Do not edit the target.
