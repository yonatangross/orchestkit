# CC adoption triage: 2.1.221 to 2.1.241 (2026-08-24)

Method: two dynamic workflows (`cc-adoption-sweep`, `cc-adoption-sweep-239`), one read-only Explore agent per open `cc-adoption` feature issue, verifying the changelog bullet against ork's real surfaces at HEAD `849b0550f` (hooks.json and entries maps, settings profiles, `.mcp.json`, agent frontmatter, the named skills' docs, the version snapshot). Every verdict other than `noop` got an adversarial refute agent whose default was `refuted=true`. Every `noop` proof command was re-run by hand before the issue was closed; two agent proofs were corrected in the closing comment (#3617: nine hooks emit allow-with-context, not three; #3586: a vitest test name matched the grep). One coverage defect in the sweep itself is recorded here rather than hidden: the first run was fed a hand-typed number range, so 16 of its 29 numbers were merged PRs or already-closed issues and 16 real issues (#3584-#3600) were missed; the follow-up run covered them. Junk numbers fed and discarded: #3606, #3607, #3608, #3609, #3610, #3611, #3612, #3623, #3624, #3625, #3626, #3627, #3628, #3629, #3630, #3631.

Result over the 31 in-scope issues: doc_only 3, noop 27, real 1.

## Watcher run (dispatch 32755602696)

Snapshots for 2.1.239, 2.1.240, 2.1.241 landed via #3719 (auto-merged 17:22:48Z). Extraction worked: 2.1.239 yielded 14 features from 59 bullets, the evidence gate filed 2 (#3715, #3716) and skipped 12 with no plugin-tree reference; 2.1.240 and 2.1.241 are featureless. The run also filed a false 'manual triage needed' stub (#3717) because the ledger's permanent below-floor `2.1.219 parse_failed` sentinel keeps the fallback guard truthy on every run; root cause and fix shape in #3720. Closed with proof.

## Per-version verdicts

| version | issue | verdict | feature key | refuted |
|---|---|---|---|---|
| 2.1.221 | #3615 | doc_only | `sandbox_credential_mask_mode` | no |
| 2.1.221 | #3616 | noop | `plugin_skills_root_path` |  |
| 2.1.222 | #3617 | noop | `pretooluse_autoallow_bg_task_bypass` |  |
| 2.1.222 | #3618 | noop | `sendmessage_permission_classifier` |  |
| 2.1.222 | #3619 | noop | `disable_model_invocation_refusal` |  |
| 2.1.222 | #3620 | noop | `remote_control_autostart_user_scope` |  |
| 2.1.225 | #3613 | noop | `mcp_oauth_keychain_401_burst` |  |
| 2.1.225 | #3614 | noop | `sendmessage_recipient_no_swap` |  |
| 2.1.227 | #3602 | noop | `action_allowed_non_write_users_bash+2.1.227` |  |
| 2.1.229 | #3603 | noop | `commit_push_pr_dangerous_flags` |  |
| 2.1.229 | #3604 | noop | `remote_control_continue_flag` |  |
| 2.1.229 | #3605 | noop | `marketplace_command_source` |  |
| 2.1.232 | #3584 | doc_only | `subagent_fork_default_background` | no |
| 2.1.232 | #3585 | noop | `sendmessage_bare_name_delivery` |  |
| 2.1.232 | #3586 | noop | `gateway_desktop_overlay_schema` |  |
| 2.1.232 | #3588 | noop | `at_mention_other_session` |  |
| 2.1.232 | #3589 | real | `gitlab_token_redaction_glab_sandbox` | no |
| 2.1.232 | #3590 | noop | `managed_sandbox_binary_approval` |  |
| 2.1.233 | #3591 | doc_only | `todo_task_tools_removed_new_models` | yes |
| 2.1.233 | #3592 | noop | `worktree_gitlab_mr_url` |  |
| 2.1.233 | #3593 | noop | `webfetch_cache_ttl_env` |  |
| 2.1.234 | #3594 | noop | `fullscreen_restart_preserves_perms` |  |
| 2.1.234 | #3595 | noop | `bg_task_notify_system_reminder` |  |
| 2.1.234 | #3596 | noop | `add_dir_midturn` |  |
| 2.1.234 | #3597 | noop | `session_list_truncation_notice` |  |
| 2.1.235 | #3598 | noop | `send_message_oversize_refusal` |  |
| 2.1.236 | #3599 | noop | `send_message_burst_refusal` |  |
| 2.1.236 | #3600 | noop | `sandbox_wildcard_read_deny_precedence` |  |
| 2.1.238 | #3642 | noop | `mcp_json_headers_helper_trust_gate` |  |
| 2.1.239 | #3715 | noop | `hook_keepalive_no_idle_reap+2.1.239` |  |
| 2.1.239 | #3716 | noop | `listagents_self_name_field` |  |

## What changed because of this triage

- **Docs (4 stale claims, 7 files)**: `security-patterns/SKILL.md` (2.1.221 mask mode; the `ork.settings.json` credentials baseline was retired in #3357 so the doc claim was false at HEAD; masking misattributed to 2.1.224), `review-pr/SKILL.md` routing summary (2.1.223 `/review` alias), `chain-patterns/references/fork-pattern.md` + `brainstorm/SKILL.md` (2.1.232 fork on by default, `subagent_type: "fork"` first-class), `doctor/references/agents-validation.md` + `task-dependency-patterns/SKILL.md` (2.1.233 Task tools removed for newest models unless `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, which ork cannot ship), plus 2.1.232 and 2.1.233 rows in `version-compatibility.md`. PR: docs/cc-adoption-2.1.221-223-doc-fixes.
- **Code (1 real finding)**: #3589, GitLab `gl<kind>-` token prefixes added to all three of ork's redaction layers (`secret-handler/patterns.ts`, `skill/redact-secrets.ts`, `lib/crypto.ts`) with tests. PR: fix/3589-gitlab-token-redaction.
- **Refuted upgrades**: #3591 was first triaged as `real` (ship `CLAUDE_CODE_ENABLE_TODO_TOOLS` in the plugin settings profiles) and refuted because CC honours that flag only from user or managed settings, so a plugin-shipped value is inert; the honest fix is the documented caveat.
- **Pipeline**: #3720 filed (fallback stub fires on a permanent below-floor sentinel and blames every ledger version).

## Verdict pattern worth keeping

Of the in-scope issues, the `affected skills` keyword match was a false positive in nearly every `noop`, matching the ~60% prior; the real signal was whether ork ships any config key, hook matcher, or doc sentence that the bullet touches. Three verdicts flipped under refutation or hand re-check, all in the direction of *less* change (real to doc_only, or a proof corrected without changing the verdict). The one finding that survived every pass (#3589) was not about a CC surface at all but about ork's own parity with a CC behaviour: CC redacts GitLab tokens for glab, ork drives glab, ork did not redact them.

## Support window

`latest_known` advances 2.1.238 to 2.1.241 with this triage. `supported_floor` stays 2.1.220 under the owner override (expires 2026-11-20); this is a latest_known-only bump, not a floor bump.

