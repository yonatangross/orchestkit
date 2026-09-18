# CC adoption: 2.1.273 to 2.1.277 (2026-09-18)

Lane L1 of the cc-mods adoption plan (cc-mods-adoption-2026-09-18.md section 8).

Base: `chore/cc-adoption-2-1-277` off origin/main.
The support file and version constant both started at latest_known 2.1.272.
The supported floor, latest and drop_after remain 2.1.251, 2.1.251 and 2.1.250.
The manual override expires on 2026-11-20.

## Release dispositions

Source: the [upstream CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), fetched through the GitHub contents API on 2026-09-18 (64, 108, 96, 1 and 87 bullets per release).

| Release | Disposition | Scope |
| :--- | :--- | :--- |
| 2.1.273 | Documentation only | Permission-checker fixes on documented surfaces; subagent result loss; worktree-copied scheduled tasks; partial revert of a 2.1.268 deny-rule change. |
| 2.1.274 | Documentation only | MCP transport fixes; worktree-isolation nested-expansion refusal; `CLAUDE_CODE_MCP_STARTUP_WAIT_MS` deferred. |
| 2.1.275 | Documentation only | claude.ai skills/plugins sync (opt-outs deferred to configure); marketplace credential-leak and npm install-script fixes. |
| 2.1.276 | Conditional noop | Single fix for the 2.1.275 `ANTHROPIC_BASE_URL` advisor-tag 400 regression; matters only on proxied setups ork documents. |
| 2.1.277 | Doc adoption | Built-in agents-md module live without a flag (AGENTS.md read when no CLAUDE.md sits on the walk; CLAUDE.md wins; four `instructionFiles` values; `/config` "Project instructions"); five-tier 92 plus 33 event engine; `claude plugin test` absent; TaskOutput removed. |

The doctor matrix records all five releases. Setup docs name the AGENTS.md fallback; `chain-patterns/references/monitor-patterns.md` records the TaskOutput removal. The section 5 codeword probe is checked in as `tests/canary/agents-md-fallback.sh` and printed VERIFIED on both arms on this box.

## Generated artifacts

The existing support stamper propagates latest_known to the TypeScript constant.
Snapshots for all five releases are committed under `shared/cc-snapshots/` (the version-ceiling test derives its ceiling from them).
The gaps ledger records one entry per release and preserves every existing entry.
`shared/gh-issue-args.json` tracks latest_new_version for the release watcher.

## Test updates

No test pins latest_known to 2.1.272 on this base, so no test assertion needs an edit.
Local verification is limited to the floor consistency tests, the version-ceiling test, JSON validity and the Lab manifest check. CI supplies the broader verification.
