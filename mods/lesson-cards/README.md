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
- **Hint cards**: Displays a card under the tool row with lesson id, message, and fix suggestion
- **Model context**: Adds matched lessons to the tool result context for the model to read
- **Additive**: During pilot, the classic `pretool-lesson-guard --strict` keeps its 12 block-severity denies unchanged

## Hook footprint

| Event | Matcher | Notes |
|-------|---------|-------|
| `session.start` | `{}` | Load corpus (patterns + bullets) |
| `tool.call` | `{ tool: 'Bash' }` | Match command, return context |
| `tool.call` | `{ tool: 'Edit' }` | Match file/content, return context |
| `tool.call` | `{ tool: 'Write' }` | Match file/content, return context |
| `ui.render` | `{ component: 'ToolUse' }` | Append card under tool row |
| `command.register` | `{}` | Handle `/lessons` command |

### Calls

- `$.fs.read` - Read lesson-patterns.json and lessons.md files
- `$.fs.list` - List hq-ext versions and floor directories
- `$.fs.stat` - Get file mtimes for sorting
- `$.ui.notice` - Show hint during permission dialog (if open)
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
