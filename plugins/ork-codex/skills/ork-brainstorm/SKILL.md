---
name: ork-brainstorm
description: Compare plausible implementation, architecture, product, or operational approaches before committing to one. Use when a request asks to brainstorm, think through options, choose an approach, evaluate trade-offs, or resolve significant uncertainty before implementation. Do not use for an already specified mechanical change.
---

# Ork Brainstorm

Frame the outcome, constraints, non-goals, and decision deadline. Inspect the relevant repository and existing decisions before proposing options.

Generate two to four materially different approaches. For each, state the implementation shape, benefits, costs, risks, dependencies, reversibility, and the evidence that would disprove it. Do not pad the list with cosmetic variations.

Use one context for a normal decision. Delegate only when there are at least three independent unknowns; give each subagent one bounded question and synthesize its evidence. Prefer the installed `ork_explorer` role when available, otherwise use Codex's built-in `explorer` role.

End with a recommendation, the decision rationale, unresolved assumptions, and the smallest next action. Do not edit files until the user asks to implement the chosen approach.
