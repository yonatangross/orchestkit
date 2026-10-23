# Prompt Enhancer

Requires Claude Code 2.1.300 or later.

Beta (experimental, version 0.x). Each Enhance click costs model usage on your own account: one Haiku call with a 1024 token cap.

The band sits above the prompt box. Type a draft and press Enhance.
Or type a prompt that ends in `++` and press Enter.
The mod holds the prompt and puts the rewrite in the box.
Edit it, then press Send or Enter. Send submits the current box as your own words.

To press a button from the keyboard: ctrl+x tab moves the focus to the band, then `e` is Enhance, `u` is Undo and `s` is Send (Tab and Enter work too). Esc goes back to the prompt.
A click reaches the buttons only where the terminal reports clicks to Claude Code (`"tui": "fullscreen"`). In the default terminal mode a click selects text and does nothing else, so use the keys.
Undo puts the exact original text back, including the trigger when you typed it.
Enhance a rewrite again without editing it, and Undo still goes back to your first draft. Edit the rewrite first, and Undo goes back to your edit.
A rewrite that ends in `++` (for example `C++`) is sent as is when you press Enter on it.
To send a prompt you typed that ends in `++` without a rewrite, press Send instead of Enter.
The collapse control hides the buttons. Press the expand control to show them.

## What the rewrite does

The rewrite stays close to your draft. It fixes typos and fast-typing slips, decodes English typed on a Hebrew keyboard layout (`גם ןא שךך` is `do it all`), adds at most 3 lines, and ends with one `Done when:` line that names an observable check.
It never asks questions and never lists interpretations: an ambiguous draft gets its most likely meaning.
It names at most 3 of your real tools (a subagent to delegate to, a skill or slash command, an MCP server), copied exactly from the catalog, and only when they clearly fit. Broad work gets a line about parallel subagents; small work gets none.
The rules are fixed in `src/system.ts`.

## The stack catalog

Each call sends a compact catalog of names and one-line purposes ahead of the draft, so the rewrite can point at tools you actually have.

- Bundled: OrchestKit's own agents and skills, generated into `src/catalog.ts` from the repo's `src/agents` and `src/skills` (`npm run catalog`; `npm run catalog:check` fails when it is stale).
- Local: run `npm run catalog:local` in this directory to write `~/.claude/prompt-enhancer/catalog.md` from your `~/.claude` agents, skills and commands, your enabled plugins' agents, skills, commands and MCP servers, and the MCP servers in `~/.claude.json`. When that file exists, Enhance uses it instead of the bundled one. Rerun it after you add or remove plugins.
- Notes: anything in `~/.claude/prompt-enhancer/notes.md` (up to 2,000 characters) is added to the local catalog, for facts about your setup that no manifest says.

Only names and purposes are written. An MCP server's command, arguments, environment and URL are never read into the catalog, since they can carry credentials.
A catalog is cut at 24,000 characters; the builder shortens purposes first so a large install still fits.

## Prompt caching

The system prompt and the catalog form one static prefix, and the catalog block carries a cache breakpoint (`cache: true`, which Claude Code sends as the API's `cache_control`). Only the draft after it is new input on each call.
The prefix has no timestamps or per-session data, and the catalog is sorted the same way every time, so its bytes stay identical between calls. The cache is shared by every Claude Code session on the same account or workspace, so an Enhance in one session or herdr lane warms it for the others.
The breakpoint sits in `prompt` rather than `system`, as the mods API docs advise for a mod that other people run: through Bedrock, Vertex, Foundry or an LLM gateway, a `system` breakpoint can miss.
A cache entry lasts 5 minutes after its last use (Claude Code's `subagentPromptCacheTtl` setting makes it 1 hour). The API does not cache a prefix under the model's minimum length, which is 512 tokens for Haiku 5.5 and 4,096 for Haiku 4.5 (what `haiku` means on Bedrock, Vertex and Foundry); the bundled catalog clears the first and a typical local catalog clears both.

## Model call

Enhance uses the session model client with the `haiku` alias.
Each click can incur model usage charges under the session account.
The call has a 12 second timeout and a 1024 token cap.

If the call fails or returns no text, the original stays in the box and a toast appears.
The mod never sends a rewrite during Enhance. It sends only the visible box after a user action.
Edits during a model call cancel that result. Undo also cancels a pending result.
Slash commands, attachments, and prompts from other sources pass through without enhancement.
Use Enter for attachments and file mentions. The plugin Send API does not expand them.
Another installed mod can still change a fill or submission through its own hooks.

## Mods API calls

- `$.model.complete`: one Haiku call per Enhance, with prompt blocks and a cache breakpoint
- `$.env.get('HOME')`, `$.fs.exists`, `$.fs.read`: the optional local catalog
- `$.prompt.read`, `$.prompt.fill`, `$.prompt.submit`, `$.state.get`, `$.state.set`, `$.ui.toast`, `$.ui.resolve`

## Local checks

Use the package test and typecheck scripts. Validate this plugin with the Claude CLI.
The tests drive the real hook exports with a fake engine. They do not make model calls.
The pinned engine declarations supplied for version 2.1.300 define the API facade in `src/api.ts`.
The state contract lives in `types/index.d.ts`.
