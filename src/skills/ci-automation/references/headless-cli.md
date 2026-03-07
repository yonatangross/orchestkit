# Headless CLI Reference

## Basic Usage

```bash
claude -p "Your prompt here"
```

The `-p` (print) flag runs Claude non-interactively -- no terminal UI, no permission prompts.

## Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `-p "prompt"` | Non-interactive mode | `claude -p "Analyze code"` |
| `--output-format json` | Structured JSON output | Parse with `jq .result` |
| `--output-format stream-json` | Streaming JSON events | Real-time progress |
| `--max-turns N` | Cap tool-use iterations | `--max-turns 5` |
| `--model MODEL` | Select model | `--model sonnet` / `--model haiku` |
| `--allowedTools LIST` | Pre-approve tools | `--allowedTools "Read,Grep"` |
| `--resume SESSION_ID` | Continue a session | Multi-step CI flows |
| `--append-system-prompt` | Add to system prompt | Role injection |

## Output Format: JSON

```bash
claude -p "Analyze this repo" --output-format json > result.json
```

Output structure:

```json
{
  "type": "result",
  "subtype": "success",
  "result": "The analysis shows...",
  "session_id": "abc123",
  "cost_usd": 0.08,
  "duration_ms": 15000,
  "num_turns": 3
}
```

## Tool Whitelisting

Pre-approve specific tools to avoid permission prompts:

```bash
# Read-only analysis (no file writes)
--allowedTools "Read,Grep,Glob,Bash(gh:*),Bash(npm:*)"

# Full access (for build/deploy pipelines)
--allowedTools "Read,Write,Edit,Bash,Grep,Glob"
```

### Bash Tool Patterns

```bash
# Allow specific command prefixes
--allowedTools "Bash(gh:*)"      # Only gh commands
--allowedTools "Bash(npm:*)"     # Only npm commands
--allowedTools "Bash(git:*)"     # Only git commands
```

## Pipe Input

```bash
# Pipe PR diff for review
gh pr diff 123 | claude -p "Review this diff for security issues"

# Pipe test output for analysis
npm test 2>&1 | claude -p "Analyze these test failures"

# Pipe file content
cat package.json | claude -p "Check for outdated dependencies"
```

## Multi-Turn with --resume

```bash
# First run: collect data
SESSION=$(claude -p "Collect repo metrics" --output-format json | jq -r .session_id)

# Second run: analyze with context from first
claude -p "Now analyze the metrics and write a report" --resume "$SESSION" --output-format json
```

## System Prompt Injection

```bash
claude -p "Review code" --append-system-prompt "You are a senior security engineer. Focus on OWASP top 10."
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | API authentication |
| `CLAUDE_MODEL` | Default model (overridden by --model) |
| `CLAUDE_MAX_TURNS` | Default max turns |

## CI Script Pattern

```bash
#!/bin/bash
set -euo pipefail

# Run analysis
RESULT=$(claude -p "Analyze codebase health" \
  --output-format json \
  --max-turns 10 \
  --model sonnet \
  --allowedTools "Read,Grep,Glob,Bash(gh:*)")

# Parse result
SCORE=$(echo "$RESULT" | jq -r '.result' | jq -r '.overall_score // empty')

if [ -n "$SCORE" ] && [ "$SCORE" -lt 5 ]; then
  echo "Health score below threshold: $SCORE/10"
  exit 1
fi
```
