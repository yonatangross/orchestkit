<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

<img src="docs/banner.png" alt="OrchestKit - Stop explaining your stack. Start shipping." width="100%" />

**<!--ork:skills-->107<!--/ork--> skills · <!--ork:agents-->36<!--/ork--> agents · <!--ork:hooks-->171<!--/ork--> hooks**

[![Claude Code](https://img.shields.io/badge/Claude_Code-≥2.1.251-7C3AED?style=for-the-badge&logo=anthropic)](https://claude.ai/claude-code)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/yonatangross/orchestkit?style=for-the-badge&logo=github)](https://github.com/yonatangross/orchestkit)
[![Community](https://img.shields.io/badge/Community-WhatsApp-25D366?style=for-the-badge&logo=whatsapp)](https://platform.yonyon.ai/circle?ref=readme)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-1A1A2E?style=for-the-badge&logo=bookstack&logoColor=4F9CF9)](https://deepwiki.com/yonatangross/orchestkit)

[![MCP Toplist](https://mcptoplist.com/badge/io.github.yonatangross%2Forchestkit.svg)](https://mcptoplist.com/server/io.github.yonatangross%2Forchestkit)

</div>

---

<p align="center">
  <a href="https://orchestkit.yonyon.ai/"><strong>Explore the Docs →</strong></a> ·
  <a href="https://yonyon.ai/go/orchestkit?utm_campaign=readme"><strong>OrchestKit Community →</strong></a><br>
  <sub>Skill browser, demo gallery, setup wizard</sub>
</p>

---

## Contents

- [Quick Start](#quick-start)
- [Why OrchestKit?](#why-orchestkit)
- [What You Get](#what-you-get)
- [Key Commands](#key-commands)
- [Configuration](#configuration)
- [What OrchestKit observes](#what-orchestkit-observes)
- [Install](#install)
- [FAQ](#faq)
- [Development](#development)
- [What's New](#whats-new)
- [Community](#community)


## Quick Start

Pick the host you actually use. Claude Code is the full plugin (skills + agents + hooks). Cursor gets the same `ork` plugin minus Claude hook scripts. skills.sh is skills only — start with the 12 below, not the whole catalog.

#### Host support matrix

Measured 2026-09-08 on pi 0.85, Codex CLI and cursor-agent. Details, commands and the lane model: [OrchestKit on pi, Codex and Cursor](https://orchestkit.yonyon.ai/docs/guides/orchestkit-on-pi-codex-cursor). Antigravity measured 2026-09-18 on agy 1.2.6; full evidence in `docs/audits/agy-host-support-2026-09-18.md`.

| Surface | Claude Code | Cursor | Codex | pi | Devin | Antigravity |
|---|---|---|---|---|---|---|
| Skills (SKILL.md) | all | all, via the `ork` plugin | 6 (`ork-codex` pack) | all via `pi install`, 78 auto-listed | 76 of 107, GH-4146 | all via workspace `.agents/skills` (skills.sh); `ork:<name>` via `agy plugin install` |
| Agents | all | all | 4 role templates | none | not reported by `info` | 36 via `agy plugin install` (validated); none via `.agents/skills` |
| Hooks | all | none | none | none | none | none of ork's; agy `hooks.json` is a different schema |
| Rules | repo convention | 14, plugin `rules` key | `AGENTS.md` | none | `AGENTS.md`, always on | `AGENTS.md`, per-directory |
| Commands | `/ork:<skill>` | 36 wrappers | `$ork-<skill>` | `/skill:<name>` | `/ork:<skill>` | `/<skill-name>`; `ork:<skill>` via plugin install |
| MCP config | `.mcp.json` | `.cursor/mcp.json` | plugin `mcp.json` | `.pi/mcp.json` | `mcp.json` / `.mcp.json` | `~/.gemini/config/mcp_config.json` or plugin `mcp_config.json`; repo `.mcp.json` not read |
| Status | shipped | shipped | shipped | shipped | skills only, GH-4146 | skills only, measured agy 1.2.6 |

### Claude Code

```bash
/plugin marketplace add yonatangross/orchestkit
/plugin install ork
```

Then `/ork:setup`. The wizard scans the repo, recommends skills, and writes MCP config.

CLI equivalent: `claude plugin marketplace add yonatangross/orchestkit && claude plugin install ork@orchestkit`.

### Cursor

Settings → Plugins / marketplaces → add `yonatangross/orchestkit` → enable **ork** → **open a new chat**. Same plugin Claude Code installs, not a five-skill fork. See [Install → Cursor](#cursor).

### skills.sh (Cursor, Codex, OpenCode, …)

Starter 12 — doctor, setup, explore, implement, verify, review-pr, commit, expect, assess, brainstorm, create-pr, remember:

```bash
npx skills add yonatangross/orchestkit -s doctor -s setup -s explore -s implement -s verify -s review-pr -s commit -s expect -s assess -s brainstorm -s create-pr -s remember
```

The skill named `implement` is the implement workflow (`/ork:implement` in Claude Code). There is no `ork-implement` on the Claude plugin; Codex uses `$ork-implement` after the Codex pack is installed. Full catalog: `npx skills add yonatangross/orchestkit` (hundreds of SKILL.md files — do not treat that as unique users).

---

## Why OrchestKit?

Every Claude Code session starts from zero. You explain your stack, patterns, preferences—again and again.

OrchestKit gives Claude **persistent knowledge** of production patterns that work automatically:

| Without | With OrchestKit |
|---------|-----------------|
| "Use FastAPI with async SQLAlchemy 2.0..." | "Create an API endpoint" → Done right |
| "Remember cursor pagination, not offset..." | Agents know your patterns |
| "Don't commit to main branch..." | Hooks block bad commits |
| "Run tests before committing..." | `/ork:commit` runs tests for you |

---

## What You Get

**One unified plugin, everything included.**

| Component | Details |
|-----------|---------|
| **<!--ork:skills-->107<!--/ork--> Skills** | RAG patterns, FastAPI, React 19, testing, security, database design, ML integration — loaded on-demand, zero overhead |
| **<!--ork:agents-->36<!--/ork--> Agents** | Specialized personas (backend-architect, frontend-dev, security-auditor) — route tasks to the right expert |
| **<!--ork:hooks-->171<!--/ork--> Hooks** | Pre-commit checks, git protection, quality gates, browser safety — ship with confidence |

All available in a single `/plugin install ork`. Skills load on-demand. Hooks work automatically.

**[Browse everything in the Docs →](https://orchestkit.yonyon.ai/docs/skills/overview)**

---

## Key Commands

```bash
/ork:auto         # Front door: describe a goal, it routes to the right skill
/ork:setup        # Personalized onboarding wizard
/ork:implement    # Full-stack implementation with parallel agents
/ork:expect       # Diff-aware AI browser testing
/ork:review-pr    # PR review with parallel agents
/ork:verify       # Multi-agent validation
/ork:commit       # Conventional commit with pre-checks
/ork:explore      # Analyze unfamiliar codebase
/ork:remember     # Save to persistent memory
/ork:doctor       # Health check
```

---

## Configuration

`/ork:setup` detects your stack, recommends MCP servers, and writes the configuration for you.

### Recommended MCP Servers

| Server | Purpose | Required? |
|--------|---------|-----------|
| Context7 | Up-to-date library docs | **Prerequisite** (22 of 36 agents grant its tools) |
| Memory | Knowledge graph persistence | Recommended |
| Sequential Thinking | Structured reasoning for subagents | Recommended |
| Tavily | Web search and extraction | Optional |

Set `"alwaysLoad": true` on the first three in your `.mcp.json`. It skips the per-skill tool probe and shaves ~150ms off cold starts.

**Context7 is a prerequisite, and ork does not ship it.** 22 agents grant
`mcp__context7__*` in their frontmatter, but `.mcp.json` is user-owned and project-scoped,
so the grant refers to a server you add. Skip it and those agents answer from training
data with no error raised. The recommended entry is the hosted HTTP server, which costs
no local process:

```json
"context7": {
  "type": "http",
  "url": "https://mcp.context7.com/mcp"
}
```

Free tier: 1,000 requests, public repos, no account. Context7 Pro ($10 per seat per
month) raises that to 5,000 per seat and parses private repos; add
`"headers": { "Authorization": "Bearer ${CONTEXT7_API_KEY}" }` and export the `ctx7sk-`
key. Add the header only once the variable is exported: with it unset the unexpanded
literal is sent as the token and every query fails, and it does **not** fall back to the
anonymous free tier, so the keyless entry above is strictly better than a header with no
key behind it. The legacy stdio transport (`npx -y @upstash/context7-mcp@4.0.2`) is the fallback
when the hosted endpoint is unreachable, but it spawns one child process per Claude Code
session, so the fan-out scales with how many sessions you keep open.

### Customizing skills

Skills install as files on your disk, but **don't hand-edit the installed copy** — it gets overwritten on update and silently diverges from the canonical playbook. The supported ways to extend (user-level skills, project skills, upstream PRs, or disabling a bundled skill) are in [docs/extending-skills.md](docs/extending-skills.md).

---

## What OrchestKit observes

OrchestKit is a quality-gate plugin, so its hooks are the product rather than an
add-on. This section states plainly what they see, where it goes, and how to turn
each piece off.

**Scope: broad and intentional.** OrchestKit registers <!--ork:hooks-->171<!--/ork--> hooks across <!--ork:events-->32<!--/ork-->
lifecycle events, including `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
`PostToolUse`, and `Stop`. They are **not** gated to a particular framework or
project type, because the gates they enforce (secret-write blocking, protected-file
guards, git safety, file-size limits, agent status protocol) apply to any codebase.
If you only want gates on some projects, enable the plugin per-project rather than
globally.

**Where data goes: a local file on your own disk.**

| What | Destination | Notes |
|---|---|---|
| Lifecycle events (session end, PR merged, goal converged, chain phase) | `~/.local/state/orchestkit/events.jsonl` | Written unconditionally, rotated at 10 MB. `ORK_EVENTS_LOG` redirects the path (used by the test suite) |
| Hook metrics: event name, tool name, payload size, duration | same local file | Size-capped metrics only |
| Prompt text and file contents | **Never recorded** | Hooks read them to make an allow/deny decision, then discard |
| Remote sync | **Off** | No endpoint is compiled in; see below |

There is deliberately **no global kill switch** for the local write, because the
gates depend on that state (the git-safety and chain-staleness hooks read their
own prior events). To stop it entirely, disable the plugin. Individual noisy hooks
have their own opt-outs: `ORK_DISABLE_DEBT_TRACKER`, `ORK_DISABLE_WORKTREE_VERIFIER`,
`ORK_DISABLE_COORDINATION_METRICS`, `ORK_NO_NOTIFY`, `ORK_NO_STALE_SWEEP`, and
`ORCHESTKIT_SKIP_SLOW_HOOKS` among others.

**Network access is opt-in and unset by default.** There is no hardcoded remote
host anywhere in the shipped hook bundles (`grep -o 'https\?://' plugins/ork/hooks/dist/*.mjs`
returns nothing). An outbound call happens only if you configure a destination
yourself, via one of:

- `ORCHESTKIT_HOOK_URL` + `ORCHESTKIT_HOOK_TOKEN`, which enable the manual
  `hooks/bin/telemetry-sync.mjs` CLI. It POSTs your local JSONL to *your own*
  endpoint. No hook ever invokes it; you run it by hand.
- `ORK_HQ_TELEMETRY_URL`, which points the telemetry HTTP sink at *your own* collector.
- `ORK_HQ_TELEMETRY_USE_HQ_API=1` together with `HQ_API_URL`, the same sink aimed
  at a self-hosted HQ API.
- `ORK_SESSION_CATEGORY_PROVIDER=jev` (or `shadow`) together with the TypeSafe
  key variable `ORK_TYPESAFE_API_KEY`, a second classifier for the session work
  category. The session-identity hook already asks a local `claude -p --model haiku`
  process for a title and a category; with both variables set it also asks
  TypeSafe's Jev model (`api.typesafe.ai`, model pinned to `jev-1.13.0`) one typed
  Choice over the same eight categories and the same criteria text. This is the
  one exception to the "no hardcoded host" note above, and it is dormant unless
  both variables are set. What leaves your machine: the git branch name and the
  first 600 characters of the session's first prompt, sent to a third-party
  processor under its own data policy. What changes in `jev` mode: when Jev
  answers at confidence 0.8 or above, its category decides the session color
  (held out on 150 sessions, that band is 93.5% correct);
  below 0.8, or on any error, haiku's category decides as before. The title and
  emoji always come from haiku. In `shadow` mode nothing you see changes; Jev is
  only logged beside haiku. To turn it on locally, in the shell that launches
  `claude`: `export ORK_TYPESAFE_API_KEY="$(<your secret manager> ...)"` and
  `export ORK_SESSION_CATEGORY_PROVIDER=jev`. Both outcomes are logged once per
  session in the hook log, as
  `category jev: haiku=<cat> jev=<cat> agree=<bool> confidence=<n> decided_by=jev|haiku threshold=0.8 latency_ms=<n>`,
  and as `session-identity.shadow.json` with the same fields (labels, decision,
  timing; never prompt text) next to the raw answer `session-identity.jev.json`
  in the session data directory. Cost of opting in: the first prompt of a session
  waits for the call to settle, 1.1 to 1.7 s measured from a fresh hook process
  (the eval's 320 ms was a warm connection), 3 s at most before it gives up.
- `ORK_ROUTE_JEV=shadow` (or `steer`) together with `ORK_TYPESAFE_API_KEY`, the
  Jev routing seam for `/ork:auto` (#4233). Off by default. When set, every
  build-shaped prompt (the same test the once-per-session executor reminder
  uses: an imperative build or fix verb, 40 characters or more, no explicit
  `/plugin:skill`) is sent to the same TypeSafe endpoint and model as one typed
  Choice over nineteen route classes plus four side judgments (needs a worktree,
  needs a browser, mutation risk, needs the operator). What leaves your machine:
  the first 1,500 characters of the prompt after a redactor has replaced
  secrets, emails, Israeli phone numbers, nine digit ids, `op://` references and
  the names of directories under `clients/` with `[SECRET]`, `[EMAIL]`,
  `[PHONE]` and `[CLIENT]`, plus the repository basename. The serialized request
  is scanned again before it leaves; anything that survives redaction refuses
  the call. In `shadow` mode nothing you see changes; the verdict is logged. In
  `steer` mode, at confidence `ORK_ROUTE_JEV_FLOOR` (default 0.5) or above, the
  one-line executor reminder names the executor the class maps to
  (`route: dev_fix -> /ork:fix-issue (conf 0.83)`); the model still reads the
  `/ork:auto` table and says whether it agrees. Fallbacks are fail open: no key,
  timeout, non-2xx, malformed answer, below the floor, or the daily token budget
  (`ORK_ROUTE_JEV_DAILY_TOKENS`, default 2,000,000) spent all mean the existing
  path runs untouched; a 402 or 429 switches the seam off for 24 hours. One log
  line per prompt,
  `route jev: intent=<class> conf=<n> top3=<a:p,b:p,c:p> worktree=<n> browser=<n> mutation=<n> operator=<n> floor=<n> decided_by=jev|table|off|budget|egress latency_ms=<n> input_tokens=<n> redacted=<n>`,
  and one record per prompt in `jev-route.jsonl` next to
  `session-identity.jev.json` (labels, timings and a sha256 of the redacted
  text; never prompt text). Offline replay: `node scripts/eval/route-check.mjs --jev`
  and `node scripts/eval/jev-route-score.mjs`. The vendor's agent skill is a
  peer plugin installed from its own marketplace, never a copied directory:
  `claude plugin marketplace add typesafe-ai/skills` then
  `claude plugin install typesafe@typesafe-ai`; `/ork:doctor` reports the
  installed version against the marketplace and prints the update commands.

The sink returns early when the URL or the token is missing, and
`telemetry-sync.mjs` prints `No ORCHESTKIT_HOOK_URL or TOKEN configured. Nothing
to sync.` then exits 0. There is no analytics ping, no crash reporter, and no
feature-flag fetch.

**What OrchestKit never reads.** No OS keychain lookups, no `~/.aws/credentials`,
no SSH private keys, no browser cookie or login stores, no clipboard. The one
place secret-shaped paths appear in the source is
`plugins/ork/hooks/dist/pretool.mjs`, where `id_rsa`, `.pem`, `.env`, and
`credentials.json` form a **blocklist** that stops Claude writing to them. That
code denies access; it does not read those files.

**Third-party MCP servers are recommendations, not bundled dependencies.** The
plugin ships no `.mcp.json` and declares no `mcpServers`. The table under
[Configuration](#configuration) is advisory, and `/ork:setup` asks before writing
anything.

---

## Install

```bash
/plugin install ork
```

No tiering. No version confusion. Just one powerful plugin.

Not on Claude Code? Pull a **starter 12** into any agent (Cursor, Codex, OpenCode, …) via [skills.sh](https://www.skills.sh/yonatangross/orchestkit) — do not install the whole firehose on day one:

```bash
npx skills add yonatangross/orchestkit -s doctor -s setup -s explore -s implement -s verify -s review-pr -s commit -s expect -s assess -s brainstorm -s create-pr -s remember
```

All skills: `npx skills add yonatangross/orchestkit`. The implement skill is [`implement`](https://www.skills.sh/yonatangross/orchestkit/implement), not `ork-implement`.

### Cursor

Cursor loads [Agent Plugins](https://agent-plugins.org) and Cursor plugins.
This repo already ships the Agent Plugins manifest at `plugins/ork/plugin.json`.
Add the GitHub repo as a Cursor marketplace (Settings → `yonatangross/orchestkit`),
enable **`ork`**, then **open a new chat**. That is the same plugin Claude Code
installs, not a five-skill fork.

It also ships 14 rules under the plugin's `rules` key, generated from
`src/rules/` and `src/shared/rules/`. They are agent-fetched, so a rule costs
context only when its description matches the task.

Claude hook scripts are not registered for Cursor: they depend on
`${CLAUDE_PLUGIN_ROOT}` (orchestkit#293, closed). Cursor enforcement for HQ
repos stays in the consuming project's `.cursor/hooks.json`.

"Include third-party Plugins" can leak SKILL.md from `~/.claude/plugins`. That
is not an install. Proof is the `ork` plugin id plus the full skill catalog.

### Codex

Codex uses its own plugin format, skill picker, and standalone role
configuration. Add OrchestKit's Codex marketplace, then install the small
portable workflow pack:

```bash
codex plugin marketplace add yonatangross/orchestkit --ref main --sparse .agents/plugins --sparse plugins/ork-codex
codex plugin add ork-codex@orchestkit-codex
```

Restart Codex after installation. Invoke a workflow explicitly with
`$ork-brainstorm`, `$ork-explore`, `$ork-implement`, `$ork-assess`, `$ork-verify`,
or `$ork-review-pr`; their narrow descriptions also let Codex select the relevant
workflow automatically.

The plugin intentionally ships roles as templates because Codex loads custom
roles from `~/.codex/agents/`, not from a plugin manifest. From an OrchestKit
checkout, run this one-time, non-overwriting install:

```bash
plugins/ork-codex/scripts/install-codex-roles.sh ~/.codex/agents
```

It installs `ork_explorer`, `ork_implementer`, `ork_reviewer`, and
`ork_verifier`; restart Codex before spawning them.

#### Unattended runs: the `ork-mech` profile

For mechanical work (renames, bumps, codemods, sweeps that end in a diff),
install the shipped profile and run `codex exec` against it:

```bash
plugins/ork-codex/scripts/install-codex-profile.sh ~/.codex
codex exec --profile ork-mech "<task>" </dev/null
```

The profile is a FILE, not a snippet you paste into `config.toml`. Measured on
codex-cli 0.153.4: `--profile <name>` layers `$CODEX_HOME/<name>.config.toml`
over the base config, and a legacy `[profiles.<name>]` table left inside
`config.toml` makes the same flag a hard config-load error. The installer
refuses to run next to that table, and refuses to overwrite a profile you
already have.

What it sets, as `codex exec` prints it in its own header:

```
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
```

It deliberately does not pin a model (pass `-m`) and does not use
`--dangerously-bypass-approvals-and-sandbox`, which drops the sandbox entirely.
Two contracts a TOML file cannot express, so they stay on the command line:

- **`</dev/null`.** `codex exec` reads stdin even when a prompt argument is
  given. An inherited open pipe blocks the run with `Reading additional input
  from stdin...` and no timeout.
- **`--add-dir` inside a git worktree.** The writable roots are
  `[workdir, /tmp, $TMPDIR]`. A linked worktree's git common dir sits outside
  the workdir, so the first commit dies on `index.lock`. Add it:

  ```bash
  codex exec --profile ork-mech \
    --add-dir "$(git rev-parse --path-format=absolute --git-common-dir)" \
    "<task>" </dev/null
  ```

#### Keeping the install current

`ref main` in the marketplace source is a cached snapshot, not a tracker. On the
2026-09-08 audit machine `codex plugin list` showed `10.0.0-beta.5` while main
was three releases ahead. After an OrchestKit release, update and check:

```bash
codex plugin update
codex plugin list | grep ork-codex          # installed version
jq -r .version plugins/ork-codex/.codex-plugin/plugin.json   # what main ships
```

#### Documentation lookup (context7)

The plugin ships a [context7](https://context7.com) MCP server in its own
manifest (`mcpServers` in `.codex-plugin/plugin.json`, defined in `mcp.json`),
so installing the plugin registers it. Confirm with `codex mcp get context7`.
It is scoped to the only two tools context7 exposes, `resolve-library-id` and
`query-docs`, and it uses the hosted HTTP transport rather than an `npx` stdio
child, so it costs no extra process per Codex session.

Export a key before starting Codex. The plugin references the variable name
and never stores the value, so no token is written to `~/.codex/config.toml`:

```bash
export CONTEXT7_API_KEY_CODEX="<your-context7-api-key>"
```

Put that in your shell profile so every Codex session inherits it. Get the
key from your own context7 account and keep the value out of the repository.
If you store it in a secret manager, substitute your own vault and item names
(with the 1Password CLI the reference is `op://<vault>/<item>/credential`), and
cache the resolved value instead of re-reading the vault in every shell: each
raw read is a separate unlock prompt.

Two behaviors worth knowing:

- A server you already define yourself under `[mcp_servers.context7]` in
  `~/.codex/config.toml` **wins**, and the plugin's definition is ignored
  entirely (including its tool scoping). That is intentional: your own
  configuration is never overridden. Remove your entry if you want the
  plugin's.
- Without a valid key the server still connects and still lists its tools.
  Only a real call fails, with `Invalid API key`. A successful connection is
  therefore not proof of authentication.

### pi

pi (0.85) reads the same SKILL.md format, and the repo now carries a `pi`
manifest, so the package installs directly:

```bash
pi install git:github.com/yonatangross/orchestkit
```

That registers every skill. Add `-l` to write `.pi/settings.json` in the
project instead of your user settings. Pointing pi at a checkout still works
and needs no install (`pi --skill ./plugins/ork/skills`).

The 29 skills marked `disable-model-invocation` stay reachable only as
`/skill:<name>`. Two measured caveats: `--no-builtin-tools` hides every skill
(pi lists skills only when a file-reading tool is enabled), and `pi -p` blocks
on an open stdin, so headless runs need `</dev/null`.

MCP servers for pi come from `.pi/mcp.json`, then `.mcp.json`, then
`~/.config/mcp/mcp.json`. Copy the shipped template to get the recommended
servers with a read-only `includeTools` allowlist per server:

```bash
cp .pi/mcp.json.example .pi/mcp.json
```

Full detail and the tracking epic:
[OrchestKit on pi, Codex and Cursor](https://orchestkit.yonyon.ai/docs/guides/orchestkit-on-pi-codex-cursor).

### Devin

```bash
devin plugins install yonatangross/orchestkit
```

Devin checks a plugin root for a manifest in this order: `.devin-plugin/plugin.json`,
then `.claude-plugin/plugin.json`, then root `plugin.json`
([plugins reference](https://docs.devin.ai/cli/extensibility/plugins/overview)).
The repo root only had the last one, the [Agent Plugins](https://agent-plugins.org)
manifest, which fixes skills at a root `skills/` directory this repo does not have,
so a bare install used to list 0 of 107 skills, 0 hooks, and only the `AGENTS.md`
rule (GH-4146). A root level `.devin-plugin/plugin.json` now maps `skills` to
`./plugins/ork/skills`, the same built tree Claude Code and Cursor already read.

`devin plugins info ork` lists 76 of 107 skills after that change (measured on
Devin CLI 3000.10.27). The other 31, `auto`, `verify`, `help`, `brainstorm`, and
similar router or workflow skills, declare a `triggers:` frontmatter key shaped
as an object (`keywords`, `examples`, `anti-triggers`). Devin's own `triggers`
field expects a flat `[user, model]` list, and the shape mismatch drops the
whole skill instead of warning. Renaming that key touches three other readers
(`scripts/eval/eval-coverage.sh`, `tests/skills/triggering/test-trigger-keywords.sh`,
and the `SKILL_ONLY` allowlist in `tests/plugins/test-command-frontmatter-passthrough.sh`),
so it stays tracked on GH-4146 instead of folded into this fix. Installing the
subpath directly, `devin plugins install yonatangross/orchestkit#plugins/ork`,
reaches the same 76 skills plus the plugin's 36 custom subagents, which neither
path surfaces through `devin plugins info`. That subpath is what this repo's own
`.claude-plugin/marketplace.json` already points Claude Code at.

OrchestKit's plugin hooks work under Claude Code only today; none of the 171
fire under Devin. Two reasons. Location: OrchestKit ships hooks at
`plugins/ork/hooks/hooks.json`, while Devin's own plugin format reads a bare
`hooks.json` at the plugin root instead. Shape and tool names: OrchestKit's
file matches Claude Code tool names such as `Bash` and `Write|Edit` and
expands `${CLAUDE_PLUGIN_ROOT}` in command args, both Claude Code specific.
Devin's own
[hooks.v1.json](https://docs.devin.ai/cli/extensibility/hooks/overview) format
matches its own tool names instead, `exec`, `write`, `edit` and friends (see
[lifecycle hooks](https://docs.devin.ai/cli/extensibility/hooks/lifecycle-hooks)),
inside the same `{matcher, hooks:[{type, command}]}` event map shape.
`devin plugins info` confirms `Hooks (none)` even once skills resolve.
`PreToolUse` and `PostToolUse` read the closest to what OrchestKit's own
pretool and posttool hooks already do, and are the first candidates for a
future Devin hook manifest once the tool name mapping is written deliberately
instead of guessed.

Pin a release instead of tracking `main`: release-please tags every release as
`v10.0.0-beta.N`. The single argument `devin plugins install <source>` command
has no ref pinning syntax of its own; pin through a `requiredPlugins` entry
(in this repo's own `.devin/config.json`, or a personal, org, or enterprise
manifest) instead:

```json
{
  "requiredPlugins": [
    { "source": "github", "repo": "yonatangross/orchestkit", "ref": "v10.0.0-beta.30" }
  ]
}
```

### Antigravity

```bash
npx skills add yonatangross/orchestkit -s doctor -s setup -s explore -s implement -s verify -s review-pr -s commit -s expect -s assess -s brainstorm -s create-pr -s remember
```

Antigravity (`agy`, Google's agentic CLI) reads Agent Skills from a workspace
`.agents/skills` directory, so the shared skills.sh line above is the install
path and Antigravity is already in that installer's universal target list
(measured on agy 1.2.6; full evidence in
`docs/audits/agy-host-support-2026-09-18.md`). Verify from the repo root with
`agy -p "/skills" --add-dir "$PWD"`: print mode only registers a workspace from
an absolute `--add-dir`, while the interactive TUI takes the launch directory
as the workspace and needs no flag.

Two honest gaps. `npx skills add -g` lands in `~/.agents/skills`, which agy
does not read; user scope lives at `~/.gemini/config/skills` (or
`~/.gemini/skills`). And none of ork's 171 hooks port: agy's `hooks.json` uses
its own event names and payload shape, and `agy plugin validate plugins/ork`
reports hooks skipped because ork keeps them at `hooks/hooks.json`, not the
plugin-root `hooks.json` agy looks for.

A fuller install exists but needs a local checkout:
`agy plugin validate <checkout>/plugins/ork` reports `skills: 108 processed`,
`agents: 36 processed`, and `agy plugin install <checkout>/plugins/ork` copies
them into `~/.gemini/config/plugins/ork/` namespaced `ork:<name>`, which matches
the `/ork:<skill>` spelling. Plugin-bundled `mcp_config.json` also works
(marker-verified end to end), but a repo-level `.mcp.json` is never read.

---

## FAQ

<details>
<summary><strong>Plugin not found?</strong></summary>

```bash
/plugin list
/plugin uninstall ork && /plugin install ork
```
</details>

<details>
<summary><strong>Hooks not firing?</strong></summary>

Run `/ork:doctor` to diagnose.
</details>

<details>
<summary><strong>Claude Code version?</strong></summary>

Requires **≥2.1.251** (supported floor; Opus 5 as the default Opus, `xhigh` effort, dynamic workflows, `sandbox.network.strictAllowlist`, native binary, hardened `Bash(rm:*)`/`Bash(find:*)` rules). Check with `claude --version`.

Raising this floor is a breaking change and ships as a major release. See [STABILITY.md](STABILITY.md) for the full contract, and `shared/cc-support.json` for the authoritative window.
</details>

<details>
<summary><strong>Superpowers vs OrchestKit?</strong></summary>

Complementary, not a rival listing. Superpowers (official Anthropic marketplace) is process — how the agent works a task. OrchestKit is production patterns plus lifecycle hooks. Honest split: [docs](https://orchestkit.yonyon.ai/docs/getting-started/superpowers) · [yonyon.ai](https://yonyon.ai/compare/orchestkit-superpowers).
</details>

---

## Development

```bash
npm run build      # Build plugins from src/
npm test           # Run all tests
```

Edit `src/` and `manifests/`, never `plugins/` (generated).

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## What's New

<!--ork:whats-new-->
<!-- AUTO-GENERATED from CHANGELOG.md by scripts/stamp-whats-new.mjs — do not hand-edit between the ork:whats-new markers. -->
<!-- Regenerated on `npm run build`; CI (`--check`) fails if this is stale. Full history: [CHANGELOG.md](CHANGELOG.md). -->

**[v10.0.0-beta.60](https://github.com/yonatangross/orchestkit/compare/v10.0.0-beta.59...v10.0.0-beta.60)** · 2026-09-19

- **browser:** adopt agent-browser 0.38.1 (delta snapshots, if-changed shots, persistent refs, 30 fps, WebMCP) (#4260)
- **site:** generated Related block on reference pages (#4253)

**[v10.0.0-beta.59](https://github.com/yonatangross/orchestkit/compare/v10.0.0-beta.58...v10.0.0-beta.59)** · 2026-09-19

- **codex:** add glyph skill adapter and export coverage (#4277)
- **hooks:** key credential-path reject on the path, not the reader (#4279)

**[v10.0.0-beta.58](https://github.com/yonatangross/orchestkit/compare/v10.0.0-beta.57...v10.0.0-beta.58)** · 2026-09-19

- **doctor:** check per-agent memory dirs for orphans and stale notes (#4263)
- **ci:** restore py311 compatibility for shipped skill scripts (#4275)
- **glyph:** render once instead of handing off to ork:glyph (#4261)
- **hooks:** close auto-approve bypass via substitution and redirects (#4264)
- **contributing:** add a first pull request example (#4269)
- …and 3 more (see [CHANGELOG.md](CHANGELOG.md))

**[v10.0.0-beta.57](https://github.com/yonatangross/orchestkit/compare/v10.0.0-beta.56...v10.0.0-beta.57)** · 2026-09-19

- **ci:** name both causes when hook bundles differ (#4256)
- **release:** retry the GHCR manifest preflight (#4257)

**[v10.0.0-beta.56](https://github.com/yonatangross/orchestkit/compare/v10.0.0-beta.55...v10.0.0-beta.56)** · 2026-09-19

- **playground:** render mermaid when a tab opens (#4252)
- **ruff:** re-anchor skill example excludes (#4254)

**[v10.0.0-beta.55](https://github.com/yonatangross/orchestkit/compare/v10.0.0-beta.54...v10.0.0-beta.55)** · 2026-09-18

- **doctor:** extend the CC version matrix through 2.1.277 (#4247)

**[v10.0.0-beta.54](https://github.com/yonatangross/orchestkit/compare/v10.0.0-beta.53...v10.0.0-beta.54)** · 2026-09-18

- **hosts:** first-class Antigravity host support (#4235) (#4243)
- **hooks:** address CodeRabbit on [#4241](https://github.com/yonatangross/orchestkit/issues/4241) (#4246)
- seam review follow-ups that missed the [#4237](https://github.com/yonatangross/orchestkit/issues/4237) merge (#4233) (#4245)

**[v10.0.0-beta.53](https://github.com/yonatangross/orchestkit/compare/v10.0.0-beta.52...v10.0.0-beta.53)** · 2026-09-18

- **hooks:** pre-push applies one load back-off to every stage and keeps the security log (#4238) (#4241)

_See [CHANGELOG.md](CHANGELOG.md) for the full release history._
<!--/ork-->

---

## Community

Join the **Building with AI** community for AI dev tips, OrchestKit support, and connecting with other builders:

| Room | Who it's for | Link |
|------|--------------|------|
| **Building with AI** | The umbrella community. One join, every room below. | [Join](https://platform.yonyon.ai/circle?ref=readme) |
| **Builders** | For people already building | [Join](https://yonyon.ai/go/builders?utm_campaign=readme) |
| **OrchestKit** | For OrchestKit users | [Join](https://yonyon.ai/go/orchestkit?utm_campaign=readme) |
| **AI for Business** | For people leading AI adoption | [Join](https://yonyon.ai/go/business?utm_campaign=readme) |

Names and audiences match what [yonyon.ai](https://yonyon.ai/en) renders, so the two surfaces cannot drift. Every link resolves through `yonyon.ai/go/*`, so a rotated invite never needs a README change and no raw invite is published here.

---

## Who builds this

OrchestKit is built and maintained by **[Yonatan Gross](https://github.com/yonatangross)** — [Yonyon AI](https://yonyon.ai/en), an AI consulting practice. It is the toolkit extracted from real client work, not a side project: the patterns here are the ones that survived shipping.

It stays MIT and free. Nothing is gated, and none of the below changes that.

**Working out where AI actually fits in your business?** The [**AI readiness audit**](https://platform.yonyon.ai/ai-audit) is a free assessment that maps your workflows and returns a prioritized report — the same diagnostic that opens a consulting engagement.

**Want the toolkit running properly in your team?** Setup, configuration, and a working agent loop tailored to your stack is something I do as a fixed-scope engagement. Start a [discussion](https://github.com/yonatangross/orchestkit/discussions) or reach out through the [community](https://yonyon.ai/go/business?utm_campaign=readme).

Security policy and reporting: [SECURITY.md](SECURITY.md).

---

<div align="center">

**[Docs](https://orchestkit.yonyon.ai/)** · **[Issues](https://github.com/yonatangross/orchestkit/issues)** · **[Discussions](https://github.com/yonatangross/orchestkit/discussions)** · **[Community](https://platform.yonyon.ai/circle?ref=readme)**

MIT License · [@yonatangross](https://github.com/yonatangross)

</div>
