# Bare Eval Troubleshooting

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `--bare requires ANTHROPIC_API_KEY` | OAuth/keychain not supported in bare mode | Set `ANTHROPIC_API_KEY` env var |
| `Unknown flag --bare` | CC version < 2.1.81 | Upgrade: `npm i -g @anthropic-ai/claude-code@latest` |
| Empty response | Model returned empty or budget exceeded | Increase `--max-budget-usd` or check prompt |
| Malformed JSON from batch grader | Model wrapped JSON in markdown fences | Strip fences: `sed 's/^```json//;s/^```//;s/```$//'` |
| `BARE_MODE=false` despite key set | `ANTHROPIC_API_KEY` empty string | Ensure key has a value: `echo $ANTHROPIC_API_KEY` |
| Timeout in CI | Model taking too long | Use `run_with_timeout` with adequate seconds |

## Debugging

### Check if bare mode is active

```bash
# In eval scripts:
echo "BARE_MODE=$BARE_MODE"

# Manual test:
ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" claude -p "Hello" --bare --max-turns 1 --output-format text
```

### Verbose output

```bash
# Capture stderr for diagnostics
claude -p "$prompt" --bare --max-turns 1 --output-format text > output.txt 2> stderr.txt
cat stderr.txt
```

### Fallback when --bare unavailable

If CC < 2.1.81, the eval scripts still work — they just don't add `--bare`:

```bash
# eval-common.sh:
BARE_MODE=false  # No ANTHROPIC_API_KEY → no bare mode
# Scripts run normally, just slower (full plugin/hook overhead)
```

## Performance Profiling

Compare eval times with and without bare:

```bash
# With bare
time ANTHROPIC_API_KEY="$KEY" claude -p "test" --bare --max-turns 1 --output-format text > /dev/null

# Without bare (full stack)
time claude -p "test" --max-turns 1 --output-format text > /dev/null
```

## Security Notes

- `--bare` disables auto-memory — no session learnings stored
- `--bare` requires explicit API key — no credential leakage via keychain
- Eval scripts already run outside Claude Code sessions (`unset CLAUDECODE`)
- `SKILL_NAME_RE` regex prevents path traversal in eval inputs (SEC-001)
