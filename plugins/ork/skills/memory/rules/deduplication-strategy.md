---
title: "Deduplication Strategy"
impact: medium
---

# Deduplication Strategy

When loading or searching memories, prevent duplicate context injection.

## Rules

1. **Edit over Write** -- When updating `.claude/memory/MEMORY.md` or project memory files, prefer `Edit` over `Write` to preserve existing content and avoid accidental overwrites.

2. **Anchor-based insertion** -- Always verify the target section header exists before inserting:
   - `## Recent Decisions`
   - `## Patterns`
   - `## Preferences`
   - `## Detailed Notes`

3. **Surgical edits** -- Use `Edit(file_path, old_string=anchor_line, new_string=anchor_line + "\n" + new_content)` to append under a section header without overwriting the rest.

4. **Verify after edit** -- Always `Read(file_path)` after editing to confirm the edit applied correctly.

## Why Edit Over Write

| Approach | Risk | Permission |
|----------|------|-----------|
| Write (overwrite) | Loses existing content if template incomplete | Requires approval |
| Edit (surgical) | Only modifies target section | Often auto-approved |

## Hook Exception

The `memory-writer.ts` hook uses Node.js `writeFileSync` -- this is correct for hooks context where full file control is needed. The Edit pattern above is for agent-side SKILL.md operations.
