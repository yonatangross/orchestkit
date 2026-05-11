# Remediation Guide

Quick remediation steps for common `/ork:doctor` findings.

## Interpreting Results

| Status | Meaning | Action |
|--------|---------|--------|
| All checks pass | Plugin healthy | None required |
| Skills warning | Invalid frontmatter | Run `npm run test:skills` |
| Agents warning | Invalid frontmatter | Run `npm run test:agents` |
| Hook error | Missing/broken hook | Check hooks.json and bundles |
| Memory warning | Graph unavailable | Check .claude/memory/ directory |
| Build warning | Out of sync | Run `npm run build` |
| Permission warning | Unreachable rules | Review `.claude/settings.json` |
| Plugin validate error | CC frontmatter/hooks.json invalid | Run `claude plugin validate` and fix reported errors |

## Troubleshooting

### "Skills validation failed"

```bash
# Run skill structure tests
npm run test:skills
./tests/skills/structure/test-skill-md.sh
```

### "Build out of sync"

```bash
# Rebuild plugins from source
npm run build
```

### "Memory unavailable"

```bash
# Check graph memory
ls -la .claude/memory/
```

### "Plugin validate failed"

```bash
# Run CC's official validator (requires CC >= 2.1.77)
claude plugin validate

# Fix reported errors, then rebuild and re-validate
npm run build
claude plugin validate
```

### "Stale plugin paths in PATH"

CC ≤ 2.1.127 occasionally left `installed_plugins.json` entries pointing at deleted cache directories, polluting `PATH` for subprocesses. CC 2.1.128+ scrubs those automatically — no maintenance needed at our floor (2.1.138). If you see plugin commands failing with `command not found` after uninstalling a plugin on CC < 2.1.128, upgrade.

### "Auto mode unable to evaluate"

CC 2.1.128+ adds a hint to the auto-mode classifier failure path. When you see:

```
Auto mode could not evaluate this action.
  hint: retry, use /compact, or run with --debug
```

Pick whichever applies — `/compact` if context is full, `--debug` to see the classifier's reasoning, retry if it was transient.

### "Logged out after laptop wake"

If multiple CC sessions all logged themselves out at the same moment after the laptop woke from sleep, that is the pre-2.1.129 OAuth refresh race — concurrent wake-time refreshes invalidated the active token across every running session.

**Fix**: upgrade to CC ≥ 2.1.129 (our floor is 2.1.138, so anyone on the supported window is already fixed). Recover the session with:

```bash
claude /login
```

Then `claude --resume` the affected session(s). Checkpoint state in `.claude/pipeline-state.json` survives — see `checkpoint-resume` skill for resume semantics.

If logouts after wake persist on CC ≥ 2.1.129, the cause is no longer the race — investigate the refresh token (expired, keychain ACL changed, 1Password locked) instead.

### "All concurrent sessions 401 simultaneously"

If you had multiple CC sessions open (worktree-isolated agents, parallel `/ork:implement` chains, multi-tab work) and every one of them dead-ended at `401 Unauthorized` at the same instant — that is the pre-2.1.133 parallel-session refresh-token race. A refresh-token rotation fired in one session, the other sessions raced against it, and they all wound up holding the now-invalidated old token.

**Fix**: upgrade to CC ≥ 2.1.133 (our floor is 2.1.138, so the supported window is already past this). Recover the stuck sessions with:

```bash
claude /login
```

Then `claude --resume` the affected sessions. Worktree state in each agent's branch is unaffected.

If "all sessions 401 at once" still reproduces on CC ≥ 2.1.133, the cause is no longer this race — check the refresh token itself (expired, revoked by the IdP, keychain ACL changed, 1Password locked). See also the "Logged out after laptop wake" entry above for the related 2.1.129 wake-from-sleep race.
