# Issue Triage — 2026-06-16 (Wave 0)

Full triage of all **98 open issues**, verified against the live repo (feature-detected, not trusted from issue text). Five parallel agents covered the milestone clusters; every classification below was confirmed by reading the actual source/PR, not the issue body.

Interactive dashboard: `triage-playground.html` (roadmap, milestone burndown, filterable table).

## Classification (98 issues)

| Class | Count | Meaning |
|---|---|---|
| Done-but-open | 19 | Shipped in code, never auto-closed (the `closes #N` keyword bug) |
| Valid | 35 | Still relevant + actionable |
| Stale | 31 | Old/speculative/superseded-different — needs a keep/close/rescope decision |
| Obsolete | 11 | Premise no longer holds |
| Rolling | 2 | Intentionally open trackers (#1881, #2435) |

**Root cause of the bloat:** merged PRs (notably #1604) closed issues in prose ("closing 5 of 7") with no per-issue `closes #N` keyword, so GitHub never auto-closed them. 19 issues are done-in-code but still open.

## Wave 0 — this PR closes 29 (19 done + 10 obsolete)

`#2376` is deliberately kept open as an upstream-blocked tracker (`anthropics/claude-code#16424` — `parent_agent_id` still absent through CC 2.1.177).

### Done-but-open — shipped, verified on `origin/main` (19)

| Issue | What shipped | Evidence |
|---|---|---|
| #1892 | round-2 yg-mcp-core consumers | 3 scripts exist (PR #1898); owner "safe to close" |
| #1875 | mcp_core.client in brainstorm/assess/memory | 3 scripts exist (PR #1889) |
| #1873 | /ork:cover manual-worktree pattern | cover/SKILL.md L259-324 (PR #1835) |
| #1246 | delete-code audit per CC version bump | cc-version-bump.yml + CONTRIBUTING checklist |
| #1239 | adopt CLAUDE_ENV_FILE pattern | README + settings-reload.ts getEnvFile() |
| #1289 | bump to v8.0.0 architecture overhaul | shipped 2026-05-22; now 8.47.1 |
| #1254 | SQLite state backend | session-registry.ts node:sqlite (#1920) |
| #690 | model delegation tracking hook | model field @ unified-dispatcher.ts:292 |
| #1083 | SearchWithIntent (Cmd+K) | superseded by unified Orama search (#2278) |
| #2284 | Wikidata entity + P856 | Q140128295 wired into SAME_AS, verified live |
| #2286 | GPT Store + MCP registries | SAME_AS lists Smithery/mcp.so/skills.sh (#2378/#2379) |
| #2287 | seed citation corpus | drafts staged; distribution → platform#4519 |
| #2288 | category share-of-voice | on-site /compare + /alternatives shipped (#2323) |
| #1561 | /ork:dev --share via portless --tailscale | dev/SKILL.md L41,53-57 (PR #1604) |
| #1562 | portless zero-config monorepo | dev/SKILL.md L59-61 (PR #1604) |
| #1563 | Clerk emulator in setup | emulate-seed/SKILL.md L100,115 (PR #1604) |
| #1565 | /ork:demo-producer --live | demo-producer/SKILL.md L44-66 (PR #1604) |
| #1557 | wterm decision (track-only) | check-labs-versions.mjs TRACK_ONLY tier (PR #1604) |
| #729 | Phase 1 gallery UX fix | spinner gone, video-gated, off homepage (2026-06-10) |

### Obsolete — premise no longer holds (10)

| Issue | Why obsolete |
|---|---|
| #1847 | notification→terminalSequence: proven regression (OSC silent in Terminal/VS Code/tmux); osascript is the justified keep |
| #1290 | lib/ reorg (54→41): lib/ now has 79 files; superseded by the entries/ map architecture |
| #1287 | core/dispatcher.ts: no such file; dispatcher is legacy/dead; replaced by entries/ registry |
| #1255 | persistent daemon: conflicts with the hard "no native deps in hooks" decision; node:sqlite chosen instead |
| #1327 | pressure-test RED-GREEN: runner+scenarios exist but results/ never created; framework abandoned |
| #2265 | failure-mining: depends on headroom (#2264) firing live, which it cannot (CC won't fire PostToolUse for mcp__*) |
| #2266 | compression-quality gate: gates a feature blocked at the CC layer |
| #696 | per-tool timing: superseded by CC-native OTEL duration_ms (analytics Panel 4) |
| #2289 | Wikipedia article: web-research verdict PREMATURE, defer 12-24mo (WP:NSOFTWARE) |
| #1566 | wterm inline live demos: premise required #1557="build skill", but it resolved track-only |

## Next waves (not in this PR)

- **Wave 1 — P1 keystones:** #1139 (KG auto-persist), #1017 (skill outcome scoring), #2351 (memory VERIFY loop), #1264 (hooks.json generator), #2302 (record headroom defer decision).
- **Wave 4 — M76 Video:** due 2026-06-30 is NOT achievable (critical path #733→#730→#731→#732; #730 unstarted, CDN coverage regressed to 1/14). Recommend descope to a "TerminalFlow reusable" mini-milestone (#733+#735) and slip video production.

See the playground for the full 8-wave roadmap and per-issue actions.
