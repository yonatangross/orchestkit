# memory-lens

Recalls the few memories related to each prompt. The model gets them as one context entry; you see one line under your prompt with what was recalled and why.

## Minimum CC version

Requires Claude Code 2.1.283 or later (the `prompt.submit` answer shape below was measured on that binary).

## Installation

1. Copy this folder to your project:
   ```bash
   cp -r mods/memory-lens/ /path/to/your/project/mods/
   ```

2. Enable function hooks in your shell profile or personal settings:
   ```bash
   export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
   ```

3. Start Claude Code with the plugin directory:
   ```bash
   claude --plugin-dir mods/memory-lens
   ```

## What it does

- **Index at session start**: reads `~/.claude/projects/<project>/memory/*.md` (Claude Code's own memory files) in the background. A worktree under `<repo>/.worktrees/<name>` maps to its parent repo's folder, because a worktree's own folder is usually empty. `MEMORY.md` index files are never recalled.
- **Recall on each prompt**: BM25 over each memory's name, description and the start of its body. At most 3 memories, only above a score floor, so a vague prompt ("fix all") shows nothing instead of noise. Session digests and index hubs count half.
- **Two surfaces**: the model gets one context entry of about 250 tokens (capped near 600), with each memory's name, description and path. You get one line: `n/3 title (file.md) · match words`, memories joined by a bar.
- **Mid-task recall**: a Read, Edit, Write, Grep or Glob path is a new query; at most one memory not yet recalled this session is added to that tool's context.
- **Fresh after a write**: a Write or Edit under the memory folder re-indexes that file, so the next prompt can find it.

## Optional local files (never committed)

Both live in `~/.claude/memory-lens/`:

| File | What it is |
|------|------------|
| `private.json` | `{ "clientTerms": ["..."] }`: words that mark a memory as client data. Its title is hidden on screen; the model still gets it. A memory in a `clients-*` project is always treated this way. |
| `mirror-<project>.json` | `{ "items": [{ "id", "title", "summary", "source" }] }`: titles of remote knowledge, written by a job outside this mod. The lens recalls them like local memories and tells the model to fetch the body by id only if needed. |

Secret-shaped text (key prefixes, PEM headers) reaches neither the screen nor the model.

## Hook footprint

| Event | Matcher | Notes |
|-------|---------|-------|
| `session.start` | `{}` | Find the memory folder, build the index in the background, register `/memory-lens` |
| `prompt.submit` | `{}` | Query, put the context on the event before `next()`, draw the line |
| `tool.call` | `{}` | Read, Edit, Write, Grep, Glob only: one mid-task memory, or re-index a written memory |
| `command.run` | `{ command: 'memory-lens' }` | `stats`, `reload`, `show <n>` |

### Calls

- `$.env.get('HOME')`, `$.fs.list`, `$.fs.read`: the memory folder and the two optional files
- `$.ui.log`: the screen line (and one debug line with the index size)
- `$.clock.after`: caps the first prompt's wait for the index at 2 s
- `$.command.register`: `/memory-lens`

### Negative pin (what it does NOT do)

- No `process.run`, no `http.fetch`, no `store`
- No file reads on the hot path except re-indexing a memory that was just written

## Measured on Claude Code 2.1.283 (2026-09-28)

- `prompt.submit` answers `{ text, context? }` where `context` is a list of non-empty strings (the binary's `checkArgument` for that event). The context lands in the transcript as a `hook_additional_context` attachment.
- An answer built after `next(e)` settled never reached the model: the classic `UserPromptSubmit` hooks run inside `next(e)` and the turn had started. The lens therefore puts the context on the event it passes to `next(e)`.
- In the TUI, a newline inside one `$.ui.log` call draws as a replacement glyph, Claude Code prefixes the plugin name, and a second `$.ui.log` in the same hook call did not draw. Hence one line per prompt.
- Index build: 379 files in 309 ms, 2,046 files in 936 ms. Query on 20 real prompts (same code under Node): p50 2.5 ms, p95 3.4 ms.
- On 20 real prompts, 24 of 48 shown memories were useful (50 %), 13 of 20 prompts got at least one, and the 2 prompts it stayed quiet on were vague.

## Commands

- `/memory-lens` or `/memory-lens stats`: index size, memories recalled this session, query p50 and p95
- `/memory-lens reload`: rebuild the index
- `/memory-lens show <n>`: print memory n from the last prompt in full, including a hidden client title

## Rollback

1. Remove from the plugin directory, or `claude plugin disable memory-lens`
2. Unset `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`

No state is persisted; the index lives in memory for the session.

## Acceptance checklist

- [x] A matching prompt gets one context entry the model can read (live, 2.1.283)
- [x] The line draws in the TUI (live, 2.1.283)
- [x] A vague prompt passes through untouched
- [x] Client titles hidden on screen, secrets withheld from both surfaces
- [x] A written memory is recalled on the next prompt
- [x] Query under 150 ms (p95 3.4 ms on 20 real prompts)
- [ ] Interactive latency of the whole `prompt.submit` hook isolated from the classic hooks inside `next(e)`
