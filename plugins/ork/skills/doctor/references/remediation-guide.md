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

CC ≤ 2.1.127 occasionally left `installed_plugins.json` entries pointing at deleted cache directories, polluting `PATH` for subprocesses. CC 2.1.128+ scrubs those automatically — no maintenance needed at our floor (2.1.132). If you see plugin commands failing with `command not found` after uninstalling a plugin on CC < 2.1.128, upgrade.

### "Auto mode unable to evaluate"

CC 2.1.128+ adds a hint to the auto-mode classifier failure path. When you see:

```
Auto mode could not evaluate this action.
  hint: retry, use /compact, or run with --debug
```

Pick whichever applies — `/compact` if context is full, `--debug` to see the classifier's reasoning, retry if it was transient.
