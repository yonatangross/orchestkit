# CC 2.1.223 to 2.1.226 adoption triage

**Date**: 2026-08-08
**Issue**: #3334
**Range**: 2.1.223, 2.1.224, 2.1.225, 2.1.226 (66 bullets)
**Prior state**: `latest_known` 2.1.222, four releases untriaged, `shared/cc-snapshots/` stopped at 2.1.222 while the installed binary was 2.1.226.
**Floor**: unchanged at 2.1.220. The 2026-07-25 `manual_override` pins floor=latest=2.1.220 until 2026-09-20, so this is a `latest_known`-only bump.

## Method

Snapshots were pulled first (`node scripts/cc-release-watch.mjs`), because the ceiling gate reads
`shared/cc-snapshots/`, not `shared/cc-support.json`. Every claim below was then checked against the
tree with a grep or a file read. No bullet was classified from changelog prose alone. Where a bullet
is called a no-op, the command that proves it is recorded next to it.

## Verdict

| Release | Bullets | ADOPT | NO-OP (verified) |
|---------|---------|-------|------------------|
| 2.1.223 | 20 | 3 | 17 |
| 2.1.224 | 32 | 5 | 27 |
| 2.1.225 | 14 | 2 | 12 |
| 2.1.226 | 1 | 0 | 1 (featureless) |

10 adoptions, all documentation-layer. No ork code change is forced by this range. Two of the
adoptions retire a claim ork was actively making that had become false.

## Adoptions

### 1. `/review` is now an alias of `/code-review` (2.1.223)

`src/skills/review-pr/SKILL.md:111` documented a split that CC drew in 2.1.202 and has now removed:
"the built-in `/review` is a fast single-pass correctness-bug review; the multi-agent review is now
`/code-review`", closing with "Quick pass → built-in `/review`". As of 2.1.223 `/review` routes to
`/code-review`, and `/code-review` with no level reuses the last level typed. The note therefore
routed the model and the reader to a distinction that no longer exists.

Rewritten to describe one command whose depth is its level, including `--fix` and `ultra`. This is
the second time a triage has had to correct this same paragraph; the 2.1.202 note in
`shared/cc-support.json` records the first.

### 2. The 200-subagent-per-session cap is gone (2.1.224)

`shared/cc-support.json` has asserted since 2026-07-18 that ork "caps subagents at 6-12 (below the
new 200 ceiling)", used as an immunity argument during the 2.1.209-214 sweep. That ceiling was
removed in 2.1.224. Concurrency and depth limits still apply, which makes spawn **depth** the only
structural limit left and raises the value of #3324 (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`, still
0 hits estate-wide). Corrected in the matrix and in the new `manual_override` note.

### 3. `crossSessionInbound` and `dialogExpiry` (2.1.224)

Both settings keys are new and ork ships neither. Verified: zero matches for
`crossSessionInbound|dialogExpiry` across `src/` and `manifests/`. Consequence today is not neutral,
it is "whatever the permission mode implies": a session running with bypassed permissions **holds**
every inbound peer message for approval, and a prompting session delivers them. A `-p` worker cannot
show the approval dialog at all.

Documented as a matrix row. Choosing the value ork should ship is a policy decision, not a triage
outcome, and has no issue yet. Filed as follow-up (see below).

### 4. Cross-session `SendMessage` and `ListAgents` (2.1.224), extended cross-machine (2.1.225)

2.1.224 added peer-session messaging with `ListAgents` for discovery. 2.1.225 then allowed
`SendMessage` to **start** a conversation with a Remote Control session on another machine by name,
rather than only reply to one.

This materially escalates #3316. That issue was filed against a same-machine blast radius: 34 of 36
ork agents grant `SendMessage`, 0 grant `ListAgents`, and 10 instruct a direct peer send in prose.
With 2.1.225, an agent that guesses a name is no longer confined to this machine. Recorded on #3316
rather than duplicated into a new issue.

Two related fixes land in ork's favor: `SendMessage` no longer reports "Message sent" when the
inbox write failed (2.1.224), and held messages in headless sessions no longer park forever without
notice or expiry (2.1.225), which matters for `bare-eval` and `ci-sentinel`.

### 5. Sandbox credential masking, and the trailing-slash trap (2.1.224)

`sandbox.credentials` gains `extract`, `onExtractNoMatch`, `decode: "jwt"` with `maskClaims`, and
`awsPairs`/`sigv4`. `src/skills/security-patterns/SKILL.md` documents this key with `mode: deny`
only, so the section was extended, with the two constraints that decide usability: these require
`network.tlsTerminate`, and they are honored only from user, managed, or `--settings` scope. A
plugin-shipped or project-scoped value is ignored, so ork **cannot** ship them as a baseline the way
it ships the deny list.

Separately, 2.1.224 fixed sandbox deny entries written with a trailing slash (`denyRead: "~/.aws/"`)
being silently bypassable on Linux and macOS. **ork was never affected**: `src/settings/ork.settings.json`
ships `["~/.aws/credentials", "~/.ssh/*", "~/.gnupg/*"]` and `doctor/references/sandbox-posture.md`
recommends `["~/.ssh", "~/.aws", "~/.config/gh"]`. No trailing slash anywhere. Recorded as an
explicit authoring guard because #3311 is about to add five more `Read()` credential denies, and the
failure mode is a rule that parses, reports clean, and protects nothing.

Also in ork's favor: sandbox violation details now appear in Bash tool results, so a denial is no
longer an unexplained command failure. That removes a real cost from #3311 and #3322.

### 6. Context-window enforcement changes (2.1.223)

`CLAUDE_CODE_DISABLE_1M_CONTEXT` now holds every model with a native 1M window to 200K rather than a
fixed list, with a startup warning when auto-compaction is not holding the session. New env var
`CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT` restores unbounded growth on unrecognized
model IDs. `audit-full/SKILL.md:38` already tells users to unset the first; its guidance stays
correct with a wider blast radius. ork sets neither variable.

### 7. `archive` plugin source (2.1.224)

Plugins can install from a zip over HTTPS with optional SHA-256 pinning, without git or npm. ork's
marketplace entry uses a local path source. This is an additional distribution channel with
supply-chain pinning, recorded as a matrix row and an option, not a defect.

## Verified no-ops

Each of these is a security or behavior fix that reads as though it should touch ork, and does not.
The proof is recorded so the next sweep does not re-derive it.

| Bullet | Release | Why it is a no-op |
|--------|---------|-------------------|
| Workflow dynamic `import()` sandbox escape | 2.1.223 | ork ships 3 workflow scripts (`audit-full-mapreduce.mjs`, `skill-fitness.mjs`, `heal-loop.mjs`). Zero `import(` across all three. Nothing regresses; treat dynamic `import()` as unavailable when authoring new ones |
| Agent `bypassPermissions` ignored org disable policy | 2.1.223 | Zero `bypassPermissions` in `src/agents/`. No ork agent has ever declared it |
| Bash permission bypass via crafted command | 2.1.223 | CC-side hardening on the same surface ork's normalizer covers (#3288/#3289). ork's guards stay load-bearing because they encode ork-specific deny intent CC has no view of; this is belt-and-braces, not a retirement trigger |
| Tabs and invisible Unicode hiding a command from the approval dialog | 2.1.223 | Same class as ork's 2026-08-06 `\<NL>`-in-token finding. Upstream closure, no ork surface |
| `denyRead` trailing-slash bypass | 2.1.224 | ork's shipped and recommended values carry no trailing slash |
| Long (>200 char) project paths crossing session directories | 2.1.224 | Longest sanitized project dir on this machine is 93 chars; the `.worktrees/<task>` convention adds ~15 |
| `modelOverrides` non-Anthropic keys treated as canonical | 2.1.223 | Zero `modelOverrides` in ork settings |
| `strictKnownMarketplaces`/`blockedMarketplaces` owner wildcards | 2.1.223 | ork documents these in `doctor/references/version-compatibility.md` but ships no value; the wildcard form is an operator convenience |
| Managed-settings env merge, Linux `denyWrite` cwd, gateway model discovery, `/cd` resume, malformed diagnostics attachment, `git push` parse hang | 2.1.223 | CC-internal |
| Remote Control, Wayland clipboard, paste recall, VSCode, feedback survey, Bedrock region prefix, self-hosted runner | 2.1.224-225 | CC-internal or off ork's surface |
| Auto mode no longer counts a safety-filter refusal toward the consecutive-block limit | 2.1.225 | No ork surface tracks CC's consecutive-block budget. Recorded because it changes the denial dynamics ork's auto-mode guards operate inside (#3331) |
| 2.1.226 in full | 2.1.226 | Featureless: "Bug fixes and reliability improvements" |

## Follow-ups

1. **No issue exists** for deciding ork's `crossSessionInbound` / `dialogExpiry` posture. The keys are
   documented now; the policy is unowned.
2. **#3316** gains a cross-machine dimension from 2.1.225 and should be re-read with that in mind.
3. **#3324** is now the only structural subagent limit after the 200 cap removal.
4. **#3311** should land its credential denies without trailing slashes, and can now rely on sandbox
   violation details appearing in Bash results.

## Files changed

- `shared/cc-snapshots/2.1.223.md`, `2.1.224.md`, `2.1.225.md`, `2.1.226.md` (new)
- `shared/cc-adoption-gaps.json`, `shared/gh-issue-args.json` (regenerated by release-watch)
- `shared/cc-support.json` (`latest_known` 2.1.222 to 2.1.226, plus `manual_override` note)
- `src/skills/doctor/references/version-compatibility.md` (20 new matrix rows)
- `src/skills/review-pr/SKILL.md` (the `/review` alias correction)
- `src/skills/security-patterns/SKILL.md` (credential masking options, trailing-slash guard)
