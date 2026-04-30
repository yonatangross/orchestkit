# Background Monitor Authoring (CC 2.1.105+)

Background monitors live in `src/monitors/monitors.json` and are auto-armed on session start for every install. Each entry runs as a long-lived shell process on the user's machine — handle with care.

## Authoring Rules

- **Lower bound**: each polling loop must `sleep` ≥ 60s (preferably 300s+). No tight loops.
- **Idempotent**: emit only when state actually changed since the previous poll (debounce). Don't nag-spam.
- **Quick polls**: each iteration must complete in < 100ms of CPU. No heavy I/O, no network calls.
- **Bounded output**: 1-2 lines max per emit. Long output floods the conversation context.
- **No secrets**: never echo env vars, file contents, or git output that may contain tokens.
- **No state mutation**: read-only. A monitor that writes files is a hook, not a monitor — move it.

## Build & Registration

After editing `src/monitors/monitors.json`, run `npm run build`. The build script:

1. Copies `src/monitors/monitors.json` → `plugins/ork/monitors/monitors.json`
2. Synthesizes the `monitors` key into `plugins/ork/.claude-plugin/plugin.json`

The source-of-truth `monitors` key is also declared in `manifests/ork.json` (M128 onward — previously only synthesized at build time).

## Pattern: Debounced Polling

The `uncommitted-work-reminder` monitor demonstrates the canonical debounce pattern:

```bash
sleep 600
prev_count=0
while true; do
  changed=$(git diff --stat 2>/dev/null | tail -1 | grep -o '[0-9]* file' | grep -o '[0-9]*' || echo 0)
  last_commit=$(git log -1 --format=%ct 2>/dev/null || echo 0)
  now=$(date +%s)
  since_commit=$((now - last_commit))
  if [ "$changed" -gt 10 ] && [ "$since_commit" -gt 300 ] && [ "$changed" != "$prev_count" ]; then
    echo "$changed files with uncommitted changes — consider /ork:commit to save progress"
  fi
  prev_count=$changed
  sleep 900
done
```

Three guards stack: threshold (`> 10`), recency (`> 5min since commit`), change-detection (`!= prev_count`). Skipping any one of them produces nag-spam.

## When to Use a Hook Instead

A monitor is the wrong choice if:

- The signal is event-driven (a tool runs, a file changes) — use `PreToolUse` / `PostToolUse` / `SessionStart` hooks instead.
- The check needs to mutate state — hooks can write `additionalContext`; monitors cannot.
- Sub-second responsiveness matters — monitors poll on minute-scale loops.
