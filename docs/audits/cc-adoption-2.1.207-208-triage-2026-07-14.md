# CC Adoption Triage — 2.1.207 & 2.1.208 (2026-07-14)

**Outcome:** `latest_known` advanced 2.1.206 → 2.1.208 (soft). `supported_floor`/`latest`/`drop_after` stay frozen at 2.1.206/2.1.206/2.1.205 by design — the strict `manual_override` pin holds; `latest_known` diverges from `latest` while the floor is frozen. No `.latest` fixture coupling touched.

**Decision:** Soft adoption-coverage advance, not a floor renewal. Owner chose against forcing users onto 2.1.208 (a same-day release) — ork is verified clean on both versions but users' installed CC is their own.

## 2.1.207 (Jul 11) — 2 BREAKING for plugin authors; ork verified CLEAN

| Change | Impact | ork exposure |
|--------|--------|--------------|
| Plugin option values no longer read from project `.claude/settings.json` (user-level / `--settings` / managed only) | Breaking for multi-workspace plugin config | **None** — `grep -rn 'pluginConfigs\|user_config' src/settings/ manifests/ork.json` = 0 hits |
| `${user_config.*}` in shell-form hook commands rejected (shell-injection fix) | Breaking for hooks templating user config into a shell string | **None** — `grep -rn '\${user_config' src/hooks/ manifests/ src/settings/` = 0 hits |
| Auto mode defaults no longer require opt-in on Bedrock/Vertex/Foundry; new `disableAutoMode` setting | Cloud-provider only | N/A — Platform CLI |

**User-facing note:** ork users who stored plugin config in a *project-level* `.claude/settings.json` must migrate it to `~/.claude/settings.json` for CC ≥ 2.1.207. ork itself ships no such config, so no ork change is required — this is a downstream-user heads-up only.

## 2.1.208 (Jul 14) — incremental; all no-op or upside for ork

| Change | Classification |
|--------|----------------|
| Auto-mode rule compilation now cached (fixes multi-second per-turn slowdowns on large deny/ask rulesets) | **Upside** — ork ships many permission rules; lower per-turn latency, no action |
| Agent tool: empty `tools: []` now returns a clear error naming unrecognized entries | No-op — `grep -rln 'tools: \[\]' src/agents/` = 0 hits (no empty-tools agents) |
| Memory-leak fixes: MCP stdio stderr, LSP documents, async hook output, SDK tool payloads | Upside — no action |
| `apiKeyHelper` failures fail fast (3 attempts vs 10 silent retries) | No-op for ork config |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` scientific-notation parse fix (`1e6` was truncated) | No-op — ork sets no such env expression |
| Screen reader mode, Vim remaps, process wrapper, mouse support, Edit/Read/Grep/Glob fixes | CC-internal — no ork surface |

## Stamped surface

Only `src/hooks/src/lib/cc-version-matrix.ts` `LATEST_KNOWN_CC` advanced to 2.1.208 (via `scripts/stamp-cc-support.mjs`). Floor-derived declarations (CLAUDE.md, README, `MIN_CC_VERSION`, doctor/troubleshooting docs) are unchanged because `supported_floor` held at 2.1.206.
