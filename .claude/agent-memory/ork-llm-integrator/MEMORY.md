# LLM Integrator Agent Memory

## Project Structure (OrchestKit)
- Source hooks: `src/hooks/src/<category>/<name>.ts`
- Hook registry: `src/hooks/hooks.json`
- Dispatcher pattern: always consolidate 2+ related hooks into one dispatcher
- Async hooks: fire-and-forget, return `outputSilentSuccess()` only
- Sync hooks: can return `outputPromptContext()` or `outputBlock()` to influence Claude

## Key Hook Events Available
- `Setup` — plugin load (one-time, runs dependency-version-check)
- `SessionStart` — each new session (pattern-sync-pull, session-env-setup, stale-team-cleanup, type-error-indexer)
- `UserPromptSubmit` — every user message (pipeline-detector, antipattern-detector, skill-nudge)
- `InstructionsLoaded` — when Claude loads instruction files (NO existing hooks yet)
- `PreToolUse` / `PostToolUse` — tool calls
- `Stop` — session end

## InstructionsLoaded Hook
- No existing handlers in OrchestKit as of 2026-03-05
- Fires when CLAUDE.md / rules files are loaded into context
- Input likely contains: file paths of loaded instructions, project_dir, session_id
- Sync hook — can inject `additionalContext` into the prompt prefix
- SAFE for prompt caching: inject via `additionalContext`, not system prompt modification

## Established Patterns
- `outputPromptContext(text)` — injects into `additionalContext` (cache-safe)
- `outputSilentSuccess()` — no-op, used for async or no-match cases
- `outputBlock(reason)` — blocks tool execution with explanation
- Guard at TOP: return early for non-matching inputs, fast exit critical

## Links
- Hook development rules: `.claude/rules/hooks-development.md`
- Dispatcher pattern example: `src/hooks/src/lifecycle/unified-dispatcher.ts`
- Prompt hook example: `src/hooks/src/prompt/antipattern-detector.ts`
