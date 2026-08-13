# CC 2.1.231 adoption triage

**Date**: 2026-08-13
**Issue**: none (no `CC adoption` milestone issue existed for this release; same as the 2026-08-11 2.1.227 entry)
**Range**: 2.1.231 (1 bullet). **2.1.230 was never published.**
**Prior state**: `latest_known` 2.1.229, snapshots stopped at 2.1.229, installed binary already 2.1.231.
**Floor**: unchanged at 2.1.220. The 2026-07-25 `manual_override` pins floor=latest=2.1.220 until 2026-09-20, so this is a `latest_known`-only bump.

## Method

Both triage modes were run, deliberately, because each misses what the other catches:

1. **Changelog bullets** — `node scripts/cc-release-watch.mjs` first, because the ceiling gate reads
   `shared/cc-snapshots/`, not `shared/cc-support.json`. Every claim below is checked against the tree
   with a grep or a file read; no bullet is classified from prose alone.
2. **Binary contract diff** — the shipped `darwin-arm64` binaries for 2.1.229 and 2.1.231 were unpacked
   and diffed on the three axes ork's gates key off, replicating the method established in the
   2026-08-11 2.1.227 triage.

Running both closes the limit the 2026-08-11 entry recorded against itself ("it covers the contract
surface, NOT the release's changelog bullets").

## 2.1.230 does not exist

`npm view @anthropic-ai/claude-code versions --json` returns `2.1.228, 2.1.229, 2.1.231` for the range —
no `2.1.230`. `cc-release-watch.mjs` independently parsed 363 versions from the upstream CHANGELOG and
reported exactly one new version, `2.1.231`. This is the third time npm has skipped a patch in this line
(2.1.192 and 2.1.213 were the earlier two, both already recorded in `shared/cc-support.json`).

Recorded so a future reader does not go looking for a 2.1.230 triage that was never possible.

## Verdict

| Release | Bullets | ADOPT | NO-OP (verified) |
|---------|---------|-------|------------------|
| 2.1.230 | n/a | n/a | never published |
| 2.1.231 | 1 | 0 | 1 |

No ork code change is forced. `latest_known` advances 2.1.229 -> 2.1.231; the floor does not move.

## The single bullet, and why it is a no-op for ork

> Fixed MCP OAuth sign-in failing with a redirect URI mismatch for servers that use a pre-registered
> OAuth client, such as Slack

This is a fix to CC acting as an **MCP OAuth client**. It has no ork surface for one structural reason:
ork ships no MCP server that speaks OAuth at all.

**Proof.** `.mcp.json` declares 8 servers and contains zero `"type"` keys, so every one of them is
`stdio` by omission. OAuth is reachable only over the `http`/`sse` transports, which require a `url`
field; none is present:

```
$ grep -c '"type"' .mcp.json
0
$ python3 -c "import json; d=json.load(open('.mcp.json'))['mcpServers']; \
    print([k for k,v in d.items() if v.get('url')])"
[]
```

The 8 servers are `context7`, `sequential-thinking`, `memory`, `tavily`, `21st-dev-magic`, `fal`,
`ork-elicit`, `hq-knowledge` — all stdio subprocesses.

### Considered and declined: a note in `mcp-patterns/rules/auth-oauth21.md`

This was the one plausible doc adoption, and it is being declined on purpose rather than silently
skipped.

`src/skills/mcp-patterns/rules/auth-oauth21.md` is ork's OAuth 2.1 guidance and does touch this area —
line 124 carries a `redirect_uris: ["http://127.0.0.1:3000/callback"]` example. Three reasons not to
extend it:

1. **The file is already over budget.** It is 167 lines against the 150-line hard max for rule files in
   `.claude/rules/skill-authoring.md`. Adding content deepens an existing violation.
2. **The distinction is already drawn correctly.** Line 117 already labels the block
   "Dynamic Client Registration (RFC 7591) — fallback when no pre-registration", which is exactly the
   pre-registered-vs-DCR split 2.1.231's fix is about. The guidance is not stale.
3. **Wrong audience.** The rule teaches authoring MCP *servers*. 2.1.231 fixes a *client*-side redirect
   URI mismatch in CC itself. A CC-client changelog note in a server-authoring rule is scope creep.

Logged here instead, which is where a future reader will look.

### Related: 2.1.229 -> 2.1.231 is a fix-then-regression-fix pair

Worth recording because the two releases only make sense together. 2.1.229 shipped
"Fixed MCP OAuth with strict authorization servers by using `127.0.0.1` instead of `localhost` in the
redirect URI". 2.1.231 then fixes redirect URI mismatch for servers with a **pre-registered** OAuth
client. A pre-registered client has its redirect URI registered as an exact string, so the 2.1.229
loopback-spelling change broke exactly the clients that could not re-register.

Neither release reaches ork (no OAuth transport), but anyone running CC against a `url`-transport MCP
server behind Slack-style pre-registration wants both fixes, i.e. 2.1.231 and not 2.1.229 alone.

## Binary contract-surface diff (2.1.229 vs 2.1.231)

The shipped `@anthropic-ai/claude-code-darwin-arm64` packages for both versions were unpacked (84 MB
each) and their string tables extracted (~45 MB each), then compared as SETS, not line diffs.

| Axis | 2.1.229 | 2.1.231 | Delta |
|---|---|---|---|
| distinct hook-event tokens | 15 | 15 | **identical set** |
| distinct quoted sandbox/workflow/permission keys | 23 | 23 | **identical set** |
| `additionalContext` occurrences | 46 | 46 | **0** |
| string-table size | 45,173,647 B | 45,252,803 B | +79,156 B (+77 KB) |

`diff` over the sorted unique sets returned empty for both the hook-event axis and the settings-key
axis. Nothing was added and nothing was removed on either.

The string table still grew by ~77 KB, so 2.1.231 is not an empty release — but none of that growth
touches ork's hook events, its `additionalContext` contract, or the settings keys ork reads.

### Honest limits of this diff

Recorded so nobody reads these numbers as broader or more comparable than they are:

1. **The absolute counts are NOT comparable to the 2026-08-11 2.1.227 triage** (which reported 31 hook
   events and 29 settings keys). That triage extracted from `hook_event_name` call sites; this one
   probes a fixed allowlist of known event names and quoted key patterns. Different probe, different
   denominator. **The delta is the finding, not the absolute count** — and the delta is zero on every
   axis.
2. **Contract surface only.** This diff says nothing about CLI, UI, or model-only behavior. That gap is
   covered here by the changelog-bullet triage above, which is exactly why both modes were run.
3. **darwin-arm64 only.** Other platform builds were not fetched or compared.
4. The extraction ran on a locally downloaded copy via `npm pack`; nothing was installed globally, so
   the operator's own CC install was never modified.

## Override renewal (separate decision, same PR)

Done at the operator's explicit request while this adoption was in flight, because the previous
expiry sat 38 days out and nothing surfaced it except a buried field in `shared/cc-support.json`.

`manual_override.expires` **2026-09-20 -> 2026-11-20**.

This is a **deadline extension only**. `latest`, `supported_floor` and `drop_after` stay at
2.1.220 / 2.1.220 / 2.1.219 and are deliberately NOT renewed at the current head. That is the
material difference from the 2026-07-10 and 2026-07-25 entries, which renewed the strict pin AT head
and moved the floor with it. Moving the floor to 2.1.231 would break every user on 2.1.220 through
2.1.229, so it stays a separate, deliberate decision.

What the extension buys: on lapse, `.github/workflows/cc-support-window-bump.yml` resumes the
steady-state `policy` field (latest + 3 previous minors) and recomputes the floor with no human in
the loop. The `policy` field is left untouched, as in every prior entry, so that resumption still
works correctly whenever the override is finally allowed to expire.

## Files changed

- `shared/cc-support.json` — `latest_known` 2.1.229 -> 2.1.231, `manual_override.reason` appended
- `shared/cc-snapshots/2.1.231.md` — new, written by `cc-release-watch.mjs`
- `shared/cc-adoption-gaps.json` — 2.1.231 entry added by `cc-release-watch.mjs`
- `shared/gh-issue-args.json` — `latest_new_version` 2.1.229 -> 2.1.231
- `src/hooks/src/lib/cc-version-matrix.ts` — `LATEST_KNOWN_CC` stamped 2.1.229 -> 2.1.231
- `src/hooks/dist/lifecycle.mjs`, `plugins/ork/hooks/dist/lifecycle.mjs` — rebuild output
- `docs/audits/cc-adoption-2.1.231-triage-2026-08-13.md` — this file
- `docs/chore--cc-adopt-2.1.231/` — PR playground
