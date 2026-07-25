# Opus 5 adoption + CC 2.1.215-2.1.220 triage + floor renewal to 2.1.220

Date: 2026-07-25. Branch: `feat/opus5-cc220-adoption`. Base: `5dc0175c8`.
Repo version at start: 8.84.10. CC installed locally: 2.1.220.

Every load-bearing claim below was verified by executing code or reading the file at
`origin/main`, not inherited from a prior audit. Where a prior audit was wrong, the
refutation is recorded rather than quietly dropped.

## The headline defect: Opus 5 was being priced as Sonnet

CC 2.1.219 made `claude-opus-5` the default Opus model. `models.vocab.json`, which the repo
declares the single source of truth for model identity and pricing, had no entry for it.

`cost-estimator.ts` `getPricing()` resolves in three steps: exact key, then a substring
partial match, then an unknown-model fallback to Sonnet. The partial match is
`key.includes(k) || k.includes(key)`. Neither `claude-opus-5` nor `claude-opus-4-8`
contains the other, so no opus key matched and resolution fell to the Sonnet fallback.

Measured by executing the real resolution logic against the real vocab file, before the fix:

| model | resolved via | priced |
|---|---|---|
| `claude-opus-5` | FALLBACK to `claude-sonnet-5` | $3 / $15 |
| `claude-opus-5[1m]` | FALLBACK to `claude-sonnet-5` | $3 / $15 |
| `claude-mythos-5` | FALLBACK to `claude-sonnet-5` | $3 / $15 |
| truth | | **$5 / $25** |

A 40% undercount on input and output for every session on the default model. Because Opus 5
prices identically to Opus 4.8, no total moved and nothing looked wrong.

Two things made it invisible:

1. **Identical pricing masked it.** Had Opus 5 been priced differently from 4.8, the
   partial-match miss would still have happened, but the resulting number would have looked
   wrong to someone reading a cost report.
2. **The test suite pinned the wrong two things.** It pinned the pricing *table* (every entry
   has correct values) and it pinned the *fallback* (unknown models go to Sonnet). It never
   asserted the thing in between: that a model ork actually supports never reaches the
   fallback. That is the assertion that was missing, and it is now present.

This is the second occurrence of the same failure mode. The suite's own header documents the
first: "the missing claude-fable-5 pricing entry silently fell back to sonnet pricing ...
underbilling by 70%". The fable fix added canaries for fable specifically. It did not close
the class, so the class recurred.

### The guardrail, and proof it is not vacuous

The new canary derives an expected per-MTok tier from each `fullIds` entry's family and
asserts `getPricing()` returns it. Removing the `claude-opus-5` pricing entry and re-running
reproduces the original bug as a test failure:

```
AssertionError: claude-opus-5 priced off-tier: expected 3 to be 5
Tests  4 failed | 7 passed (11)
```

A guardrail that cannot fail is theater, so this was verified by actually breaking it.

### Absence from `fullIds` was a separate, independent defect

`claude-opus-5` was also missing from `fullIds`, and `tests/skills/structure/test-model-id-vocab.sh`
validates every model ID appearing in `src/skills` and `src/agents` against that list. The
repo therefore **could not name its own default model** in any skill doc or agent frontmatter
without failing CI.

### The recency ratchet did its job

Advancing the `opus` alias immediately turned `tests/skills/structure/test-model-recency.sh`
red with 6 superseded `claude-opus-4-8` recommendations across 4 files. All 6 were genuine
"use this model" recommendations rather than historical references, so all 6 were retargeted
and the ratchet returned to its 0/0 baseline. This test is the reason an alias advance cannot
silently leave the docs behind, and it is now recorded in the vocab's own consumer list,
where it was previously unlisted.

## CC 2.1.215-2.1.220 triage

The cc-watch pipeline could not do this. `shared/cc-adoption-gaps.json` at `origin/main`
carries `parse_failed: true` with an empty `features` list for both 2.1.219 and 2.1.220, and
issues #3139 and #3052 are the resulting "manual triage needed" tickets, filed because the
LLM extraction step had no usable `CLAUDE_CODE_OAUTH_TOKEN`. The snapshots themselves *do*
exist (landed in #3140) - an earlier read of this repo that said otherwise was looking at a
stale local checkout, one commit behind `origin/main`.

2.1.220 is featureless: "Bug fixes and reliability improvements".

2.1.219 is the substantive release:

| 2.1.219 change | ork verdict |
|---|---|
| `claude-opus-5` is the default Opus model, 1M context, fast mode $10/$50 | **ADOPTED.** See above. |
| Nested subagent spawning restored to depth 3 by default (was 1) | **Reverses 2.1.217.** See correction below. |
| Opus 4.7 removed from fast mode; `/fast` applies to Opus 5 and 4.8 | Recorded. `claude-opus-4-8` deliberately kept in `fullIds` and pricing as an active, fast-mode-capable model. |
| `DirectoryAdded` hook event | Not wired. Candidate only; see open questions. |
| `sandbox.network.strictAllowlist` setting | Not adopted this pass; overlaps ork's existing network-egress-guard and needs a real comparison first. |
| `workflowSizeGuideline` settings key | Not adopted this pass. |
| Dynamic workflows default to a medium (<15 agent) size guideline | Behavioral, no ork surface. |
| `mcp_server_errors` in headless stream-json init | No ork consumer. |
| Nested subagent forwarding in stream-json at depth 2+ | No ork consumer. |

## Corrections to the 2026-07-23 audit

That audit (`docs/chore--cc-adoption-2.1.215-218/findings.md`) was careful and mostly holds.
Four of its claims did not survive re-verification at HEAD, and they are recorded here
because inheriting them would have produced wrong work.

**1. "Nested spawning is off by default; chain-patterns Pattern 9 silently degrades to a
no-op."** Stale, not wrong-at-the-time. It was true of 2.1.217. **2.1.219 restored the
depth-3 default**, so Pattern 9's three-level delegation is correct again. Acting on this
finding would have meant documenting a limitation that no longer exists.

**2. "The 500-line SKILL.md limit has no enforcing test; three skills drifted past it."**
Refuted. `tests/skills/test-skill-length.sh` exists and enforces `MAX_LINES=520`. The cap was
raised 500 to 520 in #1865 for a documented reason. The skills at 517 / 509 / 504 are
passing legitimately, not drifting. The real defect is narrower and different: `implement`
sits at **517 against a 520 ceiling**, three lines of headroom, and
`src/skills/CONTRIBUTING-SKILLS.md` still says "under 500 lines" in three places, so the
authoring standard and the enforced gate disagree.

**3. `shared/cc-support.json` claimed `manifests/ork.json` derives the floor from it via the
stamp script.** False. That file carries no CC version field at all and is not a stamp
target. Corrected in the comment, which now names the five real targets and, separately, the
three surfaces that are hand-maintained on every bump.

**4. Three skill references claimed "the floor in `engines.claudeCode` guarantees the fix".**
False. `package.json` has no `engines.claudeCode` field; only `node`. The claims now point at
`shared/cc-support.json`, which is the actual source of truth.
`shared/rules/cc-support-policy.md` was already correct because it hedges with "when
present".

## The floor bump is a cascade, and the stamp script covers less than half of it

The floor moved 2.1.206 to 2.1.220 as a strict renewal: `floor = latest = latest_known`,
`drop_after = 2.1.219`. `shared/cc-support.json` is the only file edited by hand.
`scripts/stamp-cc-support.mjs` derived five files via seven replacers, all matched.

What the stamp script did **not** cover, and therefore had to be found and fixed manually:

| surface | count | why it matters |
|---|---:|---|
| CI installer pins `@anthropic-ai/claude-code@2.1.206` | 7 workflows | Each is documented as tracking the supported floor. CI would keep installing a below-floor CC. |
| `SKILL.md` `compatibility:` floors | **114 of 114** | `tests/manifests/test-cc-version-floor.sh` enforces these against the SoT with `SKILL_COMPAT_STRICT` defaulting to **1**, so the bump was a guaranteed hard CI failure until all 114 moved. |
| `.latest` fixture coupling | 2 files, ~20 assertions | `cc-support.json`'s own note warns these must move together. The synthetic fixture's top version must equal `.latest` or the release-watch recovery test finds no matching changelog entry. |
| floor prose in source and docs | 19 sites | "our floor is 2.1.206" statements that became false. |

The 114 `compatibility:` floors were the sharp edge. My own initial estimate was "about 30",
derived from a truncated grep; the floor test's failure output gave the real number. Of the
114, **83 carry only the floor** and **31 additionally state real per-skill dependencies**
(memory MCP server, gh CLI, network access, `agent-browser >= 0.25.0`, optional
stitch / 21st-dev-magic / storybook-mcp). A blanket delete would have destroyed the second
group, so only the version substring was rewritten.

`scripts/stamp-cc-support.mjs` now stamps those 114 automatically. Verified by regressing all
114 to 2.1.206 and running the stamper directly:

```
✓ src/skills/<slug>/SKILL.md :: compatibility floor — stamped 114, already in sync 0, no floor declared 0 (of 114)
stamp-cc-support: 114 mutation(s) applied
```

Idempotent on re-run (reports all in sync, zero mutations). It fails loud rather than
silently skipping if a `compatibility:` line declares a floor it cannot parse.

One implementation note worth recording, because it cost a debugging cycle: documenting the
new target as the literal glob `src/skills/*` + `/SKILL.md` inside the script's leading
block comment **terminated that comment**, because the glob contains `*` immediately followed
by `/`. The header then parsed as code. The doc now writes `<slug>` and says why.

## Class A vs Class B: why the version sweep was gated

Not every `2.1.206` in the tree is a floor claim. Two classes needed opposite treatment:

- **Class A, a claim about ork's floor**: "our floor is 2.1.206", "We floor at `2.1.206`",
  "at ork's floor (2.1.206)". These became false and were rewritten. 19 sites.
- **Class B, a statement about what the 2.1.206 release did**: matrix rows
  (`| EnterWorktree external-path confirmation | 2.1.206 | ... |`), release headings
  ("**CC 2.1.206 — external-worktree confirmation**"), and the skill-eval comment recording
  that a past pin sat "58 releases below the then-current 2.1.206 floor". Rewriting these
  would falsify history. Preserved.

A blanket find-and-replace would have corrupted every Class B site. The substitution was
gated on floor-claim phrasing appearing on the same line, and both the changed and preserved
sets were printed and reviewed before applying.

One Class B site needed rewording rather than a number change:
`chart-encoding-standard.md` said `/dataviz` is bundled at 2.1.198 "(above ork's 2.1.206
floor)". That was already backwards, since 2.1.198 is below 2.1.206, and at a 2.1.220 floor
the confusion compounds. It now states the actual implication: bundled since 2.1.198, which
is below the floor, so every supported session ships it.

## Environment defect found along the way

The primary checkout's `node_modules/@rolldown/` contains `binding-darwin-x64` on an
`arm64` host, so `vitest` cannot start there at all:

```
Error: Cannot find module '@rolldown/binding-darwin-arm64'
```

The worktree's own `npm install` produced the correct `binding-darwin-arm64`. This is
pre-existing and unrelated to these changes, but it means test runs in the primary tree are
currently broken and worth a separate fix. The repo's `scripts/check-install.sh` already
detects and explains the adjacent "worktree has no node_modules" case well.

## Deliberately not done

- **The `compatibility:` dedup.** 83 of the 114 lines carry only a floor that is derived from
  `cc-support.json` anyway, and could be deleted outright, with the other 31 trimmed to just
  their dependency text. That removes 114 lines of derived content from skill prompt context
  permanently. It also requires inverting the floor test's skill check from "must match SoT"
  to "must not declare a floor", which is a test-semantics change rather than a mechanical
  one. Automating the stamp was chosen instead.
- **The "Opus 4.8 is current/default" prose.** Roughly 8 skill files still assert Opus 4.8 as
  the default model or describe its effort behavior. These are now stale in substance, not
  just in version number, and correcting them means describing Opus 5's actual behavior
  (thinking on by default, disabled-thinking capped at `high` effort, full effort ladder,
  512-token prompt-cache minimum). That is prose rewriting, deliberately out of scope here.
- **`CONTRIBUTING-SKILLS.md` 500 vs the enforced 520.** Identified, not reconciled.
- **`DirectoryAdded` hook.** Not wired. `MessageDisplay` was previously reverted because
  `claude plugin validate` rejects unknown event keys in a plugin manifest, so the same risk
  applies and needs checking before any registration attempt.

## Open questions

1. Can `DirectoryAdded` be registered at all, or will `claude plugin validate` reject it the
   way it rejected `MessageDisplay`?
2. Does `sandbox.network.strictAllowlist` duplicate or complement ork's network-egress-guard?
3. Should the 83 pure-floor `compatibility:` lines be deleted now that the stamper makes
   keeping them cheap, or does cheap maintenance remove the reason to delete them?
