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
