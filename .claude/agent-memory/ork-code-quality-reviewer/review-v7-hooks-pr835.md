---
name: review-v7-hooks-pr835
description: Archived detailed findings from v7.0.0 hook review (PR #835, 2026-03-02)
metadata:
  type: project
---

## v7.0.0 Hook Review Findings (2026-03-02, PR #835)
Full details: see review output. Key confirmed issues:

### Dead Code
- `_splitCompound()` in `src/hooks/src/lib/normalize-command.ts:60` — defined but never called. Dead code.
- Legacy hook imports in `src/hooks/src/entries/prompt.ts:43-50` — antipatternDetector, todoEnforcer, pipelineDetector etc imported "for backward compat" but never referenced externally. Bundle bloat.
- `normalizeCommand` duplicated: `src/hooks/src/lib/common.ts:611` (returns string, legacy) vs `src/hooks/src/lib/normalize-command.ts:94` (returns string[], newer). Both in use; creates confusion.

### Type Safety
- `(input as any)` cast in `src/hooks/src/skill/redact-secrets.ts:31` — `tool_result` and `output` are already typed in HookInput; cast is unnecessary.
- 11 more `as any` casts across skill/ and subagent-stop/ — all avoidable with typed access.
- `hookEventName: 'SubagentStop' as any` in `subagent-stop/output-validator.ts:115` — HookSpecificOutput.hookEventName doesn't include SubagentStop events.

### Error Handling / Logic
- Fork bomb `:(){:|:&};:` in `dangerous-command-blocker.ts:39` is added to DANGEROUS_PATTERNS checked by `containsDangerousCommand()`. BUT `containsDangerousCommand` splits on `|` and `;`, fragmenting the pattern so it never matches. The explicit re-check at line 117 via `normalizeCommandLegacy()` is the ACTUAL catch — making it work by accident. This is a correctness risk if the legacy check is ever removed.
- `Date.now()` used for once-flag content in `prompt/unified-dispatcher.ts:140` — project preference is ISO 8601.

### Test Failures (16 failures / 6367 tests total)
- `sync-session-end-dispatcher.test.ts`: 5 failures — pattern-sync-push skip semantics tests expect `vi.fn()` not to be called when a prior hook returns `continue: false`, but it IS being called. Tests reveal that pattern-sync-push is NOT being short-circuited correctly.
- `handoff-writer.test.ts`: 1 failure — success log message no longer contains 'HANDOFF.md'. Implementation changed, test not updated.
- `sync-session-dispatcher.test.ts`: 1 failure — logging test.

### Architecture Notes
- `redactSecrets` is a skill/ hook (PostToolUse for Skill tool) but wired into posttool/unified-dispatcher.ts as a Bash/Write/Edit matcher. Semantically wrong placement.
- Prompt dispatcher `runOnce` hooks (profile-injector, memory-context-loader, handoff-injector) are ALSO registered as separate hooks.json entries — double-registration guarded by file-based once-flags, but adds code surface.
