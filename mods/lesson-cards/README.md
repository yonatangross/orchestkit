# lesson-cards

Displays lesson hint cards when tool calls match known patterns. Advisory only: a lesson never blocks a tool call (operator word 2026-10-21). The classic hq-ext `pretool-lesson-guard` is advisory too as of Yonatan-HQ/hq-ext-plugin#2449.

## Minimum CC version

Requires Claude Code 2.1.266 or later (first measured `classic.*` binary).

## Installation

1. Copy this folder to your project:
   ```bash
   cp -r mods/lesson-cards/ /path/to/your/project/mods/
   ```

2. On CC 2.1.266 through 2.1.286, enable function hooks in your shell profile
   or personal settings (not needed on 2.1.287+, where Mods are public):
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
- **Advisory, never blocking**: every match, block or warn severity, in every session (interactive, headless, any folder), draws the card and adds the lesson to the model context, then the call runs. lesson-cards never returns `{ deny }` and never opens a dialog. A block-severity pattern's context starts with `BLOCK-SEVERITY LESSON (advisory, not enforced): ` and keeps the lesson text and its Fix (including any ALLOWED-FORM line). When several patterns match an Edit or Write, a block match always ranks before a warn
- **Model context**: Adds matched lessons to the tool result context for the model to read
- **Additive**: the only effect on a call is the card and one extra `context` line. `ORK_LESSON_CARDS_CARD_ONLY_DIRS` (card-only lanes, 1.1.x) is no longer read: every session now behaves the way a card-only lane did

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

- `$.env.get` - Read `HOME`
- `$.fs.read` - Read lesson-patterns.json and lessons.md files
- `$.fs.list` - List hq-ext versions and floor directories
- `$.fs.exists` - Skip floor dirs with no lessons.md before any stat (no logged ENOENT per dir); absent on older engines, then stat-only
- `$.fs.stat` - Get file mtimes for sorting
- `$.ui.notice` - Show hint during permission dialog (if open)
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

2. On 2.1.266 to 2.1.286, unset the flag (inert on 2.1.287+):
   ```bash
   unset CLAUDE_CODE_ENABLE_FUNCTION_HOOKS
   ```

No state persisted except the in-memory match map, which is safe to drop.

## Commands

- `/lessons` - Reload corpus from hq-ext cache and lessons.md files

## Seeing a card in a live session

lesson-cards matches before the tool runs, so its card and context come before the classic guards inside `next(e)`. The quoted parts of a command are blanked before matching (shell-faithful), so a pattern inside an `echo "..."` string matches nothing; it has to be in the command itself. Patterns with a `repos` list (for example the `platform` ones) match only in that repo.

Harmless ways to see each surface (measured on CC 2.1.282, 2026-09-25):

- **Warn card**: `echo pgvector/pgvector:pg16` matches `pgvector-pg-version-mismatch` and draws a yellow card under the row.
- **Block card**: `git ls-files mods | grep register` matches `git-ls-files-quotepath-blind` and draws a red card; the call still runs, and the model reads the lesson marked advisory.

Other ways that also work:

1. **Floor lessons bullet**: Run an indexed command from ~/.claude/hq/floor-*/lessons.md, such as vm_stat. The hq-ext guard does not inspect floor bullets, allowing the command to run and display an advisory hint card under the tool row.
2. **Warn pattern**: Run a command matching a warn-severity pattern, such as alembic stamp head. The hq-ext guard exits 0 for warn-severity patterns, allowing the command to proceed while lesson-cards renders the card and notice.

## Acceptance checklist

- [ ] Pattern matching works for Bash commands
- [ ] Pattern matching works for Edit/Write operations
- [ ] Cards render under ToolUse rows
- [ ] Context is added to tool results
- [ ] `/lessons` command reloads corpus
- [ ] No lesson ever denies a call or opens a dialog, block severity included
- [ ] Corpus load under 50ms
- [ ] No I/O on hot path

## Risk

Low. Advisory only; the only behavioral change is one extra `context` line per matched call.
