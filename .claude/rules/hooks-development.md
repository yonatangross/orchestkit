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

## FH-ready handlers (2026-09-04)
Claude Code is designing Function Hooks (anthropics/claude-code#91870): hooks become in-process functions, and the plugin sandbox has no ambient filesystem or network, every side effect goes through the engine object `$`. Whether or not that ships, a handler that owns its own I/O is harder to test and impossible to port; one that receives its I/O is both.

- **New handlers** under `src/hooks/src/` (everything except `lib/`, `entries/`, `types.ts`, tests) must not import `node:fs` or `node:child_process`, and must not call `fetch` directly.
- Side effects go through `HookContext` (the #3386 DI seam) or an injected `deps` object built once by the runner. Today `deps.git` is `execSync`-backed; under Function Hooks it is `$.process`-backed; the handler does not change.
- Existing offenders are grandfathered by path in `src/hooks/scripts/fh-ready-baseline.json` (a ratchet: shrink it, never grow it). `node scripts/fh-ready-check.mjs` runs in CI beside `validate-registry.mjs` and fails on any file not in the baseline.
- Output caps are real and silent: CC 2.1.258 truncates `additionalContext` at 8,000 characters or 200 lines, `reason` at 2,000 characters or 20 lines, mid-word, with no report (anthropics/claude-code#91870, issuecomment-5532305564). `src/__tests__/fh-output-cap.test.ts` asserts no static payload approaches the cap.

## Function Hooks watch gate (2026-09-05)

Function Hooks remains a watch, not an adoption. The off-by-default prototype observed in
Claude Code 2.1.260 and 2.1.261 is binary behavior, not a public contract
([2.1.260 measurement](https://github.com/anthropics/claude-code/issues/91870#issuecomment-5540419526),
[2.1.261 measurement](https://github.com/anthropics/claude-code/issues/91870#issuecomment-5549854514)).

Until a Claude Code changelog names Function Hooks **or**
[anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) closes:

- Do not add a `modules` key to `hooks.json`, enable rollout flags, or document either for users.
- Do not port handlers to Function Hooks or add Function Hooks runtime code.
- Do not raise the Claude Code support floor or open an adoption issue for Function Hooks.

When either close condition fires, link and record the outcome on #3917:

- If a Claude Code changelog publicly ships and names Function Hooks, verify the public surface and open a separate adoption issue.
- If #91870 closes without shipment, record that outcome and do not adopt.
