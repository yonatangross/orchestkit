# Effort Ladder: when implement runs at low

Source: claude.dev, "Spending your effort". The feature loop it describes is: interview for a spec, implement on low, review, then verify and test on high. Low effort is cheap and fast when the thinking is already done; the expensive edge-case hunting belongs to verification.

## The ladder

| Rung | Skill | Effort | Where it is set |
|------|-------|--------|-----------------|
| 1. Spec | `brainstorm`, `implement` Step 0 interview (`references/interview-mode.md`) | session (medium on Opus 5.5) | session |
| 2. Implement | `implement` | **low** when the spec is complete, otherwise **medium** | `/effort` before invoking, see below |
| 3. Review | `review-pr` | reviewers at high | `code-quality-reviewer` and `security-auditor` agent frontmatter |
| 4. Verify and test | `verify`, `cover` | **high** | `effort: high` in both SKILL.md frontmatters |

## Low is right when ALL of these hold

- Acceptance criteria are written and each one is checkable (a test, a command, a visible state).
- The files or modules to change are named, or follow one existing pattern in the repo.
- The blast-radius step has nothing left to ask: no open schema, migration, auth or API contract question (`references/blast-radius-clarification.md`).
- The work is mechanical: wire an existing pattern, port, rename, add a field end to end, extend a table of cases.
- Rung 4 will run after it, at high.

Typical low runs: a spec produced by `brainstorm` and approved, a `prd-to-goal` line, an issue with a checklist that names files, the second half of a migration whose first half set the pattern.

## Medium (the default) when ANY of these hold

- A design question is still open, or the spec says "figure out how".
- New module boundaries, a new dependency, or code the session has not read yet.
- The acceptance criteria are prose ("make it faster", "clean this up").

## High for implement itself

Only for edge-case-heavy implementation, where the edge cases have to be designed in rather than found later: concurrency and locking, security-sensitive paths, data migrations, money. Everything else spends its high effort on rung 4.

## How to apply it

`implement` deliberately has no `effort:` frontmatter. A skill-level key applies to every run of the skill (for a `context: fork` skill it sets the fork's effort), and most `implement` runs are not spec-complete. So the choice is per run:

```
/effort low        # only when every "low is right" condition holds
/ork:implement <the spec-complete feature>
/effort high       # or let verify and cover apply their own effort: high
/ork:verify
```

At low, Step 0 runs phases 1, 5 and 10 only, so the in-skill verification phases are skipped. That is why rung 4 is not optional after a low run: `verify` and `cover` carry `effort: high` in their own frontmatter and apply it whatever the session effort is.

`tests/skills/test-skill-effort-ladder.sh` pins this: verify and cover stay at high, and neither brainstorm nor implement gains a skill-level effort key without the test being edited.
