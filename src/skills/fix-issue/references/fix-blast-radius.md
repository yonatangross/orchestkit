# Clarify the Fix's Blast-Radius (before you write it)

RCA (Phase 4) tells you the *cause*. Before Fix Design (Phase 5), resolve the *fix's* unknowns in
blast-radius order — the cheapest place to catch "this needs a migration" or "this is a symptom,
not the root" is before code. Directly serves the two Critical Constraints: **fix root causes, not
symptoms** and **minimal, focused changes**.

## When to run

- Between Phase 4 (RCA confirmed) and Phase 5 (Fix Design).
- **Skip** for **Hotfix** / `low` effort, or when the fix is obviously one-line and local.
- **Grep first** — never ask what the code or issue already answers.

## Two checks, in order

**1. Root cause vs symptom (one question):** *"Does this fix address the confirmed root cause, or a
symptom of it?"* If symptom → widen scope or re-open RCA. The `# type: ignore` / image-retag /
package-downgrade class of patch is a **symptom** fix — flag it and prefer the real fix.

**2. Blast-radius of the fix** (ordered `AskUserQuestion`, highest first, skip the unambiguous, cap ~4):

| # | Tier | Question |
|---|------|----------|
| 1 | Schema / migration | "Does the fix need a schema change or data migration?" |
| 2 | Auth / security | "Does it change who can do what, or a trust boundary?" |
| 3 | Public contract / breaking | "Does it alter an existing API/response shape a consumer depends on?" |
| 4 | Data backfill / scale | "Does it need a backfill, or change a hot-path's cost?" |
| — | Cosmetic | (don't ask — just do it) |

## Output

Append to `.claude/chain/decisions.json` and the **PR body**:

```markdown
## Fix decisions (blast-radius)
| # | Question | Decision | Blast radius | Rationale |
|---|----------|----------|--------------|-----------|
| 1 | Root cause or symptom? | root cause (cache TTL never expired) | — | RCA-confirmed |
| 2 | Migration? | no — config-only | schema | value moved to env, no DDL |
```

The schema / auth / contract answers become constraints for Phase 5 Fix Design **and** the regression
test (Critical Constraint: write the failing test BEFORE the fix).

## Why (failure classes this closes)

- **Symptom-patching** — shipping a `# type: ignore` / retag / downgrade when a root fix exists.
- **Silent scope creep** — a "small fix" that quietly needed a migration or broke a consumer,
  discovered post-merge.

## Anti-patterns

- Asking cosmetic questions (just make the change).
- Asking *before* RCA confirms the cause — you'd be clarifying the wrong fix.
- Proceeding on an unresolved schema / contract question — the rework this step exists to prevent.
