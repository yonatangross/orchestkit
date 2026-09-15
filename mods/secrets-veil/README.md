# secrets-veil

A Claude Code mod that covers secret values in tool results and reveals them on hover (Desktop) or via `/veil` command (terminal).

## Goal

When a secret reaches a tool result, it is covered in the transcript and replaced before the model reads it. On Desktop, the value shows while the pointer is over it. On terminal, the `/veil` command or reveal button shows the value once.

## Requirements

- Claude Code 2.1.266 minimum (first `classic.PreToolUse` rename)
- Enable function hooks: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`

## Installation

```bash
# Clone or copy to your mods directory
claude --plugin-dir mods/
```

Or add to your personal `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"
  }
}
```

## How it works

### Mask table

At session start, the mod:

1. Reads `configs/env-names.json` (generated from `.env.tpl` op:// lines, names only)
2. For each name, calls `$.env.get(name)` - non-empty values >= 8 chars enter the mask table
3. Adds shape patterns: `sk-ant-`, `ops_`, `ghp_`, `github_pat_`, `xoxb-`, `AKIA`, `Bearer `, `-----BEGIN `

### Tool call hook

On `tool.call`, after the tool executes:

- If `r.deny`, pass through unchanged
- Mask `r.text` and string leaves of `r.result` (Bash: stdout, stderr; Read: content)
- Also mask on `r.isError`
- Return `{ result: masked, context: ["[secrets-veil] N values covered"] }`

### UI render hook

On `ui.render` for `ToolResult` or `CommandOutput`:

- Walk the render tree, split on mask spans
- Each span becomes a keyed `Box` with:
  - Visible `Text("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022")`
  - Hidden `Box({ display: "none", hover: { display: "flex" } }, Text(value))`

### Terminal fallback

On Desktop, hover reveals the value. On terminal (where hover is unverified):

- A `reveal` button on the covered Box toggles reveal
- `/veil reveal <requestId>` command does the same

## Performance

- 1 MB stdout with 3 planted values masks in under 5 ms
- Hook budget is 10 s, fails open (measured on 2.1.272)
- No I/O on hot path - table built once at session start

## Rollback

To disable:

```bash
claude plugin disable secrets-veil
# Or remove from mods/
# Unset the flag
unset CLAUDE_CODE_ENABLE_FUNCTION_HOOKS
```

No state persists (except optional `$.store` last head, safe to drop).

## Risk

Risk level: yellow (moderate)

- Terminal hover is unverified - the fallback covers it
- A regression that makes the hook throw unloads the module and leaves the classic guard as the only cover, which is today's state

## Files

- `hooks/register.ts` - function hooks registration
- `src/mask.ts` - pure masking logic
- `src/tree.ts` - render tree walker
- `configs/env-names.json` - env var names (generated)
- `scripts/gen-env-names.sh` - generator script

## Testing

```bash
cd mods/secrets-veil
npx vitest run
```

## Acceptance

- [ ] Footprint validated: hooks `session.start`, `tool.call`, `ui.render{ToolResult}`, `ui.render{CommandOutput}`, `command.register`, `ui.press`; calls `$.env.get`, `$.ui.invalidate`
- [ ] Negative pin: no `process.run`, no `http.fetch`, no `store.*`, no `ui.log`
- [ ] Unit: 1 MB stdout with 3 planted values masks in under 5 ms
- [ ] Unit: values shorter than 8 chars are not masked
- [ ] Unit: `isError` results are masked
- [ ] Unit: value inside longer token is covered
- [ ] Unit: tree walker leaves non-Text nodes untouched
- [ ] Live terminal: `printf '%s' "$API_STATIC_TOKEN"` shows covered span in transcript
- [ ] Live terminal: transcript jsonl carries `[veiled:VAR_NAME]` not the value
- [ ] Live Desktop: pointer over span reveals the value; moving off covers it
- [ ] Live terminal: reveal button or `/veil reveal <requestId>` shows value once
- [ ] Classic `check-secret-exfil.py` still denies `echo $SECRET` before this hook runs
