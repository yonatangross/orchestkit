# Skill pre-approval under managed `allowManagedPermissionRulesOnly` (CC 2.1.282, 2.1.284)

## What changed, and for whom

A skill's `allowed-tools` pre-grants the listed tools while the skill runs, so they do not prompt.
Two Claude Code fixes remove that pre-grant in one setup only: an organization whose **managed**
settings set `allowManagedPermissionRulesOnly: true`.

| CC | CHANGELOG line | Hits ork |
|---|---|---|
| 2.1.282 | "Fixed repository, user and `--add-dir` skills, commands and skills-directory plugin manifests pre-approving their own tools via `allowed-tools` under managed `allowManagedPermissionRulesOnly`" | only for skills an operator copied into a repo or `~/.claude/skills` |
| 2.1.284 | "Fixed plugins from marketplaces, claude.ai and npm pre-approving their own tools via `allowed-tools` under managed `allowManagedPermissionRulesOnly`; only plugins from an official Anthropic source or a source that managed settings vouch for keep that pre-approval" | yes: ork installs from a marketplace |

Without that managed key nothing changed: every skill below still pre-grants its tools. That is
why ork keeps its `allowed-tools` lists as they are. Removing them would add prompts for every
user to fix a problem only managed orgs have.

With the key set, the managed tier is the only source of permission rules (user, project, local,
`--settings` and `--allowedTools` rules are all ignored, per the settings reference). A skill below
then prompts for each listed prompt-gated tool, and a context that cannot answer a prompt (a
background agent, `claude -p`) is denied.

## How to detect it

The verdict rests on the **effective** value of the key, not on any `true` found somewhere.
`allowManagedPermissionRulesOnly` is not one of the "keys read from every admin source"
([managed settings](https://code.claude.com/docs/en/managed-settings)), so a `true` in a source
Claude Code did not select changes nothing.

**Authoritative read: `/status`.** Its `Setting sources` line names the managed source Claude Code
used and the ones it skipped. Prefer it over reading files; the steps below are the fallback when
you cannot run it.

Sources, highest rank first:

| Rank | Source | Where it lives | Readable from the device |
|---|---|---|---|
| 1 | Remote (server-managed) | claude.ai admin console or a Claude apps gateway; fetched at startup, polled hourly | no, not reliably |
| 2 | MDM or OS-level policy | macOS `com.anthropic.claudecode` managed preferences domain; Windows `HKLM\SOFTWARE\Policies\ClaudeCode` value `Settings` | yes, if you query that domain or key |
| 3 | Managed settings files | `managed-settings.json`, then every `managed-settings.d/*.json` alphabetically, in `/Library/Application Support/ClaudeCode/` (macOS), `/etc/claude-code/` (Linux, WSL), `C:\Program Files\ClaudeCode\` (Windows) | yes |
| 4 | HKCU registry (Windows) | read only when no source above delivers a policy key | yes |

How the effective value is decided:

1. **Inside the file source**, the files merge in order and the last one that sets the key wins:
   a drop-in's `false` replaces an earlier `true`.
2. **Under the default `managedSourcesBehavior: "first-wins"`**, only the highest-ranked source
   that delivers any policy key applies; the key's value there is the effective value, and every
   lower source is ignored even if it sets `true`.
3. **Under `managedSourcesBehavior: "merge"`**, locks take the strictest value, so a `true` in
   any admin source applies. Read `managedSourcesBehavior` from the highest-ranked source that
   carries it or a policy key.
4. **If the selected source sets `policyHelper`**, the helper's emitted `managedSettings` object
   is the only managed settings for the session
   ([managed settings](https://code.claude.com/docs/en/managed-settings)). File and MDM values
   on disk are then not the effective value: report **not observable** and point to `/status`.

Report one of three verdicts, never silence:

- **affected**: the effective value is `true`. Report the skills below at info level and name the
  source it came from.
- **not set**: the effective value is absent or `false`, and you read every device source that
  could supply it. Say which sources you read.
- **not observable**: you could not read a source that could change the effective value (no MDM
  query run, `/status` not available). Say it plainly, for example "not observable: MDM and
  server-managed not checked". A missing `managed-settings.json` does not mean the key is unset.

Remote settings rank first and cannot be read reliably from the device, so every device-side
verdict, **affected** included, carries the note "server-managed settings not checked": a remote
source that delivers any policy key replaces the device sources under first-wins.

## Remedy (admin side, ork cannot ship it)

1. Add managed `permissions.allow` rules for the tools the org wants ork skills to use, scoped as
   tightly as the org likes (for example `Bash(npm test)`, `Bash(git status)`, `WebFetch(domain:code.claude.com)`).
   This is the documented path: managed rules are the only rules left.
2. Or vouch for the ork marketplace source in managed settings, which the 2.1.284 changelog says
   keeps plugin pre-approval. **Unconfirmed:** the docs do not name the key that vouches for a
   source (checked `settings-reference.md` and `permissions.md` on 2026-09-29).
   `strictKnownMarketplaces` is the likely candidate but is not verified.

"Prompt-gated" means the tool is marked "Permission required: Yes" in the
[tools reference](https://code.claude.com/docs/en/tools-reference.md) (Artifact, Bash, Edit,
EnterWorktree, ExitPlanMode, Monitor, NotebookEdit, PowerShell, ShareOnboardingGuide, Skill,
WebFetch, WebSearch, Workflow, Write), plus any `mcp__*` tool. Read, Grep, Glob, Agent, Task*,
Cron*, SendMessage, ToolSearch and ExitWorktree never prompt, so listing them depends on nothing.

## Affected skills

The table is generated from `src/skills/*/SKILL.md`. Do not edit it by hand; run
`node scripts/skill-preapproval-inventory.mjs --write`. CI fails on drift
(`tests/skills/structure/test-skill-preapproval-inventory.mjs`).

<!-- skill-preapproval:begin (generated by scripts/skill-preapproval-inventory.mjs --write) -->

95 of 110 skills pre-grant at least one prompt-gated tool; 15 list none (or no `allowed-tools` at all) and are unaffected.

| Skill | Prompt-gated tools it pre-grants |
|---|---|
| `accessibility` | `WebFetch`, `WebSearch` |
| `agent-orchestration` | `WebFetch`, `WebSearch` |
| `ai-ui-generation` | `WebFetch`, `WebSearch`, `mcp__stitch__generate_screen_from_text`, `mcp__plugin_hq-ext_stitch__generate_screen_from_text`, `mcp__stitch__get_screen`, `mcp__plugin_hq-ext_stitch__get_screen` |
| `analytics` | `Bash` |
| `animation-motion-design` | `WebFetch`, `WebSearch` |
| `api-design` | `WebFetch`, `WebSearch` |
| `architecture-decision-record` | `WebFetch`, `WebSearch` |
| `architecture-patterns` | `WebFetch`, `WebSearch` |
| `assess` | `Write`, `Workflow`, `mcp__memory__search_nodes`, `Bash` |
| `async-jobs` | `WebFetch`, `WebSearch` |
| `audit-activation` | `Bash` |
| `audit-full` | `Bash`, `Workflow`, `mcp__memory__search_nodes` |
| `auto` | `Skill` |
| `brainstorm` | `Workflow`, `Bash`, `mcp__memory__search_nodes` |
| `browser-tools` | `WebFetch`, `WebSearch` |
| `business-case` | `WebFetch`, `WebSearch` |
| `ci-debug` | `Bash` |
| `ci-sentinel` | `Bash`, `Write`, `Edit` |
| `code-review-playbook` | `WebFetch`, `WebSearch` |
| `commit` | `Bash`, `Write` |
| `competitive-analysis` | `WebFetch`, `WebSearch` |
| `component-search` | `WebFetch`, `WebSearch`, `mcp__21st-dev-magic__search_picker`, `mcp__21st-dev-magic__search`, `mcp__21st-dev-magic__get_component`, `mcp__21st-dev-magic__get_theme`, `mcp__21st-dev-magic__search_logo`, `mcp__21st-dev-magic__get_usage` |
| `configure` | `Bash`, `Edit`, `Write` |
| `cover` | `Bash`, `Write`, `Edit`, `Workflow`, `Monitor`, `mcp__memory__search_nodes`, `mcp__context7__resolve-library-id`, `mcp__context7__query-docs` |
| `create-pr` | `Bash`, `Write`, `Skill`, `mcp__memory__search_nodes` |
| `database-patterns` | `WebFetch`, `WebSearch` |
| `demo-producer` | `Bash`, `Write`, `Edit` |
| `design-context-extract` | `Write`, `Bash`, `WebFetch`, `mcp__stitch__list_projects`, `mcp__plugin_hq-ext_stitch__list_projects`, `mcp__stitch__get_project`, `mcp__plugin_hq-ext_stitch__get_project`, `mcp__stitch__list_screens`, `mcp__plugin_hq-ext_stitch__list_screens`, `mcp__stitch__get_screen`, `mcp__plugin_hq-ext_stitch__get_screen`, `mcp__stitch__generate_screen_from_text`, `mcp__plugin_hq-ext_stitch__generate_screen_from_text` |
| `design-import` | `Write`, `Edit`, `Bash`, `WebFetch` |
| `design-ship` | `Write`, `Edit`, `Bash`, `WebFetch` |
| `design-stylecards` | `Edit`, `Write` |
| `design-system-tokens` | `WebFetch`, `WebSearch` |
| `design-to-code` | `Write`, `Edit`, `Bash`, `WebFetch`, `WebSearch`, `mcp__21st-dev-magic__search`, `mcp__21st-dev-magic__search_picker`, `mcp__21st-dev-magic__get_component`, `mcp__21st-dev-magic__get_theme`, `mcp__21st-dev-magic__get_usage`, `mcp__stitch__list_projects`, `mcp__plugin_hq-ext_stitch__list_projects`, `mcp__stitch__get_project`, `mcp__plugin_hq-ext_stitch__get_project`, `mcp__stitch__list_screens`, `mcp__plugin_hq-ext_stitch__list_screens`, `mcp__stitch__get_screen`, `mcp__plugin_hq-ext_stitch__get_screen`, `mcp__stitch__generate_screen_from_text`, `mcp__plugin_hq-ext_stitch__generate_screen_from_text`, `mcp__storybook-mcp__list-all-documentation`, `mcp__storybook-mcp__get-documentation`, `mcp__storybook-mcp__preview-stories`, `mcp__storybook-mcp__run-story-tests` |
| `devops-deployment` | `WebFetch`, `WebSearch` |
| `distributed-systems` | `WebFetch`, `WebSearch` |
| `doctor` | `Bash`, `Write` |
| `domain-driven-design` | `WebFetch`, `WebSearch` |
| `dream` | `Write`, `Edit`, `Bash`, `mcp__memory__search_nodes`, `mcp__memory__open_nodes`, `mcp__memory__read_graph` |
| `error-analysis` | `Bash`, `Write`, `Edit`, `WebFetch`, `WebSearch` |
| `errors` | `Bash` |
| `expect` | `Bash`, `Write`, `Edit`, `WebFetch`, `Monitor`, `mcp__memory__search_nodes` |
| `explore` | `Write`, `mcp__memory__search_nodes`, `Bash` |
| `figma-design-handoff` | `WebFetch`, `WebSearch` |
| `fix-issue` | `Bash`, `Write`, `Edit`, `mcp__memory__search_nodes`, `mcp__memory__create_entities`, `mcp__context7__resolve-library-id`, `mcp__context7__query-docs` |
| `freeze` | `Bash(node *freeze-guard.mjs arm *)` |
| `github-operations` | `Bash`, `Write`, `Edit` |
| `golden-dataset` | `WebFetch`, `WebSearch` |
| `i18n-date-patterns` | `WebFetch`, `WebSearch` |
| `implement` | `Bash`, `Write`, `Edit`, `WebFetch`, `EnterWorktree`, `Monitor`, `mcp__context7__resolve-library-id`, `mcp__context7__query-docs`, `mcp__memory__search_nodes` |
| `interaction-patterns` | `WebFetch`, `WebSearch` |
| `issue-progress-tracking` | `Bash` |
| `langgraph` | `WebFetch`, `WebSearch` |
| `llm-integration` | `WebFetch`, `WebSearch` |
| `market-sizing` | `WebFetch`, `WebSearch` |
| `mcp-patterns` | `WebFetch`, `WebSearch` |
| `memory` | `Bash`, `mcp__memory__search_nodes`, `mcp__memory__read_graph` |
| `memory-fabric` | `Bash`, `mcp__memory__search_nodes` |
| `monitoring-observability` | `WebFetch`, `WebSearch` |
| `multimodal-llm` | `WebFetch`, `WebSearch` |
| `okr-design` | `WebFetch`, `WebSearch` |
| `performance` | `WebFetch`, `WebSearch` |
| `prd-to-goal` | `Write`, `Bash` |
| `prioritization` | `WebFetch`, `WebSearch` |
| `product-analytics` | `WebFetch`, `WebSearch` |
| `product-frameworks` | `WebFetch`, `WebSearch` |
| `prompt-focus` | `Bash` |
| `python-backend` | `WebFetch`, `WebSearch` |
| `quality-gates` | `WebFetch`, `WebSearch` |
| `rag-retrieval` | `WebFetch`, `WebSearch` |
| `react-server-components-framework` | `WebFetch`, `WebSearch` |
| `release-management` | `Bash`, `Write`, `Edit` |
| `remember` | `Bash`, `mcp__memory__create_entities`, `mcp__memory__create_relations`, `mcp__memory__add_observations`, `mcp__memory__search_nodes` |
| `responsive-patterns` | `WebFetch`, `WebSearch` |
| `review-pr` | `Bash`, `Write`, `Edit`, `Workflow`, `mcp__memory__search_nodes`, `mcp__memory__create_entities`, `mcp__memory__add_observations`, `Monitor` |
| `scope-appropriate-architecture` | `WebFetch`, `WebSearch` |
| `security-patterns` | `WebFetch`, `WebSearch` |
| `setup` | `Write`, `Bash`, `mcp__memory__search_nodes`, `mcp__memory__create_entities`, `mcp__memory__create_relations` |
| `storybook-mcp-integration` | `WebFetch`, `WebSearch`, `mcp__storybook-mcp__get-storybook-story-instructions`, `mcp__storybook-mcp__preview-stories`, `mcp__storybook-mcp__list-all-documentation`, `mcp__storybook-mcp__get-documentation`, `mcp__storybook-mcp__get-documentation-for-story`, `mcp__storybook-mcp__run-story-tests` |
| `storybook-testing` | `WebFetch`, `WebSearch` |
| `swarm-migrate` | `Bash`, `Write`, `Edit`, `Monitor` |
| `task-dependency-patterns` | `WebFetch`, `WebSearch` |
| `telemetry-inspect` | `Bash` |
| `testing-e2e` | `WebFetch`, `WebSearch` |
| `testing-integration` | `WebFetch`, `WebSearch` |
| `testing-llm` | `WebFetch`, `WebSearch` |
| `testing-perf` | `WebFetch`, `WebSearch` |
| `testing-unit` | `WebFetch`, `WebSearch` |
| `ui-components` | `WebFetch`, `WebSearch` |
| `user-research` | `WebFetch`, `WebSearch` |
| `verify` | `Bash`, `Write`, `Edit`, `Workflow`, `mcp__memory__search_nodes`, `Monitor` |
| `visualize-plan` | `Bash`, `Write`, `mcp__memory__search_nodes`, `mcp__memory__create_entities`, `mcp__notebooklm-mcp__studio_create` |
| `vite-advanced` | `WebFetch`, `WebSearch` |
| `web-research-workflow` | `Bash`, `Write`, `WebFetch` |
| `write-prd` | `Write`, `Edit`, `Bash`, `WebFetch`, `WebSearch`, `mcp__memory__search_nodes`, `mcp__memory__create_entities`, `mcp__memory__add_observations`, `mcp__memory__create_relations` |
| `zustand-patterns` | `Write` |

<!-- skill-preapproval:end -->
