# OrchestKit Delta: Monitoring and Observability

What this repo knows that the vendor docs do not. Prometheus, Grafana, OpenTelemetry and
Langfuse tutorials belong upstream (see the "Upstream coverage" table in `SKILL.md`); this file
holds only the version floors, house decisions and scars that came out of OrchestKit itself.

Every entry is `rule / Why / Upstream`. An entry with no scar and no house decision does not
belong here, it belongs in the SKILL.md pointer table.

## Read `TRACEPARENT` from the environment in anything Claude Code spawns

Why: ork hook telemetry already forwards it. `src/hooks/src/lib/telemetry.ts:138` attaches
`process.env.TRACEPARENT` to every emitted event and `src/hooks/src/lib/http-sink.ts:225`
re-sends it as an HTTP `traceparent` header, so a downstream service that ignores the variable
silently breaks the CC-tool-span to service-trace join that the hooks already paid for. The
variable is only populated when OTEL tracing is enabled, so treat absence as "not traced", not
as an error.

Upstream: `src/skills/doctor/references/version-compatibility.md` (CC 2.1.97 row, "Bash OTEL
TRACEPARENT: subprocesses inherit W3C TRACEPARENT env var when OTEL tracing is enabled").

## Set `OTEL_*` at the subprocess invocation site, never in the shell that launched Claude Code

Why: CC 2.1.128 stopped propagating `OTEL_*` from the CLI process into spawned children (Bash
tool, hooks, MCP stdio and Streamable HTTP servers, LSP servers). Anything that relied on
inheritance goes silent with no error and no log line, so a step-down in span volume right
after a CC upgrade is this gate, not a broken collector. For MCP servers, declare the OTEL
variables in the server's `env` block in `.mcp.json` so the CLI collector and the server
collector stay independently configurable.

Upstream: `src/skills/configure/references/cc-version-settings.md`, section "Subprocesses No
Longer Inherit OTEL_* Env Vars", which is the canonical write-up for this repo.

## Never link the Langfuse SDK into an OrchestKit hook

Why: house decision. Hooks run as short-lived per-event processes, so SDK initialization
(roughly 50 to 150 ms) is paid on every single spawn, and requiring `LANGFUSE_*` would turn an
optional cloud account into a hard install dependency. ork hooks instead stay output-format
agnostic and append JSONL under `~/.claude/analytics/` (`hook-timing.jsonl`,
`agent-usage.jsonl`, `session-summary.jsonl`, `skill-usage.jsonl`, `task-usage.jsonl`,
`team-activity.jsonl`). Anything that wants traces bridges from those files in one long-lived
process, where SDK init is amortized instead of repeated.

Upstream: `src/skills/telemetry-inspect/SKILL.md` for the file inventory and health checks, and
`references/dev-agent-lens.md` for the proxy layer that sits at the API boundary instead.

## Treat Langfuse's three version numbers as three separate axes

Why: the Python SDK (4.x), the JS/TS SDK (5.x) and the self-hosted platform (v3, Postgres plus
ClickHouse plus Redis plus S3 or blob) move independently. "Correcting" one number into another
has repeatedly turned accurate documentation into wrong documentation here, which is why the
repo's skill-authoring rule calls out Langfuse by name under "Distinguish version axes". A doc
saying "Langfuse v3 requires ClickHouse" is talking about the platform and is correct. This
skill's `targets:` floor and `upstream-version-tested:` both describe the Python SDK axis only.

Upstream: `.claude/rules/skill-authoring.md`, section "Version and API Claims Must Be
Machine-Checkable".

## Confirm a `@langfuse/*` package and every imported symbol exist before writing the import

Why: two shipped scars. `LangfuseExporter` was documented across four files in this repo and has
never been exported by any published version of `@langfuse/otel`, and `@langfuse/vercel` was
documented for months and was never published at all (the real package is
`@langfuse/vercel-ai-sdk`). No version gate can catch a symbol that never existed, so the check
has to happen at authoring time: `curl registry.npmjs.org/<pkg>/latest` for the package, then
read the published `dist/index.d.ts` for the symbol. Related trap: `@langfuse/core` is an
internal utility package with no `Langfuse` export, so it is never the client.

Upstream: `references/langfuse-js-v5.md` holds the verified symbol table, and
`.claude/rules/skill-authoring.md` codifies the check.

## Do not present a Python service tree as OrchestKit's own observability implementation

Why: distilled from the retired orchestkit-langfuse-traces example (plus the multi-judge and
prompt-management references deleted alongside it); no traced incident. All three described a
different codebase that happened to share the name, citing `backend/app/shared/services/...`
modules, a `QUALITY_INITIATIVE_FIXES` doc and an 8-agent LangGraph analysis pipeline, none of
which exist at HEAD. The same content attributed a Jinja2
prompt-fallback design to "Issue #414"; `gh issue view 414` resolves to "fix(tests):
multi-instance-lock security tests skip, hook was deleted in #361", so the attribution was
false. OrchestKit ships a Claude Code plugin (skills, agents, TypeScript hooks); its own
observability surface is the JSONL analytics files above, not a FastAPI backend.

Upstream: `.claude/rules/skill-authoring.md` for the provenance bar, and `CLAUDE.md` for the
actual directory structure.
