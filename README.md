<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

<img src="docs/banner.png" alt="OrchestKit - Stop explaining your stack. Start shipping." width="100%" />

**<!--ork:skills-->105<!--/ork--> skills · <!--ork:agents-->36<!--/ork--> agents · <!--ork:hooks-->216<!--/ork--> hooks**

[![Claude Code](https://img.shields.io/badge/Claude_Code-≥2.1.220-7C3AED?style=for-the-badge&logo=anthropic)](https://claude.ai/claude-code)
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


## Quick Start (Claude Code)

```bash
/plugin marketplace add yonatangross/orchestkit
/plugin install ork
```

Then start your personalized onboarding:

```bash
/ork:setup
```

The setup wizard scans your codebase, detects your tech stack, recommends skills for your needs, configures MCP servers, and creates a readiness score — all in one command.

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
| **<!--ork:skills-->105<!--/ork--> Skills** | RAG patterns, FastAPI, React 19, testing, security, database design, ML integration — loaded on-demand, zero overhead |
| **<!--ork:agents-->36<!--/ork--> Agents** | Specialized personas (backend-architect, frontend-dev, security-auditor) — route tasks to the right expert |
| **<!--ork:hooks-->216<!--/ork--> Hooks** | Pre-commit checks, git protection, quality gates, browser safety — ship with confidence |

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
| Context7 | Up-to-date library docs | Recommended |
| Memory | Knowledge graph persistence | Recommended |
| Sequential Thinking | Structured reasoning for subagents | Recommended |
| Tavily | Web search and extraction | Optional |

Set `"alwaysLoad": true` on the first three in your `.mcp.json`. It skips the per-skill tool probe and shaves ~150ms off cold starts.

### Customizing skills

Skills install as files on your disk, but **don't hand-edit the installed copy** — it gets overwritten on update and silently diverges from the canonical playbook. The supported ways to extend (user-level skills, project skills, upstream PRs, or disabling a bundled skill) are in [docs/extending-skills.md](docs/extending-skills.md).

---

## What OrchestKit observes

OrchestKit is a quality-gate plugin, so its hooks are the product rather than an
add-on. This section states plainly what they see, where it goes, and how to turn
each piece off.

**Scope: broad and intentional.** OrchestKit registers <!--ork:hooks-->216<!--/ork--> hooks across <!--ork:events-->30<!--/ork-->
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

Not on Claude Code? Pull the skills into any agent (Cursor, Codex, OpenCode, …) via [skills.sh](https://skills.sh):

```bash
npx skills add yonatangross/orchestkit
```

### Codex

Codex uses its own plugin format, skill picker, and standalone role
configuration. Add OrchestKit's Codex marketplace, then install the small
portable workflow pack:

```bash
codex plugin marketplace add yonatangross/orchestkit --ref main --sparse .agents/plugins --sparse plugins/ork-codex
codex plugin add ork-codex@orchestkit-codex
```

Restart Codex after installation. Invoke a workflow explicitly with
`$ork-brainstorm`, `$ork-explore`, `$ork-assess`, `$ork-verify`, or
`$ork-review-pr`; their narrow descriptions also let Codex select the relevant
workflow automatically.

The plugin intentionally ships roles as templates because Codex loads custom
roles from `~/.codex/agents/`, not from a plugin manifest. From an OrchestKit
checkout, run this one-time, non-overwriting install:

```bash
plugins/ork-codex/scripts/install-codex-roles.sh ~/.codex/agents
```

It installs `ork_explorer`, `ork_implementer`, `ork_reviewer`, and
`ork_verifier`; restart Codex before spawning them.

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

Requires **≥2.1.220** (supported floor; Opus 5 as the default Opus, `xhigh` effort, dynamic workflows, `sandbox.network.strictAllowlist`, native binary, hardened `Bash(rm:*)`/`Bash(find:*)` rules). Check with `claude --version`.

Raising this floor is a breaking change and ships as a major release. See [STABILITY.md](STABILITY.md) for the full contract, and `shared/cc-support.json` for the authoritative window.
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

**[v10.0.0-alpha.25](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.24...v10.0.0-alpha.25)** · 2026-08-12

- **hooks:** make restrict-bash actually run, ungate the dispatcher (#3449), closes [#3430](https://github.com/yonatangross/orchestkit/issues/3430) [#3438](https://github.com/yonatangross/orchestkit/issues/3438)

**[v10.0.0-alpha.24](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.23...v10.0.0-alpha.24)** · 2026-08-11

- **security-tests:** fail loudly on a broken payload (#3446)
- **workflows:** rename plugin workflows to .js so they actually register (#3445)

**[v10.0.0-alpha.23](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.22...v10.0.0-alpha.23)** · 2026-08-11

- **chain-patterns:** correct Pattern 8 /loop facts against official docs (#3442)
- **hooks:** stop `git fetch` reading as a network source (#3441)

**[v10.0.0-alpha.22](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.21...v10.0.0-alpha.22)** · 2026-08-11

- **workflows:** adopt CC 2.1.224 capabilities and evidence-replay gate (#3439)

**[v10.0.0-alpha.21](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.20...v10.0.0-alpha.21)** · 2026-08-11

- **hooks:** stop run-hook.mjs failing silently and crashing (#3436)

**[v10.0.0-alpha.20](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.19...v10.0.0-alpha.20)** · 2026-08-11

- **hooks:** stop the pipe-to-shell deny from inventing a fetch (#3434)

**[v10.0.0-alpha.19](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.18...v10.0.0-alpha.19)** · 2026-08-11

- **agents:** drop two frontmatter keys CC provably ignores (#3431)

**[v10.0.0-alpha.18](https://github.com/yonatangross/orchestkit/compare/v10.0.0-alpha.17...v10.0.0-alpha.18)** · 2026-08-11

- **hooks:** match the agent names CC actually sends, drop unread writes (#3428)

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
