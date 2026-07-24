# CC-v3 vs OrchestKit Hook Comparison (2026-03-02)

## Confirmed Coverage
| CC-v3 Hook | OrchestKit File | Status |
|---|---|---|
| pre-compact-continuity | lifecycle/pre-compact-saver.ts | Fully covered, superior |
| tldr-context-inject | pretool/read/tldr-summary.ts | Fully covered, superior |
| post-edit-diagnostics | posttool/auto-lint.ts + posttool/failure-handler.ts | Covered |
| edit-context-inject | pretool/Write/architecture-change-detector.ts | Covered for arch files |
| session-outcome | stop/workflow-preference-learner.ts | Partial |

## Confirmed Gaps (Actionable)
| CC-v3 Hook | Gap | Where to Fix | Lines |
|---|---|---|---|
| smart-search-router | grep/find not redirected to native tools | pretool/bash/unified-advisory-dispatcher.ts | ~20 |
| post-tool-use-tracker | No unique-file-path budget counter | New: prompt/context-injector.ts reads budget file | ~80 |
| skill-activation-prompt | context-injector.ts returns outputSilentSuccess | prompt/context-injector.ts lines 42-48 | ~5 |
| compiler-in-the-loop | biome only, no tsc --noEmit | posttool/auto-lint.ts TypeScript case | ~20 |
| memory-awareness | getWorkflowSummary() exported but not called at prompt | prompt/context-injector.ts | ~5 |

## Do Not Implement
- tldr-read-enforcer: blocking reads is wrong DX, summary injection already solves the goal
- impact-refactor: complexity/value ratio unfavorable
- file-claims: defer until multi-worktree use cases confirmed
- session-symbol-index: P2, needs incremental cache design to be safe

## Critical Architecture Notes
- Async hooks (hooks.json `async: true`): CC IGNORES systemMessage, continue, decision
  - Source: unified-dispatcher.ts comment lines 9-13, confirmed by design
  - File-edit budget MUST use sync path (UserPromptSubmit check) not PostToolUse async
- Short-circuit pattern: sync-bash-dispatcher.ts line 118: `if (!result.continue) return result`
- Context merge: sync dispatchers merge additionalContext from all passing hooks into one output
