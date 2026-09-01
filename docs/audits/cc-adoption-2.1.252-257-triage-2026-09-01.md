# CC adoption triage: 2.1.252 and 2.1.257 (2026-09-01)
Method: hand triage in lane `adopt-cc-257`, reading every bullet of the two published versions against ork's real surfaces at HEAD `4b266d3c9` (hooks and their entries maps, `src/agents/*.md` frontmatter, the named skills' references, `shared/cc-support.json`, `src/hooks/src/lib/models.vocab.json`, the memory notes on worktree isolation) and against hq-ext at `c0868ba`. 2.1.253 through 2.1.256 were never published: the upstream CHANGELOG jumps from 2.1.252 to 2.1.257 (verified against the 382-version parse by `scripts/cc-release-watch.mjs`). Snapshots for both versions were written from a local CHANGELOG fixture (`CC_RELEASE_WATCH_FIXTURE`), no LLM extraction was run, and the rows below were written by hand into `shared/cc-adoption-gaps.json` with the same slugs. Nothing in this triage ran a test suite; verification is the CI on the PR.
Every VERIFIED claim below names the command or file that established it; everything else is read from the changelog (CLAIMED).
Result over the 33 rows: adopted 3 (1 code, 2 doc), adopted-doc 3, deferred 2, upside 15, watch 1, noop 9.
## Disposition vocabulary
| disposition | meaning |
|---|---|
| adopted-in-pr | shipped in the same PR as this document |
| adopted-doc | documented in a skill reference in this PR; no code surface |
| deferred-S | a sized follow-up, listed in the lane report; not shipped here |
| upside | ork benefits by running the new binary; nothing to change |
| watch | a behavior that could bite a named ork surface; re-check on next use |
| triaged-noop | no ork surface, with the proof command |
| triaged-noop-cc-native | CC now owns it; per `shared/rules/cc-native-first.md` ork must not add a twin |
## 2.1.252
| feature key | category | relevance | ork | hq-ext | note |
|---|---|---|---|---|---|
| `bug_fixes_only_252` | new_attr | plugin | triaged-noop | upside | Already recorded as featureless in cc-support.json (2026-09-01 note). No settings keys, hook events, tools or permission surfaces changed. |

## 2.1.257
| feature key | category | relevance | ork | hq-ext | ork note |
|---|---|---|---|---|---|
| `fable_5_1_default_model` | new_attr | plugin | adopted-in-pr | upside | Added to src/hooks/src/lib/models.vocab.json (fullIds + pricing, `fable` alias now resolves to 5.1 like CC does) and tests/ci/claude-model-ids.txt. cost-estimator picks the $0.25 cache-read rate up via the vocab import. |
| `subagent_model_force_env` | new_attr | plugin | deferred-S | no-op | Documented in configure/cc-version-settings.md. DEFERRED (S): fable-spend-consent still prompts on an explicit fable pin that CC will ignore when FORCE is set; add an env short-circuit. The 23 explicit `model:` pins (7 haiku, 10 sonnet, 6 opus) and test-agent-model-tool-correlation.sh stay correct as authoring policy but are inert under FORCE; note that in agent-authoring.md. |
| `effort_session_scope` | new_command | end-user | triaged-noop | no-op | Doc note only. Skill-level `effort:` frontmatter is a different mechanism and is untouched. |
| `block_reads_outside_working_dirs` | new_perm | plugin | deferred-S | watch-unfiled | Documented in configure/cc-version-settings.md. DEFERRED (S): ork skills read ~/.claude (analytics, dream, memory) and cross-repo paths; doctor should warn when the key is true and additionalDirectories does not cover those paths. |
| `time_format_timezone_settings` | new_attr | end-user | adopted-doc | no-op | Documented in configure/cc-version-settings.md. Operator proposal: timeFormat 24h. |
| `containment_escape_auto_mode_rule` | new_perm | plugin | triaged-noop-cc-native | upside | network-egress-guard.ts has no metadata-endpoint coverage (grep 169.254 in src/hooks/src: 0 hits). CC now covers it natively in auto mode; per shared/rules/cc-native-first.md do not add a regex twin. |
| `default_mode_bypass_ignored_project_scope` | breaking | plugin | adopted-doc | no-op | Documented in configure/cc-version-settings.md. ork's tracked settings set no defaultMode (grep: 0). Users who fled to bypass mode via project settings (08-31 feedback) lose it silently; the doc says where it must live now. |
| `worktree_isolation_bash_loop_fix` | breaking | plugin | upside | upside | 25 agents declare `isolation: worktree` (grep src/agents). Free. The cross-repo `git -C` refusal (hq-ext #795) is a different check and is NOT lifted by this bullet. |
| `worktree_common_gitdir_write_after_cd` | breaking | plugin | upside | upside | Free. A plausible contributor to the 'worktree operations exit 0 but do nothing' reports in memory; not re-measured here. |
| `claude_p_waits_for_monitor` | breaking | plugin | watch | no-op | Headless callers with an outer timeout (tests/evals/scripts/lib/eval-common.sh run_with_timeout 30; ci-sentinel ORK_SENTINEL_PER_PR_TIMEOUT_S 300) will now hit that timeout if the model arms a Monitor. Watch on the next eval run; no code change yet. |
| `disallowed_tools_reload_fix` | breaking | plugin | upside | upside | No ork guard depends on the CLI flag; agent frontmatter disallowedTools is a different mechanism. Free. |
| `bash_read_edit_deny_redirect_fix` | breaking | plugin | upside | upside | Strengthens the CC-native Read() deny rules that replaced credential-read-guard in purge wave 3 (#3840). Free. |
| `permissions_ask_compound_auto_mode_fix` | breaking | plugin | upside | upside | Free; ork ships no permissions.ask rules of its own. |
| `zsh_double_bracket_prompt_fix` | breaking | plugin | upside | upside | Free. |
| `plugin_symlink_component_refused` | breaking | plugin | triaged-noop | no-op | plugins/ork contains 0 symlinks (find -type l, VERIFIED). No-op. |
| `add_dir_inside_cwd_loads_components` | new_attr | plugin | triaged-noop | no-op | No ork surface depends on it. |
| `fork_keeps_prompt_cache` | new_attr | plugin | upside | upside | Free for the 80 `context: fork` skills. |
| `subagent_autocontinue_after_cutoff` | breaking | plugin | upside | upside | subagent-stop/retry-handler.ts is orchestration-level (failed agent, suggest alternative), not a mid-stream retry, so nothing to subtract. Free. |
| `background_session_lifecycle_fixes` | new_attr | plugin | upside | upside | Free. ork drives no `claude --bg`; herdr is a separate multiplexer and unaffected. |
| `stream_json_non_jsonl_fail_fast` | breaking | plugin | upside | no-op | eval-common.sh:258 pipes probe input into --input-format stream-json; a malformed probe now errors instead of hanging. Free. |
| `gateway_model_description_and_discovery` | new_attr | end-user | triaged-noop | no-op | llm-integration/model-selection.md already documents the discovery env. Note only. |
| `sandbox_denied_domains_trailing_dot` | breaking | plugin | upside | upside | Closes a bypass in the deniedDomains rollout (#3322/#3424) that network-egress-guard's retirement is gated on. Free. |
| `doctor_stale_sandbox_mask_warning` | new_command | end-user | triaged-noop-cc-native | no-op | CC's /doctor now owns this; ork's sandbox-posture lib does not duplicate it (cc-native-first). |
| `code_review_comment_gitlab` | new_attr | plugin | adopted-in-pr | no-op | One-line note added to review-pr/SKILL.md next to the existing --comment sentence. |
| `settings_dir_created_after_startup` | breaking | plugin | upside | no-op | The ConfigChange settings-reload hook now also sees a late-created project settings file. Free. |
| `background_command_detach_and_monitor_stop_fixes` | breaking | plugin | upside | no-op | Free. |
| `add_dir_refuses_network_paths` | breaking | plugin | triaged-noop | no-op | No network paths in any ork settings profile. |
| `proactive_style_busy_loop_fix` | breaking | end-user | triaged-noop | no-op | ork ships no Proactive style. |
| `btw_history_keys_changed` | new_command | end-user | triaged-noop | no-op | No ork doc cites the old keys (grep /btw and Ctrl+E: 0 in src). |
| `managed_settings_and_policy_helper_changes` | new_attr | end-user | triaged-noop | no-op | No managed settings in the estate. |
| `provider_auth_and_remote_control_fixes` | new_attr | end-user | triaged-noop | no-op | Not a plugin surface. |
| `vscode_ui_changes` | new_attr | end-user | triaged-noop | no-op | Not a plugin surface. |

## Evidence index (VERIFIED in this lane)
- `grep -h '^model:' src/agents/*.md | sort | uniq -c`: 7 haiku, 13 inherit, 6 opus, 10 sonnet.
- `grep -l '^isolation: worktree' src/agents/*.md`: 25 agents.
- `grep -rn '169\.254\|metadata\.google\|cross-tenant' src/hooks/src --include=*.ts`: 0 hits outside tests.
- `find plugins/ork -type l`: 0 symlinks. hq-ext: 3 symlinks, one of them `skills/hq-release-notebook/references/ingestion-report.md -> ../../hq-ingest/assets/ingestion-report.md`; the Read tool read it from the installed 1.58.1 cache under CC 2.1.257.
- `grep -rn defaultMode` in ork and hq-ext tracked settings: 0 hits.
- `grep -rn -- --disallowedTools` in hq-ext scripts, skills, hooks: 0 CLI callers.
- `tests/evals/scripts/lib/eval-common.sh:258` pipes probe input into `claude -p --input-format stream-json` under `run_with_timeout 30`; `.github/workflows/ci-sentinel.yml` bounds each `claude -p` at `ORK_SENTINEL_PER_PR_TIMEOUT_S=300`.
- `~/.claude/settings.json` (read only): `model` is `claude-fable-5-1[1m]`, `permissions.defaultMode` is `auto`, `blockReadsOutsideWorkingDirectories` unset, `timeFormat`/`timeZone` unset, `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` in env.
- `claude --version`: 2.1.257.

## Not done here, by design
- No `gh issue create` (lane rule), so the two deferred items and the watch item carry no issue numbers; they are sized in `/tmp/bench-0902/lanes/adopt-cc-257.md`.
- The `fable` alias in `models.vocab.json` was NOT advanced to `claude-fable-5-1`: `tests/skills/structure/test-model-recency.sh` ratchets every doc onto the alias target, so the advance is a doc sweep, not a one-line change. The new ID is in `fullIds` and `pricing`, so cost estimation and the vocab lint accept it today.
- hq-ext's `latest_known` stays at 2.1.240. Its ledger (`configs/cc-dispositions.json`) gained 2.1.252 and 2.1.257 entries, but 2.1.241 through 2.1.251 have no verdicts there and the #692 burial guard forbids bumping over them.
