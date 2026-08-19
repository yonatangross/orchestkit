---
name: ork-brainstorm
description: Compare plausible implementation, architecture, product, or operational approaches before committing to one. Use when a request asks to brainstorm, think through options, choose an approach, evaluate trade-offs, or resolve significant uncertainty before implementation. Do not use for an already specified mechanical change.
---

# Ork Brainstorm

Frame the outcome, constraints, non-goals, and decision deadline. Inspect the relevant repository and existing decisions before proposing options.

Generate two to four materially different approaches. For each, state the implementation shape, benefits, costs, risks, dependencies, reversibility, and the evidence that would disprove it. Do not pad the list with cosmetic variations.

When an option depends on what a library, framework, or service can actually do today, confirm it with the context7 MCP server (`resolve-library-id`, then `query-docs`) before scoring it. An option built on a capability you only remember is an assumption, and it belongs in the unresolved list.

Use one context for a normal decision. Delegate only when there are at least three independent unknowns; give each subagent one bounded question and synthesize its evidence. Prefer the installed `ork_explorer` role when available, otherwise use Codex's built-in `explorer` role.

End with a recommendation, the decision rationale, unresolved assumptions, and the smallest next action. Do not edit files until the user asks to implement the chosen approach.
