# Plan: Retire the MCP memory graph, re-home /ork:remember onto native memory files

**Status**: Proposed (plan only; nothing is removed by the PR that adds this file)
**Date**: 2026-09-28
**Decision**: Retire the MCP knowledge graph (`@modelcontextprotocol/server-memory`, the `mcp__memory__*` tools) as an OrchestKit dependency, in four ordered steps. `/ork:remember` and `/ork:memory` are re-homed onto Claude Code native memory files first; the graph surface is removed second; the stored graph data and the server switch-off each wait for an explicit maintainer decision.

## Context

OrchestKit adopted the MCP memory graph when Claude Code had no durable memory of its own. `/ork:remember` writes entities to it, `/ork:memory` reads them, and about 20 skills list graph tools in `allowed-tools`. Claude Code now ships native, file-based project memory (`MEMORY.md` plus one file per fact), and the OrchestKit paths that are actually exercised run on those files: `/ork:dream` consolidates them, and the memory-lens mod (`mods/memory-lens/`) recalls from them on every prompt.

Measured on 2026-09-28 at `origin/main`:

- 69 tracked files under `src/` reference `mcp__memory`, 174 lines (`git grep -l mcp__memory -- src`, `git grep -c` summed; a filesystem grep also counts 3 gitignored build sourcemaps). 20 `SKILL.md` files list graph tools; 6 of them write (fix-issue, remember, review-pr, setup, visualize-plan, write-prd).
- One agent grants graph tools (`debug-investigator`); six more mention the graph in prose.
- One hook targets it (`pretool/mcp/memory-validator`, `src/hooks/hooks.json:112`), and the Stop hook `session-summary.ts:64-86` builds a `mcp__memory__create_entities` suggestion. No hook writes to the graph.
- Three plugin settings files allow the tools (`ork`, `orkl`, `ork-creative`). Plugin `settings.json` permissions are not honoured by Claude Code, so these are cleanup, not behaviour.
- 8 files under `tests/` and `evals/` reference the tools. Five docs pages describe the graph, and `docs/site/content/docs/memory/graph-memory.mdx` still calls it the primary store.
- The server is not shipped by this repository. It is configured in a local, gitignored `.mcp.json`, and the maintainer's worktree tooling leaves `.mcp.json` out of sparse checkouts, so in a worktree session the graph tools do not exist at all. `remember/SKILL.md:52` says the graph "always works"; in a worktree it silently does nothing.
- The maintainer's local graph holds 20 entities and 0 relations. Typed relations are the one capability the graph has that native memory files lack, and they are unused.

The earlier keep verdict for the graph rested on "Claude Code has no mechanism for this". That premise no longer holds, so the graph moves from keep to retire-after-rehoming.

## Decision: four steps, in order

1. **Re-home.** `/ork:remember` writes a native memory file plus its `MEMORY.md` index line (the path it already documents as a fallback) and drops "Requires memory MCP server" from its compatibility line. `/ork:memory` reads `MEMORY.md` and greps the memory directory. `memory-fabric` is merged into `/ork:memory` or removed. Nothing else changes in this step, so every skill keeps working.
2. **Remove the graph surface.** Drop graph tools from the `allowed-tools` of the ~20 skills, the `debug-investigator` grant and the six prose mentions, the `memory-validator` hook (both `hooks.json` and the entries map), the graph suggestion in `session-summary.ts`, the three settings allows, the optional headless writeback paths (`staleness_cron.py`, the assess and review-pr writebacks), the 8 test and eval files, and the docs pages. One PR per concern, each green on its own.
3. **Maintainer decides the data.** Before any switch-off: migrate the 20 live entities (and any older backup the maintainer holds) into memory files, or knowingly drop them. This step is irreversible in one direction and is not automated.
4. **Maintainer switches the server off.** Remove the `memory` block from the local `.mcp.json` and mark the HQ-side retirement plan item done. Only after steps 1 to 3 have landed.

## Consequences

- One memory store instead of two. Recall works the same in the primary checkout and in worktrees.
- Skills stop declaring tools that are absent in most sessions.
- Users outside this repository who configured the graph themselves keep their data; OrchestKit simply stops reading and writing it. The docs change in step 2 says so, and the CHANGELOG entry for that release names it as a breaking change for anyone relying on `/ork:remember` output in the graph.

## Risks

- **Outside users.** OrchestKit is public and its docs call the graph primary. Some users may depend on it. Not measured.
- **Partial removal.** Removing tools from skills before step 1 lands breaks `/ork:remember`. The order above is the mitigation.
- **Headless writebacks.** The optional writeback paths may feed a downstream workflow. Not checked; step 2 removes them only after that is confirmed.

## Rejected

- **Keep both stores.** Two stores with different reach is how `/ork:remember` came to write where nothing reads.
- **Remove the graph in one PR.** Too large to review, and it mixes a reversible code change with an irreversible data decision.
- **Migrate native memory into the graph instead.** Moves data away from the store Claude Code loads by itself, and keeps the worktree gap.

## Not confirmed

- Usage counts of graph calls versus native memory calls across transcripts: maintainer-supplied, not re-measured here.
- Whether an older graph-to-knowledge-base migration ever ran after 2026-08-16.
- Which of the conflicting `enabledMcpjsonServers` / `disabledMcpjsonServers` entries in the maintainer's local settings Claude Code honours.
