# Claude Platform adoption triage, 2026-08-01 to 2026-08-27

Closes the three `platform-watch` issues that had been open since 2026-08-21: #3641 (08-01 to 08-19), #3714 (08-20), #3762 (08-26, 08-27). Method is the one #3627 set when it added the platform feed: read each snapshot in `shared/platform-snapshots/`, decide adopt or decline-and-document per capability, and record the decision where the CC lane records its own (`docs/audits/cc-adoption-*-triage-*.md`). Nothing platform-shaped existed in `docs/audits/` before this file.

27 capabilities across 11 snapshots. 21 were triaged in #3641's first comment (ADOPT-NOW 3, ADOPT-LATER 4, DECLINE 14) and both ADOPT-NOW items landed in #3647; that verdict set is not re-derived here. This file covers the 6 that were never triaged and records the standing shape of the lane.

## The six open capabilities

| date | capability | verdict | evidence measured 2026-08-31 |
|---|---|---|---|
| 08-20 | Python SDK v1.0 (httpx2, py3.10 floor, removes Text Completions, `temperature`/`top_p`/`top_k` on Messages methods, the tool runner's `compaction_control`, sync `.with_raw_response`, errors without an AWS region on `AnthropicBedrock`) | **DECLINE, with one pin change** | Floor already satisfied: `pyproject.toml:5` is `requires-python = ">=3.11"`. None of the removals is used: a repo-wide grep for `compaction_control`, `AnthropicBedrock`, `Text Completions`, `client.beta.files`, `client.beta.skills` returns nothing in `src/skills`, `src/agents`, `src/hooks/src`. The four files that do pass `temperature`/`top_p`/`top_k` are not Anthropic calls: `llm-integration/scripts/dpo-training.py:346` is torch `model.generate`, `ollama-provider-template.py` and `llm-integration/SKILL.md` are `ChatOllama`, `langgraph/rules/tools-dynamic.md:41` is a retrieval `top_k`. The one real finding is the unbounded pin, below. |
| 08-26 | Compliance API session endpoints out of beta (Cowork, Claude Code) | DECLINE | Enterprise admin surface. No ork code reads compliance endpoints. |
| 08-26 | Local session endpoints also return Claude Science and M365 `office_agents*` transcripts | DECLINE | Same surface. Grep for `claude_science`, `office_agents`, `product_surface` across `src/`: zero. |
| 08-26 | Admin API in the `ant` CLI and 7 SDKs under `client.beta.organization` | DECLINE | ork ships no org-admin path. Every `Admin API` string in the repo is MongoDB Atlas (`emulate-seed`, `emulate-engineer`). |
| 08-27 | SDKs stop sending the `files-api-2025-04-14` / `skills-2025-10-02` beta headers; `BetaSkill` renamed `BetaContainerSkill` | DECLINE | Zero occurrences of either symbol or of `client.beta.files` / `client.beta.skills`. ork publishes skills through `scripts/publish-skills.mjs`, which does not use the Python or TS beta namespaces. |
| 08-27 | Personal keys and service-account keys creatable in the Console; workspace keys become legacy | **DOC NOTE** | `src/shared/rules/cc-bare-auth-gotcha.md` talks about API keys throughout and distinguishes no key kind: a grep for `workspace`, `service account`, `personal` in that file returns 0. Same for `bare-eval/rules/bare-requires-api-key.md`. Worth one paragraph when either file is next edited; not worth a PR of its own. |

## The one action

`pyproject.toml:24` pins `anthropic>=0.40.0` with no upper bound, and the SDK has since shipped a major that removes public API. The measurement above says ork's call sites survive 1.x untouched, so this is not urgent and the cap is not a fix for the removals; it is a guard against the next major arriving unannounced in a fresh install. Capped at `<2` in this PR.

## Standing shape of the lane, so the next reader does not re-derive it

- `scripts/platform-release-watch.mjs` has no LLM extraction lane (`claude-release-watch.yml:150-153` says so). Snapshot presence on disk is the only state; `features: []` in `shared/platform-adoption-gaps.json` is never populated, and the file is pruned to `[]` once the filer has stamped `issues_filed_at`. Triage is human by construction.
- Closing these three issues cannot cause a re-file: the filer keys off snapshot absence, and all 11 snapshots are on main.
- The `experimental:` plus `exit-criteria` frontmatter convention #3627 nominated for tracking a skill that depends on a platform capability is documented in `doctor/references/version-compatibility.md:10-24` and remains unused: zero `experimental:` keys across all 106 `src/skills/*/SKILL.md`.
- `docs/site` renders no platform adoption board. The only platform artefact under it is the static `public/lab/platform-watcher-3627.html`.

## What was deliberately not done

No skill or hook changes. Four of the six are structurally out of scope for a Claude Code plugin (Enterprise compliance and admin surfaces, SDK-internal beta headers), and saying so in a dated file is the whole point of decline-and-document: the next watcher run will not re-open the question, and a reader who wonders why ork ignores the Compliance API has an answer with a date on it.
