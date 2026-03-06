---
paths:
  - "src/hooks/**"
---

# Hook Development Rules

## Architecture
- **Dispatcher pattern**: Consolidate 2+ related hooks into one hooks.json entry with a dispatcher
- **Guard at TOP**: Return early for non-matching tools — fast exit is critical
- Use output builders: `outputSilentSuccess()`, `outputBlock(reason)`, `outputWithContext(text)`, `outputPromptContext(text)`, `outputAllowWithContext(text)`

## Type Safety
- Use type guards: `isBashInput()`, `isWriteInput()`, `isEditInput()`, `isReadInput()`
- All input/output conforms to `HookInput` / `HookResult` interfaces
- Run `npm run typecheck` after any hook change

## Registration Flow
1. Create handler in `src/hooks/src/<category>/<name>.ts`
2. Register in `src/hooks/hooks.json`
3. Build: `cd src/hooks && npm run build`
4. Update hook count in CLAUDE.md Version section + hooks.json description field

## Performance Budgets
- PreToolUse: < 50ms | PostToolUse: < 100ms | Permission: < 10ms
- Use `async: true` + `timeout` in hooks.json for non-blocking hooks
- No file I/O in hot-path hooks (pretool, permission) — pre-compute state in SessionStart instead

## Cache Safety
- SAFE: `additionalContext` injection, `<system-reminder>` tags, async hooks
- DANGEROUS: modifying system prompt, changing tool definitions mid-session
