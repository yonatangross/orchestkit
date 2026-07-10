# Design: InstructionsLoaded handler re-architecture (#2475)

Status: **scoped, not yet implemented** · Verified at HEAD `0f7200dac` (2026-07-10)

## Problem (both P0, confirmed live)

1. **Wrong payload shape.** `instructions-loaded/instructions-loaded-dispatcher.ts:54-58`
   reads `input.files_loaded` as an array and silent-exits via `!Array.isArray`.
   The real CC `InstructionsLoaded` event is **single-file** (`file_path`,
   `memory_type`, `load_reason`) — it has no `files_loaded`. So on the real event
   **0 handlers run**. `LoadedFile` (`types.ts:8-12`) and all 7 handler signatures
   `(files: LoadedFile[], contents: Map)` encode the fabricated shape.
2. **Read-only output channel.** Dispatcher returns `outputPromptContext(...)` →
   `additionalContext`, but `bin/output-guard.mjs:51-58` lists `InstructionsLoaded`
   OUT of `EVENTS_WITH_ADDITIONAL_CONTEXT`, so `output-guard.mjs:103-109` strips it
   with a WARN. Any dispatcher output is discarded before CC sees it.

**Why tests are green anyway:** the 9 fixtures under
`__tests__/instructions-loaded/` inject `files_loaded:[…]` — they assert the wrong
shape, giving false confidence. This is the trap the issue names.

## Root cause

The dispatcher was written against an assumed *batch* payload. The 4 cross-file
handlers (`priority-map`, `content-dedup`, `rule-conflicts`, `drift-detection`)
fundamentally need the **full rule set at once** — which a per-file event cannot
supply. So the fix is not a shape patch; it is splitting per-file work from
whole-set work across two events.

## Proposed design

1. **Redefine the input** as the real single-file payload with a type guard;
   add a typed `InstructionsLoadedInput` to `types.ts`.
2. **Per-file handlers stay on `InstructionsLoaded`**: `token-budget-tracker`,
   `smart-suggestions` (accumulate across firings via a session-scoped state file
   if they need cross-file context).
3. **Move cross-file handlers to `SessionStart`** — `priority-map`,
   `content-dedup`, `rule-conflicts`, `drift-detection`, and `debt-surfacer`
   (#2457). At SessionStart the full rule set exists AND `additionalContext` is
   honored (`output-guard.mjs:56` includes SessionStart).
4. **Stop using `outputPromptContext` on InstructionsLoaded**; use `systemMessage`
   (user-facing) or the SessionStart `additionalContext` for the moved handlers.
5. **Rewrite the 9 fixtures** to the single-file shape so tests stop giving false
   green.

## Scope (moderate-large, invasive)

- 1 dispatcher + 7 handlers under `src/hooks/src/instructions-loaded/` + `types.ts`
- 9 test files under `src/hooks/src/__tests__/instructions-loaded/`
- `hooks.json` (InstructionsLoaded registration + new SessionStart entries)
- `src/hooks/src/entries/lifecycle.ts` + `src/hooks/src/types.ts`
- `docs/site/content/docs/reference/hooks/instructions-loaded.mdx`
- Hook-count churn in `hooks.json` description + `split-bundles.test.ts`

## Why deferred

Real re-architecture across ~20 files touching the hook contract + test suite.
Deserves its own focused PR, not a bundled bug-fix. This doc unblocks that PR.
