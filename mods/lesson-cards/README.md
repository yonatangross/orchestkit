# lesson-cards

Displays lesson hint cards when tool calls match known patterns. Additive surface during pilot; the classic `--strict` guard keeps its 12 block-severity denies.

## Minimum CC version

Requires Claude Code 2.1.266 or later (first measured `classic.*` binary).

## Installation

1. Copy this folder to your project:
   ```bash
   cp -r mods/lesson-cards/ /path/to/your/project/mods/
   ```

2. Enable function hooks in your shell profile or personal settings:
   ```bash
   export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
   ```

   Or in `~/.claude/settings.json`:
   ```json
   {
     "env": {
       "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"
     }
   }
   ```

3. Start Claude Code with the plugin directory:
   ```bash
   claude --plugin-dir mods/
   ```

## Features

- **Pattern matching**: Matches Bash commands and Edit/Write operations against known lesson patterns from hq-ext
- **Lessons.md indexing**: Parses bullet points from `~/.claude/hq/floor-*/lessons.md` and indexes by command tokens
- **Hint cards**: Displays a bordered card under the tool row with lesson id, severity, message, and fix suggestion (red for block, yellow for warn, gray for a lessons.md note)
- **Proceed anyway?**: A block-severity pattern opens the Claude Code question dialog (`$.ui.ask`) before the call runs. Only an explicit `Proceed anyway` runs the call. `Cancel`, Escape, a typed free-text answer, and no dialog at all (headless `-p`) refuse it with `{ deny }`, so it never runs. The card is the only place the lesson text is drawn. The question is the lesson id and `Proceed anyway?` only. A user cancel (Cancel or Escape) is `Cancelled: by you; not run. [lesson:<id>]` with no Fix (a cancel is not a failure). The `Cancelled: ` head is ours so Claude Code 2.1.283 leaves the deny alone instead of gluing `Error: `; the rest drops the echo so Cancelled is said once. Other refuses (no dialog, no exact Proceed anyway) still carry a short Fix so the model keeps the alternative. When several patterns match an Edit or Write, a block match always ranks before a warn
- **Model context**: Adds matched lessons to the tool result context for the model to read
- **Additive**: During pilot, the classic `pretool-lesson-guard --strict` keeps its 12 block-severity denies unchanged

## Hook footprint

| Event | Matcher | Notes |
|-------|---------|-------|
| `session.start` | `{}` | Load corpus (patterns + bullets) |
| `tool.call` | `{ tool: 'Bash' }` | Match command, return context |
| `tool.call` | `{ tool: 'Edit' }` | Match file/content, return context |
| `tool.call` | `{ tool: 'Write' }` | Match file/content, return context |
| `ui.render` | `{ component: 'ToolUse' }` | Wrap the row and the card in a column Box built from `$.ui.resolve(e)` |
| `command.register` | `{}` | Handle `/lessons` command |

### Calls

- `$.fs.read` - Read lesson-patterns.json and lessons.md files
- `$.fs.list` - List hq-ext versions and floor directories
- `$.fs.stat` - Get file mtimes for sorting
- `$.ui.notice` - Show hint during permission dialog (if open)
- `$.ui.ask` - Ask "Proceed anyway?" before a block-severity call runs
- `$.ui.resolve` - The element constructors (`Box`, `Text`) the card is built from. On CC 2.1.282 a render hook may only return nodes built by these; a plain `{ type: 'Box' }` object draws nothing, and the tree `next(e)` returns is an opaque engine node that must be wrapped, never mutated
- `$.ui.invalidate` - Refresh UI after `/lessons reload`

### Negative pin (what it does NOT do)

- No `process.run`
- No `http.fetch`
- No I/O inside `tool.call` (all reads happen at session.start)

## Rollback

1. Remove from plugin directory or disable:
   ```bash
   rm -rf mods/lesson-cards
   # or
   claude plugin disable lesson-cards
   ```

2. Unset the flag:
   ```bash
   unset CLAUDE_CODE_ENABLE_FUNCTION_HOOKS
   ```

No state persisted except the in-memory match map, which is safe to drop.

## Commands

- `/lessons` - Reload corpus from hq-ext cache and lessons.md files

## Seeing a card in a live session

lesson-cards matches before the tool runs, so its card and its question come before the classic guards inside `next(e)`. With hq-ext installed, a block pattern the user answers `Proceed anyway` still meets pretool-lesson-guard, which keeps its deny. The quoted parts of a command are blanked before matching (shell-faithful), so a pattern inside an `echo "..."` string matches nothing; it has to be in the command itself. Patterns with a `repos` list (for example the `platform` ones) match only in that repo.

Harmless ways to see each surface (measured on CC 2.1.282, 2026-09-25):

- **Warn card**: `echo pgvector/pgvector:pg16` matches `pgvector-pg-version-mismatch` and draws a yellow card under the row.
- **Block card and question**: `git ls-files mods | grep register` matches `git-ls-files-quotepath-blind`, draws a red card and asks `Proceed anyway?`; `Cancel` denies the call.

Other ways that also work:

1. **Floor lessons bullet**: Run an indexed command from ~/.claude/hq/floor-*/lessons.md, such as vm_stat. The hq-ext guard does not inspect floor bullets, allowing the command to run and display an advisory hint card under the tool row.
2. **Warn pattern**: Run a command matching a warn-severity pattern, such as alembic stamp head. The hq-ext guard exits 0 for warn-severity patterns, allowing the command to proceed while lesson-cards renders the card and notice.

## Acceptance checklist

- [ ] Pattern matching works for Bash commands
- [ ] Pattern matching works for Edit/Write operations
- [ ] Cards render under ToolUse rows
- [ ] Context is added to tool results
- [ ] `/lessons` command reloads corpus
- [ ] Classic guard still denies block-severity patterns
- [ ] Corpus load under 50ms
- [ ] No I/O on hot path

## Risk

Low. Purely additive during pilot; the only behavioral change is one extra `context` line per matched call.
