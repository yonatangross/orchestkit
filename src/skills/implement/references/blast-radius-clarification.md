# Blast-Radius Clarification (ask "what" before "how")

Before Phase 1, find the unknowns whose answers would **change the architecture** and
resolve them in blast-radius order — biggest consequence first. The cheapest place to
settle an ambiguity is before code exists; the same ambiguity found mid-build is a
rework, and found post-merge is an incident. This is "ask what before you ask how" made
into a step.

## When to run

- Runs as **Step 0b**, after context discovery / worktree (Step 0a) and BEFORE Task
  Management + Phase 1.
- **Skip** in `low` effort, or when the feature is small and unambiguous (< ~3 files, no
  schema / auth / contract surface).
- **Grep the codebase first** — never ask a question the code already answers.

## Blast-radius order (ask highest first; skip any tier already unambiguous)

| # | Tier | Why it's high blast-radius | Example question |
|---|------|----------------------------|------------------|
| 1 | Data model / schema / migration | An answer reshapes every downstream layer | "New table, or a column on `<Y>`? Nullable? Backfill?" |
| 2 | Auth / security / trust boundary | Sets who can act + the threat model | "Who calls this — portal user, admin, service token?" |
| 3 | API contract / breaking change | Ripples to every consumer | "Change an existing response shape, or add a new endpoint?" |
| 4 | Data volume / performance / scale | Sets the algorithm + index strategy | "Expected cardinality / hot path / concurrency?" |
| 5 | UX / copy / cosmetics | Cheap to change later — ask LAST | "Inline panel or modal?" |

## Protocol

1. One question at a time via `AskUserQuestion`, **highest blast-radius first**.
2. Ask ONLY the genuinely ambiguous, high-blast-radius items — not the obvious ones. Stop
   as soon as the remaining unknowns are low-blast-radius / cosmetic. **Cap ~5.**
3. Each answer becomes a row in the Decisions table.
4. Write the table to `.claude/chain/decisions.json` and surface it in the **PR body**
   (Phase 9 documentation) so the "why" lands where reviewers see it.
5. Feed the schema / auth / contract answers into **Phase 4 (Architecture)** as
   constraints — they are inputs to the architecture agents, not afterthoughts.

## Decisions table (written to state + PR body)

```markdown
## Decisions (blast-radius clarification)
| # | Question | Decision | Blast radius | Rationale |
|---|----------|----------|--------------|-----------|
| 1 | New table or column on projects? | new `project_metric` table | schema | needs its own lifecycle + FK |
| 2 | Who can write it? | admin + service token only | auth | portal users are read-only here |
```

## Why (the failure classes this closes)

- **"Start solo → 3 interrupts"** — the operator gets pulled in three separate times
  mid-build for questions a two-minute up-front interview would have batched.
- **Premature architecture / root-cause commitment** — building on an unstated schema or
  auth assumption, then discovering it was wrong after the architecture is set.

## Anti-patterns

- Asking cosmetic questions first — spends the user's attention on the cheapest unknowns.
- Interrogating the obvious, or asking what the codebase already answers (grep first).
- Asking everything → analysis paralysis. Cap and stop at low blast-radius.
- Proceeding on an ambiguous **schema or auth** question — the exact rework this step
  exists to prevent. If a tier-1/2 unknown is unresolved, do NOT start Phase 1.
