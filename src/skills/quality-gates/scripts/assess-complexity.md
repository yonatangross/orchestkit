---
name: assess-complexity
description: Assess task complexity with auto-analyzed codebase context. Use when evaluating task difficulty before starting work.
user-invocable: false
argument-hint: "[file-or-directory]"
---

Assess complexity for: $ARGUMENTS

## Codebase Context (Auto-Analyzed)

- **Current Directory**: !`pwd`
- **Project Root**: !`basename $(git rev-parse --show-toplevel 2>/dev/null) || echo "Unknown"`
- **Total Files**: !`find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Total LOC**: !`find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \) -exec awk 'END{print NR}' {} + 2>/dev/null | awk '{s+=$1} END{print s+0}'`
- **Test Files**: !`find . -type f \( -name "*test*.py" -o -name "*test*.ts" -o -name "*.spec.*" \) 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Recent Changes**: !`git log --oneline --since="1 week ago" 2>/dev/null | wc -l | tr -d ' ' || echo "0"`

## Your Task

Gather the per-target metrics, then score against the 1-5 table in `SKILL.md`
("Complexity Scoring"). Do not restate that table here.

- Files: `find "$ARGUMENTS" -type f | wc -l`
- Lines of code: `find "$ARGUMENTS" -type f \( -name "*.py" -o -name "*.ts" \) -exec awk 'END{print NR}' {} + | awk '{s+=$1} END{print s+0}'`
- Dependencies: `grep -r "import\|from" "$ARGUMENTS" | wc -l`
- Test files: `find "$ARGUMENTS" -name "*test*" | wc -l`
- Recent churn: `git log --oneline --since="1 week ago" -- "$ARGUMENTS"`

For the batch version of the same scan (files, LOC, tests, churn, dependency count in
one pass) run `scripts/analyze-codebase.sh "$ARGUMENTS"` instead.

> Line counts use `-exec awk 'END{print NR}'` rather than `xargs wc -l | tail -1`:
> xargs batches long file lists and `wc` emits one total per batch, so `tail -1`
> silently drops all but the last (measured 83% undercount on a 6k-file tree).
> See `src/skills/shared/rules/shell-count-correctness.md` and
> `references/ork-delta.md`.

## Output

Report the measured numbers, the assigned complexity level, and the gate decision:

- **Level 1-3**: proceed to the gate check in `SKILL.md` ("Gate Decision Flow").
- **Level 4-5**: BLOCKED until decomposed into Level 1-3 subtasks, then reassess each.

Complexity is `max(file_count, LOC, dependency_count, unknowns)` mapped onto the
`SKILL.md` table, not an average: one Level 5 axis makes the task Level 5.
