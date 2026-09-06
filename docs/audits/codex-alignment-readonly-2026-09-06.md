# Codex configuration: read-only alignment report (2026-09-06)

Requested by Yonatan via recovery-verifier-11242. **Read-only.** Nothing was
configured, installed, deployed or altered. No remediation was applied.

Every line is tagged MEASURED (a command in this session established it) or
UNMEASURED (not established here, stated as unknown).

---

## 1. Are the installed artifacts current supported targets?

**Both yes.** MEASURED.

| artifact | installed | canonical declares | verdict |
|---|---|---|---|
| `ork-codex` | `10.0.0-alpha.80` | `10.0.0-alpha.80` | current |
| `hq-codex` | `1.41.6+codex.20260821074500` | `1.41.6+codex.20260821074500` | current |

Commands:

- `ls ~/.codex/plugins/cache/orchestkit-codex/ork-codex/` gives `10.0.0-alpha.80`.
- `git show origin/main:plugins/ork-codex/.codex-plugin/plugin.json` gives `"version": "10.0.0-alpha.80"`.
- `git show origin/main:package.json` gives `10.0.0-alpha.80`, and `scripts/build-codex-plugin.sh:28` reads the version from `package.json`, so the built artifact tracks the release train.
- `ls ~/.codex/plugins/cache/yonatan-hq-codex/hq-codex/` gives `1.41.6+codex.20260821074500`.
- `hq-ext-plugin/plugins/hq-codex/.codex-plugin/plugin.json` at repo HEAD `24851e2` declares the same string.

Host: `codex-cli 0.153.4` (MEASURED, `codex --version`).

Both installs are complete, not skeletons. MEASURED:

- `ork-codex` cache carries `skills/` (6), `roles/` (4), `mcp.json`, `scripts/`.
- `hq-codex` cache carries `skills/` (6), `hooks/`, `configs/`, `tests/`.

Correction recorded: an earlier probe in this session ran `ls ~/.codex/skills | grep ^ork`
and returned zero, which I first read as "the ork skills are not installed". That
was wrong. Codex loads plugin skills from the plugin cache, not from `~/.codex/skills`,
and the cache does carry all six.

---

## 2. Canonical source refs

| what | ref |
|---|---|
| ork-codex source of truth | `yonatangross/orchestkit` -> `src/codex/ork-codex/` |
| ork-codex build | `scripts/build-codex-plugin.sh` -> `plugins/ork-codex/` (generated, do not hand-edit) |
| ork-codex roster manifest | `manifests/codex/ork-codex.json` |
| hq-codex source of truth | `Yonatan-HQ/hq-ext-plugin` -> `plugins/hq-codex/` |
| the bridge between them | `hq-ext-plugin/plugins/hq-codex/configs/ork-bridge.json` |
| live host config | `~/.codex/config.toml` (260 lines), `~/.codex/agents/`, `~/.codex/AGENTS.md` |

---

## 3. Required skills, roles, MCP and hook settings

### ork-codex (MEASURED from `manifests/codex/ork-codex.json` and the installed cache)

- **Skills (6):** `ork-brainstorm`, `ork-explore`, `ork-assess`, `ork-verify`, `ork-review-pr`, `ork-implement`.
- **Roles (4):** `ork_explorer`, `ork_implementer`, `ork_reviewer`, `ork_verifier`.
  Installed to `~/.codex/agents/` via `plugins/ork-codex/scripts/install-codex-roles.sh`.
  All four are present on this machine (MEASURED, `ls ~/.codex/agents`).
- **MCP (1):** `context7`, http, `https://mcp.context7.com/mcp`, bearer via env var
  `CONTEXT7_API_KEY_CODEX`, tools limited to `resolve-library-id` and `query-docs`.
  `~/.codex/config.toml:56` has `[mcp_servers.context7]` with a `bearer_token_env_var`
  key present (MEASURED; the value was deliberately not read).
- **Hooks:** none. ork-codex ships no hook surface, by design ("without Claude-only
  commands or hooks", its own `longDescription`).

### hq-codex (MEASURED from the installed cache)

- **Skills (6):** `hq-conductor`, `hq-handoff`, `hq-knowledge`, `hq-mcp-verify`, `hq-ops`, `hq-plan`.
- **Roles:** none of its own.
- **MCP:** registers none. Its own `longDescription` states "no credentials or
  duplicate MCP registration"; it consumes the hq-* servers already declared in
  `~/.codex/config.toml`. Eight are present there: `hq-ops`, `hq-knowledge`,
  `hq-media`, `hq-calendar`, `hq-cms`, `hq-channels`, `hq-commerce`, `hq-browser`.
- **Hooks (1):** `PreToolUse`, matcher `^Bash$`, command
  `python3 "$PLUGIN_ROOT/hooks/ratchet_guard.py"`, timeout 5,
  statusMessage "Checking measured-value ratchet".

### Alignment with Claude Code

The Claude side runs `ork` `10.0.0-alpha.80` (same release train, MEASURED from
`CLAUDE_PLUGIN_ROOT`) and `hq-ext` `1.61.0` installed. The hq-ext repo working
copy is at `1.60.1` (MEASURED), so the local checkout trails the installed plugin
by one patch. That is an hq-ext checkout observation, not a Codex problem.

---

## 4. Approved changes since 2026-08-21

**Two functional commits total across both repos.** MEASURED.

| repo | commit | note |
|---|---|---|
| orchestkit | `dc3bfe805` | `feat(ork-codex): ship ork-implement and one install matrix (#3753)` |
| hq-ext-plugin | `8812e9f` | `feat(codex): add HQ MCP transport contract (#1108)` |

`git log origin/main --since=2026-08-21 -- src/codex/ plugins/ork-codex/ manifests/codex/ scripts/build-codex-plugin.sh`
returns 38 commits, but 37 of them are `chore(main): release 10.0.0-alpha.NN`
version bumps that only restamp `plugin.json`. `dc3bfe805` is the single change
with content.

---

## 5. One contract mismatch found, NOT changed (corrected 2026-09-06)

An earlier draft of this section filed two independent gaps and called the bridge's `pinned_ref` "dead metadata". Yonatan read `hq-ext-plugin/scripts/validate_codex_ork_bridge.py` and corrected it: `minimum_version` IS checked, the CLI requires `--ork-source-root`, and `validate_pin_provenance` compares the pinned Git manifest's version to the installed version. The two findings are therefore one.

MEASURED:

- `git show 5092fff91077d96e6ac109393378f233aac21809:src/codex/ork-codex/.codex-plugin/plugin.json` gives `"version": "9.5.4"`.
- `git show 5092fff91...:manifests/codex/ork-codex.json` gives `"version": "9.5.4"`. At the pinned ref the two files agreed.
- On `origin/main` today, `plugins/ork-codex/.codex-plugin/plugin.json` is `10.0.0-alpha.80` (stamped from `package.json` by `scripts/build-codex-plugin.sh:28`) while `manifests/codex/ork-codex.json` is still `9.5.4`. The manifest stopped being stamped.

So `hq-ext-plugin/plugins/hq-codex/configs/ork-bridge.json` pins `pinned_ref: 5092fff91` (release `10.0.0-alpha.43`, 2026-08-20, 201 commits behind `origin/main`) and `minimum_version: 9.6.1`, and provenance validation compares a pinned `9.5.4` against an installed `10.0.0-alpha.80`. Static evidence predicts the provenance check fails. No runtime test was run and no change was made.

## 6. Explicitly UNMEASURED

- Whether `hq-codex` `1.41.6` is deliberately decoupled from `hq-ext` `1.60.1`,
  or is lagging. The `+codex.<timestamp>` build metadata suggests independent
  stamping, but I found no policy document stating the intent.
- Whether `CONTEXT7_API_KEY_CODEX` is actually populated. I confirmed the config
  references a bearer env var by name and deliberately did not read the value or
  the environment.
- Whether the bridge's `minimum_version` / `pinned_ref` are enforced at runtime
  (see 5b).
- Any behavioural verification. Nothing was executed under Codex. This report is
  static: artifact versions, file contents and git history only.

---

## 7. Recommendation (advisory only, nothing applied)

Ranked, and all three are someone else's call to make:

1. Decide the fate of `ork-bridge.json`'s `pinned_ref`. 201 commits is far enough
   that "pinned" now means "pinned to something nobody is running". Either
   re-pin it to the current release, or delete the field if nothing reads it.
   Deleting an unenforced pin is better than carrying a wrong one.
2. Make `manifests/codex/ork-codex.json`'s `version` either stamped or removed.
   The build already knows the right number; a hand-set copy that nothing checks
   only creates a second, wrong answer.
3. State the hq-codex / hq-ext version relationship somewhere, so `1.41.6`
   against `1.60.1` is readable as intent rather than as lag.

---

## Coordination note for the Pi CC-alignment audit

Non-overlapping split, so results can be merged without double-counting:

- **This report covers:** the Codex host only. Installed versions, canonical
  refs, the ork-codex and hq-codex skill/role/MCP/hook surfaces, `~/.codex/config.toml`
  structure, and codex-path git history since 2026-08-21.
- **This report does NOT cover:** the Claude Code side of alignment. The `ork`
  and `hq-ext` Claude plugin surfaces, `.claude/settings*.json`, CC hook
  registration, and the CC permission model are Pi's half.
- **The one datum both halves need:** both hosts run the same OrchestKit release
  train, `10.0.0-alpha.80`. If Pi measures a different number on the Claude side,
  that disagreement is the finding and this file's section 1 is the counter-evidence.
- **Shared risk worth cross-checking:** section 5's pattern (a declared value with
  no enforcing test) is the same defect class found and fixed on the Claude side
  today in PR #3933, where `test-cc-version-floor.sh` grepped for a marker string
  that had never existed and logged PASS on absence. Worth asking whether the
  Codex-side validators have the same fail-open shape.
