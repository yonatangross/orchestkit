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
3. **Add it to the entries map** in `src/hooks/src/entries/<event>.ts` — both the import and the `hooks` record. **Steps 2 and 3 are a pair.** A hook in `hooks.json` but missing from the entries map dispatches to nothing and fails silently; a hook in the entries map but missing from `hooks.json` is never invoked. That asymmetry is the #959 dead-hook class, and it has cost this repo months of lost telemetry more than once.
4. Build: `cd src/hooks && npm run build`
5. Re-stamp counts: run `bash bin/validate-counts.sh` and fix what it reports. The `hooks.json` description field carries the count; the `<!--ork:hooks-->` markers in `README.md`/`CONTRIBUTING.md` are stamped by `scripts/stamp-counts.sh`. (CLAUDE.md's Version section carries only the release version — no hook count lives there.)
6. Add a `Registry changelog` entry in `src/hooks/README.md` — `hooks.json`'s own description mandates that history lives there, not in the JSON.

## Performance Budgets
- PreToolUse: < 50ms | PostToolUse: < 100ms | Permission: < 10ms
- Use `async: true` + `timeout` in hooks.json for non-blocking hooks
- No file I/O in hot-path hooks (pretool, permission) — pre-compute state in SessionStart instead

## Cache Safety
- SAFE: `additionalContext` injection, `<system-reminder>` tags, async hooks
- DANGEROUS: modifying system prompt, changing tool definitions mid-session
