# Session Replay

Parse and visualize CC session JSONL files to understand what happened in a session.

## Usage

- `/ork:analytics session latest` — most recent session
- `/ork:analytics session <partial-id>` — match by prefix (e.g., `08ed1436`)
- `/ork:analytics session <full-uuid>` — exact match

## Step 1: Locate the Session File

CC session logs live at `~/.claude/projects/{encoded-project-path}/`.

The encoded path replaces `/` with `-` in the project directory path.
Example: `/Users/foo/coding/bar` becomes `-Users-foo-coding-bar`

```bash
# Find project session dir
PROJECT_DIR=$(echo "$CLAUDE_PROJECT_DIR" | sed 's|/|-|g')
SESSION_DIR="$HOME/.claude/projects/$PROJECT_DIR"

# List recent sessions (newest first)
ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -5

# For "latest": use the first result
LATEST=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)
```

## Step 2: Resolve the Session Reference

- `latest` — find the most recently modified `.jsonl` file in the project directory
- Partial ID (e.g., `08ed1436`) — find file starting with that prefix
- Full UUID — exact match

## Step 3: Parse JSONL and Extract Timeline

Each line is a JSON object. Key extraction patterns:

```bash
# Count messages by role
jq -r '.message.role // empty' "$SESSION_FILE" | sort | uniq -c | sort -rn

# Extract tool calls with timestamps
jq -r 'select(.message.role == "assistant") | .message.content[]? | select(.type == "tool_use") | .name' "$SESSION_FILE" | sort | uniq -c | sort -rn

# Sum token usage
jq -s '[.[].message.usage // empty | {
  i: .input_tokens, o: .output_tokens,
  cr: .cache_read_input_tokens, cw: .cache_creation_input_tokens
}] | {
  input: (map(.i) | add), output: (map(.o) | add),
  cache_read: (map(.cr) | add), cache_write: (map(.cw) | add)
}' "$SESSION_FILE"

# Get session metadata
jq -r 'select(.gitBranch) | .gitBranch' "$SESSION_FILE" | head -1
jq -r 'select(.version) | .version' "$SESSION_FILE" | head -1

# Get start/end timestamps
jq -r '.timestamp' "$SESSION_FILE" | head -1   # start
jq -r '.timestamp' "$SESSION_FILE" | tail -1   # end

# Count agent spawns by type
jq -r '.message.content[]? | select(.type == "tool_use" and .name == "Task") | .input.subagent_type' "$SESSION_FILE" | sort | uniq -c | sort -rn
```

## Step 4: Present as Timeline

```markdown
## Session: 08ed1436 — 2026-02-18 10:50 -> 11:35 (45min)
**Branch:** bugfix/windows-spawn | **CC Version:** 2.1.45
**Tokens:** 152K in, 38K out | **Cache hit rate:** 89%

### Timeline
| Time | Event | Details |
|------|-------|---------|
| 10:50:00 | SESSION START | branch: bugfix/windows-spawn |
| 10:50:01 | HOOK | SessionStart:startup |
| 10:50:05 | Read | src/hooks/bin/spawn-worker.mjs |
| 10:50:08 | Grep | "spawn" in src/ |
| 10:50:15 | Task (agent) | code-quality-reviewer |
| 10:51:00 | Edit | src/hooks/bin/spawn-worker.mjs |
| 10:52:30 | Bash | npm test -> 8.3s |
| 11:35:00 | SESSION END | 23 tool calls, 3 agents |

### Tool Usage
| Tool | Count |
|------|-------|
| Read | 12 |
| Edit | 5 |
| Bash | 4 |
| Task | 2 |

### Token Breakdown
| Metric | Value |
|--------|-------|
| Input tokens | 152,340 |
| Output tokens | 38,210 |
| Cache read | 1,245,000 |
| Cache write | 18,500 |
| Cache hit rate | 89% |
```
