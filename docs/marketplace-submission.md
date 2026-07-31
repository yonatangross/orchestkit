# Official marketplace submission (OrchestKit)

Prep work for listing OrchestKit in Anthropic's curated Claude Code plugin
directory. Everything here is operator-gated: nothing has been submitted.

Researched and audited 2026-07-30 against live primary sources.

## 0. SUBMITTED 2026-07-31

Submitted via the Console form (platform.claude.com/plugins/submit) — the correct form
for individual authors; the claude.ai form requires a Team or Enterprise organization.
Confirmation screen: "Plugin submitted for review. Your plugin submission has been
received. The review team will evaluate it and may reach out for additional information."

Submitted values: slug `orchestkit`, display name OrchestKit, category development,
repo yonatangross/orchestkit, plugin path `plugins/ork`, homepage orchestkit.yonyon.ai,
license MIT, privacy policy https://orchestkit.yonyon.ai/privacy (verified live, HTTP 200),
contact yonaigross@gmail.com, supported platform **Claude Code only**.

Two corrections this submission surfaced:

1. **Target directory.** Approved submissions land in `anthropics/claude-plugins-community`
   after review, NOT the official marketplace. Per the Claude Code docs, the official
   marketplace is curated by Anthropic at its discretion, has no application process, and
   the submission form does not add plugins to it. Earlier framing in this doc as an
   "official marketplace submission" was wrong; the win here is a community listing.
2. **Claude Cowork was UNTICKED.** The form asks submitters to test each selected surface
   first. OrchestKit has never been tested in Cowork, and a grep for "cowork" across
   `plugins/` returns only the word "coworker" in prose. Cowork can be added later via a
   new submission once actually tested.

The form had no reviewer-notes field. The disclosure that block was written for lives in the
README section "What OrchestKit observes", which the automated reviewer reads from the cloned
repo — the reason PR #3205 was merged before submitting.

Two form fields this doc had not anticipated, recorded for next time: `Plugin description`
(prose, directory-facing) and `Example use cases` (numbered examples).

---

## 1. The verified process

Submission is a **web form**, not a pull request. Both Anthropic marketplace
repos say so explicitly, and both point at the same URL.

**Submit at: <https://clau.de/plugin-directory-submission>**

| Fact | Source |
|---|---|
| "To submit a new plugin, use the [plugin directory submission form](https://clau.de/plugin-directory-submission)." | [`anthropics/claude-plugins-official` README](https://github.com/anthropics/claude-plugins-official/blob/main/README.md), Contributing > External Plugins |
| "Pull requests opened directly against this repo are closed automatically. All changes flow from the internal review pipeline." | [`anthropics/claude-plugins-community` README](https://github.com/anthropics/claude-plugins-community/blob/main/README.md) |
| "A read-only mirror ... synced nightly from Anthropic's internal review pipeline." | same |
| "Every plugin listed here has been submitted via claude.ai, passed automated security scanning, and been approved for distribution." | same |

Corroborating evidence that PRs are the wrong channel: the official repo ships
`.github/workflows/close-external-prs.yml` and `external-pr-scope-guard.yml`, and
`validate-frontmatter.yml` is gated on
`github.event.pull_request.head.repo.full_name == github.repository`, so a fork PR
never even runs validation.

### Which directory to target

| Repo | What it is | Route |
|---|---|---|
| `anthropics/claude-plugins-official` | Curated directory. `/plugins` is Anthropic-authored, `/external_plugins` is third-party. 276 entries. | The form. OrchestKit would be an `external_plugins` entry. |
| `anthropics/claude-plugins-community` | Community marketplace, read-only mirror, ~1.5 MB registry. | The same form. |

One form feeds both; Anthropic's internal review decides placement. There is no
separate community-vs-official submission path.

### What Anthropic writes on our behalf

We do not author the marketplace entry. Reviewers generate it from the form and
pin it to a commit SHA. The shape our repo must support (verbatim pattern from
276 live entries, `git-subdir` is the dominant source type for a plugin living in
a subdirectory):

```json
{
  "name": "orchestkit",
  "description": "...",
  "author": { "name": "Yonatan Gross" },
  "category": "development",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/yonatangross/orchestkit.git",
    "path": "plugins/ork",
    "ref": "main",
    "sha": "<40-char commit sha>"
  },
  "homepage": "https://orchestkit.yonyon.ai/"
}
```

`category` must come from the set already in use: `development` (116 entries),
`productivity` (48), `database` (36), `monitoring` (19), `security` (17),
`deployment` (8), `design` (7). **`development`** is the right fit.

## 2. The review bar

Two gates, both worth reading in full before submitting.

### Automated security and privacy review

Source: [`.github/policy/prompt.md`](https://github.com/anthropics/claude-plugins-official/blob/main/.github/policy/prompt.md)
and [`.github/policy/schema.json`](https://github.com/anthropics/claude-plugins-official/blob/main/.github/policy/schema.json),
run by `scan-plugins.yml`.

The stated bar is *"handles user data responsibly, not merely isn't malicious."*
It reads the **entire shipped payload**, not just the loaded surface, explicitly
including `.claude/`, `scripts/`, `tests/`, and hidden directories, because a git
source clones the whole repo to the user's disk.

Verdict is `passes=false` if **any** of:

1. Part 1 finds malicious, deceptive, exfiltrating, or safety-circumventing behavior.
2. `has_broad_scope_hooks` is true.
3. `has_undisclosed_telemetry` is true.
4. `description_matches_behavior` is false **and** the mismatch involves hooks,
   telemetry, or data access.

Definitions that matter for us:

- `has_broad_scope_hooks`: true if any `UserPromptSubmit`, `PreToolUse`, or
  `PostToolUse` hook "runs without a project-relevance gate", regardless of
  whether it makes network calls. The examples given for a valid gate are
  environmental, not tool-based: "only fires if `vercel.json` exists, only if cwd
  is a Next.js project."
- `has_undisclosed_telemetry`: true if any hook or shipped code calls a non-MCP
  host without **explicit disclosure plus a documented opt-out** in the
  `plugin.json` description or top-level README.
- `description_matches_behavior`: false if a user reading only the install
  description "would be surprised by what you found."

### Structural validation

Source: [`validate-plugins` action](https://github.com/anthropics/claude-plugins-community/tree/main/.github/actions/validate-plugins),
which the official repo pins by SHA.

| Invariant | Rule | OrchestKit |
|---|---|---|
| I1 | `plugins[]` alpha-sorted by `name` | Anthropic's file, n/a |
| I2 | No duplicate `name` | pass |
| I3 | `description` 10 to 2000 chars, no edge whitespace | pass (424 chars) |
| I4 | `source.url` matches `^https://[A-Za-z0-9./_-]+$` | pass |
| I5 | External source has 40-char lowercase hex `sha` | Anthropic pins it |
| I6 | `plugins/<x>.json` has `.name == "x"` | n/a |
| I7 | PR does not edit assembled `marketplace.json` | n/a (form) |
| I8 | Vendored `source` path contains `.claude-plugin/plugin.json` | pass, `plugins/ork/.claude-plugin/plugin.json` |
| I9 | No shell metacharacters in `source` strings | pass |
| I10 | No hidden Unicode in `name` / `description` | pass |
| I11 | `name` matches `^[a-z0-9][a-z0-9-]{1,63}$` | pass |

Step 30 clones the plugin at its pinned SHA and runs `claude plugin validate`
against its `plugin.json`, "exactly as strict as the CLI, extra keys fail."

Local proof, run on this branch:

```
$ claude plugin validate ./plugins/ork
Validating plugin manifest: .../plugins/ork/.claude-plugin/plugin.json
Validating plugin: .../plugins/ork/CLAUDE.md
⚠ Found 1 warning:
  ❯ root: CLAUDE.md at the plugin root is not loaded as project context.
✔ Validation passed with warnings
```

### License

`validate-licenses.yml` requires Apache 2.0, but its trigger path is `plugins/**`,
which is Anthropic's own internal plugins. External plugins are excluded, and the
official README says "Please see each linked plugin for the relevant LICENSE file."
**OrchestKit's MIT license is fine.** No change needed.

## 3. Gap list

### Blocking

**B1. `has_broad_scope_hooks` is true under a literal reading. This is the single
material risk and it is architectural, not cosmetic.**

OrchestKit registers 152 global hook entries across 29 lifecycle events. Among
them: `UserPromptSubmit` with 5 handlers and no matcher, an ungated catch-all
`PreToolUse` block, and `PostToolUse` on broad matchers such as
`Bash|Write|Edit|Agent|TaskUpdate|TaskCreate|Skill|NotebookEdit`. None are gated
on project relevance in the sense the policy means, because the gates they enforce
are language- and framework-agnostic by design.

Not fixable by editing metadata. Three options, operator's call:

- **Submit and argue the scope.** The rule's own rationale is hooks that observe
  "sessions unrelated to the plugin's purpose." OrchestKit's stated purpose is
  general-purpose development workflow enforcement, so that set is arguably empty.
  This is the honest position and it is now documented in the README, but it
  depends on a reviewer accepting a purposive rather than literal reading.
- **Add a project-relevance gate**, for example fire only when a git repo or a
  recognised project manifest is present. Cheapest defensible narrowing, and it
  would still cover essentially every real session.
- **Split the plugin**: a skills-plus-agents plugin for the marketplace, hooks as
  a separate opt-in install. Highest cost, highest acceptance probability.

Recommendation: attempt submission as-is with the disclosure in place, since
rejection is recoverable and cheap, and the feedback tells us which reading
applies. Do not silently strip hooks; they are the product.

**B2. Disclosure gap. FIXED on this branch.** The previous `plugin.json`
description was "The Complete AI Development Toolkit, 105 skills, 36 agents, 218
hooks for full-stack development." That would not lead a user to expect hooks on
every prompt and tool call, which is the `description_matches_behavior=false`
test. Fixed by rewriting the description to state hook scope and the default-off
network posture, and by adding a "What OrchestKit observes" README section with
destinations, per-hook opt-outs, and the three opt-in network env vars.

### High, fixed on this branch

**H3. `agents/shared/status-protocol.md` had no frontmatter.** It is a shared
include, not an agent, but living in `agents/` made Claude Code register it as a
bogus `ork:shared:status-protocol` agent, and `claude plugin validate` warned on
it. The official repo runs `validate-frontmatter.ts` over `**/agents/*.md`.
Moved to `plugins/ork/shared/status-protocol.md` and rewrote the reference in all
43 files. Agent count is now exactly 36, matching the advertised number.

### High, operator decision required

**H1. RESOLVED 2026-07-30: operator chose `orchestkit`.** Submit the form with
`name: "orchestkit"`, `displayName: "OrchestKit"`. Local `plugins/ork` stays
unchanged (renaming would break existing self-hosted installs; the form field is
independent of the local directory name). Original finding follows.

The public slug would have defaulted to `ork`, and marketplace names are immutable. The
official README: "The `name` field in a marketplace entry is an immutable slug.
Once a plugin has been published, its `name` must not change." Users would type
`/plugin install ork@claude-plugins-official`. Every comparable external entry
uses a descriptive slug (`42crunch-api-security-testing`, `adobe-for-creativity`).

Recommend requesting **`name: "orchestkit"`** with `displayName: "OrchestKit"` on
the form. Deliberately not changed in this repo, because renaming the local
`plugins/ork` entry would break existing self-hosted installs. The submission
name is a form field and is independent of the directory name.

**H2. `.mcp.json` ships a 1Password reference to the operator's private vault.**

```
"tavily": { "args": ["-c", "TAVILY_API_KEY=$(op read 'op://Platform/Tavily-API-Key/credential') exec npx -y tavily-mcp@0.2.20"] }
```

Not an exfiltration finding: the credential is read locally and passed to Tavily's
own service, which is same-service use and explicitly on the policy's do-not-flag
list. But it is a credential-shaped string in a payload that gets cloned to every
user's disk, it is dead config for anyone who is not the operator, and a reviewer
grepping for `op read` will stop on it.

**RESOLVED 2026-07-30, and the finding was narrower than stated:** no `.mcp.json`
exists in the tracked tree (the operator's own is untracked/local). The only
tracked occurrence of the literal private-vault path was ONE unit-test fixture,
`src/hooks/src/__tests__/lifecycle/mcp-health-check.test.ts:56`, now genericized
to the same `op://<vault>/` placeholder the docs use. `op://<vault>/` placeholders
in docs/templates are intentional user-facing instructions and stay.

### Medium, no action taken

**M1. Clone weight.** 6,883 tracked files and a 7.5 GB `.git`, including a 1.1 MB
`CHANGELOG.md`. `git-subdir` still clones the entire repository, so first install
is slow. Not a documented rejection criterion, but it is a real first-impression
cost and it enlarges the security review surface. A `docs/` and `CHANGELOG` diet,
or history truncation, would help.

**M2. Defensive code that greps like offensive code.** Pre-empt these in the form's
notes field so a reviewer does not mis-triage:

- `plugins/ork/hooks/dist/pretool.mjs` contains `id_rsa`, `id_ed25519`, `.pem`,
  `.env`, `credentials.json`. This is `file-guard`'s **blocklist**, which denies
  writes to those paths. Verified: zero keychain, `~/.aws/credentials`, SSH-key, or
  browser-cookie **reads** anywhere in `plugins/ork`.
- Three files match "ignore previous instructions" style patterns:
  `skills/mcp-patterns/rules/security-injection.md`,
  `skills/testing-llm/examples/llm-test-patterns.md`, and
  `agents/ai-safety-auditor.md`. All are defensive content *about* prompt
  injection, which is what an AI-safety auditor skill is for.

**M3. `plugins/ork/CLAUDE.md` is not loaded.** Remaining validator warning. It is
a 61-line agent-routing index that the repo's own handoff notes already describe as
"advisory prose, not enforced." Converting it to a skill or deleting it is a
product call, so it was left alone.

**M4. `plugins/ork/skills/shared/` has no `SKILL.md`.** Holds shared assets, rules,
and a schema. The validator tolerates it; noted for completeness.

**M5. `engine` in `.claude-plugin/marketplace.json` is an unrecognised field.**
Claude Code ignores it. Affects only OrchestKit's self-hosted marketplace, not the
submission. Left as-is.

**M6. Two open Dependabot alerts, both outside the shipped plugin.**

| Severity | Package | Manifest |
|---|---|---|
| high | `brace-expansion` (DoS via exponential expansion) | `orchestkit-demos/package-lock.json` |
| medium | `@hono/node-server` (path traversal in `serve-static` on Windows) | `src/mcp-server/package-lock.json` |

Verified not reachable from the plugin: `plugins/ork/mcp-server/server.mjs` bundles
neither package (zero matches for `hono` or `serve-static`), and `plugin.json`
declares no `mcpServers`, so that bundle is not loaded at all. Both alerts sit in a
demos directory and an unbundled source tree.

They still ship, because a `git-subdir` source clones the whole repo, and a
reviewer landing on the repo's Security tab sees "1 high, 1 moderate" before
reading any of the above. Clearing them before submitting is cheap and removes an
avoidable first impression.

## 4. Pre-submission checklist

Before opening the form:

- [ ] **Decide H1**: submit as `orchestkit` (recommended) or `ork`. Immutable once live.
- [ ] **Decide H2**: `.mcp.json` `op://` reference stays, is genericized, or is gitignored.
- [ ] **Decide B1**: submit as-is with the scope argument, or add a project-relevance gate first.
- [ ] Merge this branch so the disclosure text is on `main` before a reviewer clones it.
- [ ] Re-run `claude plugin validate ./plugins/ork` on `main` and keep the output.
- [ ] Note the exact `main` commit SHA to hand to reviewers.
- [ ] Confirm <https://orchestkit.yonyon.ai/> is up, since it is the homepage a reviewer visits.

- [ ] Clear the two Dependabot alerts (M6). Neither reaches the plugin, but the
      repo Security tab is the first thing a reviewer sees.

Optional, improves odds:

- [ ] M1 clone-weight diet.
- [ ] M3 convert or drop the plugin-root `CLAUDE.md`.

## 5. Draft form answers

Reusable copy for the submission form. Field names are unverified because the form
is behind a login; map them to whatever it asks.

**Plugin name (slug):** `orchestkit`

**Display name:** OrchestKit

**Category:** development

**Repository:** <https://github.com/yonatangross/orchestkit>

**Plugin path within repo:** `plugins/ork`

**Homepage:** <https://orchestkit.yonyon.ai/>

**License:** MIT

**Author:** Yonatan Gross, <yonaigross@gmail.com>

**Short description:**

> AI development toolkit: 105 skills, 36 agents, and 218 quality-gate hooks for
> full-stack work. Skills cover AI/LLM integration, backend, frontend, security,
> testing, and infrastructure patterns. Hooks enforce quality gates on every
> session, prompt, and tool call, and write metrics to a local file. No network
> calls by default.

**Notes for reviewers** (paste as-is; it front-runs all three likely findings):

> **Hook scope, deliberate and disclosed.** OrchestKit registers hooks on
> `UserPromptSubmit`, `PreToolUse`, and `PostToolUse` that are not gated to a
> framework or project type. That is intentional: the gates they enforce (blocking
> writes to `.env` and private keys, protected-branch guards, file-size limits,
> agent status protocol) are language-agnostic, so a `vercel.json`-style relevance
> gate would defeat the purpose. The README section "What OrchestKit observes"
> documents the full lifecycle-event list, what each hook sees, and the per-hook
> opt-out env vars. Happy to add a git-repo-present gate if the directory requires
> one.
>
> **No telemetry by default, and no endpoint compiled in.**
> `grep -o 'https\?://' plugins/ork/hooks/dist/*.mjs` returns nothing. Hooks write
> lifecycle events to `~/.local/state/orchestkit/events.jsonl` on the user's own
> disk, rotated at 10 MB, recording event and tool names plus sizes and durations,
> never prompt or file contents. An outbound call requires the user to set
> `ORCHESTKIT_HOOK_URL` plus `ORCHESTKIT_HOOK_TOKEN`, or `ORK_HQ_TELEMETRY_URL`, or
> `ORK_HQ_TELEMETRY_USE_HQ_API=1` with `HQ_API_URL`, all unset by default and all
> pointing at the user's own collector. `telemetry-sync.mjs` is a manual CLI that no
> hook invokes; with no URL configured it prints "Nothing to sync" and exits 0.
>
> **Two things that grep like findings but are not.**
> `plugins/ork/hooks/dist/pretool.mjs` contains `id_rsa`, `.pem`, `.env`, and
> `credentials.json` as a **blocklist** that denies writes to those paths. There are
> no credential-store reads anywhere in the plugin. Separately, three files match
> prompt-injection phrasing (`skills/mcp-patterns/rules/security-injection.md`,
> `skills/testing-llm/examples/llm-test-patterns.md`,
> `agents/ai-safety-auditor.md`); all are defensive content about detecting
> injection.
>
> **Repo note.** The plugin lives at `plugins/ork` in a monorepo that also holds the
> docs site, demos, and test suites, so a `git-subdir` source is appropriate. Nothing
> outside `plugins/ork` is loaded by Claude Code.

## 6. What is not verified

- **The form's actual fields.** <https://clau.de/plugin-directory-submission>
  requires a claude.ai login and was not opened, per the no-external-contact
  constraint. Section 5 is a best-effort mapping from what marketplace entries
  contain, not a transcription of the form.
- **Review SLA and acceptance rate.** Not published anywhere found.
- **Whether a reviewer applies `has_broad_scope_hooks` literally or purposively.**
  The prompt text supports the literal reading; 276 accepted entries were not
  each audited to see whether any ships ungated `UserPromptSubmit` hooks. This is
  the open question behind B1.
