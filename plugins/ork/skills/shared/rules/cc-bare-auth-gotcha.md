# Rule: `claude --bare` auth is broken — never use it in CI

**Status**: confirmed CC 2.1.81–2.1.143 · upstream bug filed [anthropics/claude-code#60155](https://github.com/anthropics/claude-code/issues/60155) · prior incident [orchestkit#1629](https://github.com/yonatangross/orchestkit/issues/1629)

## The trap

The `--bare` flag's `--help` text promises:

> Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings (OAuth and keychain are never read).

**All three documented paths fail.** Every invocation in `--bare` mode returns:

```
{"is_error":true, "result":"Not logged in · Please run /login"}
```

regardless of whether the API key is supplied via env var, `--settings.apiKey`, or `--settings.apiKeyHelper`.

## Don't do this

```yaml
# WRONG — will silently fail every claude invocation
- env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    claude -p --bare --max-turns 4 --output-format json "..."
```

## Do this

```yaml
# RIGHT — apiKeyHelper in ~/.claude/settings.json + plain `claude -p`
- name: Configure Claude apiKeyHelper
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    mkdir -p ~/.claude
    printf '#!/bin/sh\necho "$ANTHROPIC_API_KEY"\n' > ~/.claude/api-key-helper.sh
    chmod +x ~/.claude/api-key-helper.sh
    printf '{"apiKeyHelper":"%s/.claude/api-key-helper.sh"}\n' "$HOME" \
      > ~/.claude/settings.json

- name: Analyze
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    claude -p --max-turns 4 --output-format json --no-session-persistence "..."
```

Cost: ~10k tokens/call instead of `--bare`'s advertised ~4k. Worth it — the alternative is a silently failing workflow.

## Verify auth before burning budget

Always include a one-call smoke test after the apiKeyHelper write step:

```bash
smoke=$(claude -p --max-turns 1 --output-format json --no-session-persistence \
  "respond with OK" 2>&1)
echo "$smoke" | jq -e '.is_error == true' >/dev/null && {
  echo "::error::Auth smoke test failed"
  exit 1
}
```

The smoke test runs once per workflow invocation and catches auth breaks at the START of the job — not 10 PRs later when you've wasted classifier runs on every failure.

## When upstream fixes it

The fix would let `--bare` honor `ANTHROPIC_API_KEY` per the help text. When that lands, revert this rule's "do this" block to use `--bare` (saves ~60% of token cost per invocation). Anchor the revert PR on the upstream issue closure.

## Reproducer

All three fail. All from the same fresh-HOME state to rule out cached OAuth state:

```bash
TMPH=$(mktemp -d)
KEY="sk-ant-..."

# Path 1: ANTHROPIC_API_KEY env var
HOME=$TMPH ANTHROPIC_API_KEY=$KEY claude -p --bare \
  --max-turns 1 --output-format json "hi"

# Path 2: apiKey via --settings
echo "{\"apiKey\":\"$KEY\"}" > $TMPH/s.json
HOME=$TMPH claude -p --bare --settings $TMPH/s.json \
  --max-turns 1 --output-format json "hi"

# Path 3: apiKeyHelper via --settings
echo "{\"apiKeyHelper\":\"echo $KEY\"}" > $TMPH/s.json
HOME=$TMPH claude -p --bare --settings $TMPH/s.json \
  --max-turns 1 --output-format json "hi"
```

All three: `{"is_error":true,"result":"Not logged in · Please run /login"}`.

Same env var **without** `--bare` (and with apiKeyHelper written to `~/.claude/settings.json`) works:

```bash
HOME=$TMPH ANTHROPIC_API_KEY=$KEY claude -p \
  --max-turns 1 --output-format json "hi"
# → {"is_error":false, "result":"Hi there, friend."}
```
