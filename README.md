<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

<img src="docs/banner.png" alt="OrchestKit - Stop explaining your stack. Start shipping." width="100%" />

**<!--ork:skills-->106<!--/ork--> skills · <!--ork:agents-->36<!--/ork--> agents · <!--ork:hooks-->175<!--/ork--> hooks**

[![Claude Code](https://img.shields.io/badge/Claude_Code-≥2.1.251-7C3AED?style=for-the-badge&logo=anthropic)](https://claude.ai/claude-code)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/yonatangross/orchestkit?style=for-the-badge&logo=github)](https://github.com/yonatangross/orchestkit)
[![Community](https://img.shields.io/badge/Community-WhatsApp-25D366?style=for-the-badge&logo=whatsapp)](https://yonyon.ai/go/community)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-1A1A2E?style=for-the-badge&logo=bookstack&logoColor=4F9CF9)](https://deepwiki.com/yonatangross/orchestkit)

[![MCP Toplist](https://mcptoplist.com/badge/io.github.yonatangross%2Forchestkit.svg)](https://mcptoplist.com/server/io.github.yonatangross%2Forchestkit)

</div>

---

<p align="center">
  <a href="https://orchestkit.yonyon.ai/"><strong>Explore the Docs →</strong></a> ·
  <a href="https://yonyon.ai/go/orchestkit"><strong>OrchestKit Community →</strong></a><br>
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

### Claude Code

```bash
/plugin marketplace add yonatangross/orchestkit
/plugin install ork
```

Then `/ork:setup`. The wizard scans the repo, recommends skills, and writes MCP config.

CLI equivalent: `claude install orchestkit/ork`.

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
| **<!--ork:skills-->106<!--/ork--> Skills** | RAG patterns, FastAPI, React 19, testing, security, database design, ML integration — loaded on-demand, zero overhead |
| **<!--ork:agents-->36<!--/ork--> Agents** | Specialized personas (backend-architect, frontend-dev, security-auditor) — route tasks to the right expert |
| **<!--ork:hooks-->175<!--/ork--> Hooks** | Pre-commit checks, git protection, quality gates, browser safety — ship with confidence |

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

**Scope: broad and intentional.** OrchestKit registers <!--ork:hooks-->175<!--/ork--> hooks across <!--ork:events-->32<!--/ork-->
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

**[v10.0.0-alpha.64](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.63...v10.0.0-alpha.64)** · 2026-08-30

- **hooks:** cross-instance-test-validator checks the session's files at Stop (#3812)
- **hooks:** CLAUDE_ENV_FILE exports reach Bash only, not later hooks (#3814), closes [#3806](https://github.com/yonatangross/orchestkit/issues/3806)
- **playgrounds:** land three 2026-08-29 session explainers (#3811)

**[v10.0.0-alpha.63](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.62...v10.0.0-alpha.63)** · 2026-08-30

- **build:** plugin dependencies handed to CC, Phase 5 retired (#3326) (#3809)
- **hooks:** egress guard stands down behind an enforced sandbox (#3322) (#3808)
- **build:** stop shipping command wrappers to Claude Code (#3541) (#3807)

**[v10.0.0-alpha.62](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.61...v10.0.0-alpha.62)** · 2026-08-29

- **agents:** experimental.cacheTtl 1h on five long-running agents (#3797)
- **ci:** --restricted smoke lane against a stub Messages API (#3774) (#3799)
- **glyph:** v3 two-dial front door (audience x surface) (#3793)
- **hooks:** a maxTurns stop is a partial result, continue the agent (CC 2.1.246) (#3796)
- **hooks:** asyncRewake on the three background verifiers (#3800)
- …and 16 more (see [CHANGELOG.md](CHANGELOG.md))

**[v10.0.0-alpha.61](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.60...v10.0.0-alpha.61)** · 2026-08-25

- **ork-codex:** ship ork-implement and one install matrix (#3753)

**[v10.0.0-alpha.60](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.59...v10.0.0-alpha.60)** · 2026-08-25

- **ork:** expose the full plugin to Cursor (#3748)
- **ork:** Cursor import rejects ./plugins/ork as invalid_argument (#3750)

**[v10.0.0-alpha.59](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.58...v10.0.0-alpha.59)** · 2026-08-25

- **ci:** playground gate must verify the page is viewable (#3745)
- **hooks:** make a subagent empty result loud instead of silent (#3744)
- **ci:** add CodeRabbit as an advisory review lane (#3746)

**[v10.0.0-alpha.58](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.57...v10.0.0-alpha.58)** · 2026-08-25

- **evals:** run the train/test split through jq, mikefarah yq has no -y (#3730)
- **hooks:** guards must parse shell structure, not raw text (#3742)
- **hooks:** read git status without taking the index lock (#3743)
- **hooks:** restrict-bash must not read quoted pipes as shell operators (#3740)

**[v10.0.0-alpha.57](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.56...v10.0.0-alpha.57)** · 2026-08-25

- **cc-watch:** fallback stub ignores below-floor sentinels (#3724)
- register the repo-root plugin.json with the drift roster (#3728)

_See [CHANGELOG.md](CHANGELOG.md) for the full release history._
<!--/ork-->

---

## Community

Join the **Building with AI** community for AI dev tips, OrchestKit support, and connecting with other builders:

| Room | Who it's for | Link |
|------|--------------|------|
| **Building with AI** | The umbrella community. One join, every room below. | [Join](https://yonyon.ai/go/community) |
| **Builders** | For people already building | [Join](https://yonyon.ai/go/builders) |
| **OrchestKit** | For OrchestKit users | [Join](https://yonyon.ai/go/orchestkit) |
| **AI for Business** | For people leading AI adoption | [Join](https://yonyon.ai/go/business) |

Names and audiences match what [yonyon.ai](https://yonyon.ai/en) renders, so the two surfaces cannot drift. Every link resolves through `yonyon.ai/go/*`, so a rotated invite never needs a README change and no raw invite is published here.

---

## Who builds this

OrchestKit is built and maintained by **[Yonatan Gross](https://github.com/yonatangross)** — [Yonyon AI](https://yonyon.ai/en), an AI consulting practice. It is the toolkit extracted from real client work, not a side project: the patterns here are the ones that survived shipping.

It stays MIT and free. Nothing is gated, and none of the below changes that.

**Working out where AI actually fits in your business?** The [**AI readiness audit**](https://platform.yonyon.ai/ai-audit) is a free assessment that maps your workflows and returns a prioritized report — the same diagnostic that opens a consulting engagement.

**Want the toolkit running properly in your team?** Setup, configuration, and a working agent loop tailored to your stack is something I do as a fixed-scope engagement. Start a [discussion](https://github.com/yonatangross/orchestkit/discussions) or reach out through the [community](https://yonyon.ai/go/business).

Security policy and reporting: [SECURITY.md](SECURITY.md).

---

<div align="center">

**[Docs](https://orchestkit.yonyon.ai/)** · **[Issues](https://github.com/yonatangross/orchestkit/issues)** · **[Discussions](https://github.com/yonatangross/orchestkit/discussions)** · **[Community](https://yonyon.ai/go/community)**

MIT License · [@yonatangross](https://github.com/yonatangross)

</div>
