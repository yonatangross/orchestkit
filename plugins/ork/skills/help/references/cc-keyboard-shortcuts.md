# CC Keyboard Shortcuts

## Input

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Shift+Down` | Multi-line input | Type across multiple lines before sending (CC 2.1.47+) |
| `Enter` | Send message | Submits the current input |
| `Up Arrow` | Previous message | Navigate input history |
| `Tab` | Autocomplete | Complete file paths, skill names |
| `Esc` | Cancel | Dismiss autocomplete or cancel current edit |

## Output Navigation

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Ctrl+F` | Find in output | Search through all output in the session (CC 2.1.47+) |
| `Ctrl+C` | Cancel operation | Interrupt the current tool execution or generation |

## Session Control

| Shortcut | Action | Notes |
|----------|--------|-------|
| `/exit` | Exit session | Gracefully close the session (triggers Stop hooks) |
| `/clear` | Clear screen | Clear terminal output |
| `/compact` | Compact context | Compress conversation history to free context space |
| `Ctrl+C` (twice) | Force exit | Exit immediately without cleanup |

## CC 2.1.47 New Features

- **Find in output** (`Ctrl+F`): Search through all assistant output, tool results, and error messages in the current session. Works like browser find.
- **Multi-line input** (`Shift+Down`): Enter multi-line messages without triggering send. Useful for pasting code blocks, writing detailed prompts, or composing multi-paragraph instructions.
