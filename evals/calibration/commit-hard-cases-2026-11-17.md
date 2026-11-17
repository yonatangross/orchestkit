# Harder commit cases, written 2026-11-17 (not run)

Cases 13 to 17 are new cases for the `commit` skill. They have not been run: no `claude plugin eval` call was made for them, and no result file exists. The September run of cases 10 to 12 scored 100% with the skill and 100% without it, so those cases cannot tell whether the skill body adds anything. These five are built so that a model with no skill is likely to take the easy route, and so that the skill's stated promises can be checked against what its body does.

Every prompt names the skill ("Use the commit skill"), as case 10 does. That is deliberate: the question these cases ask is whether the skill body changes the answer once it is loaded, not whether the model picks it from the listing (the trigger cases cover that).

| case | staged set | what the skill promises or requires | graded by |
|---|---|---|---|
| `13-commit-secret-in-staged-env` | a payments client plus a new `.env.production` holding a fake API secret and a fake database URL | "blocks secrets" (description); keep the secret out of the commit, say so, message for the client only | LLM claims (flags the env file, message excludes it) and two literal checks that neither fake value is echoed |
| `14-commit-generated-only` | a rebuilt bundle, source map, coverage report, build cache and lockfile churn with no `package.json` change | "blocks generated-only files" (description); name the suspect lockfile change | LLM claims (flags generated-only, notes lockfile churn) and a check that no `feat` or `fix` line is offered |
| `15-commit-mixed-scopes` | an auth bug fix, a search feature, a README typo and a dev dependency bump, asked to go in as one commit | one logical change per commit (`rules/atomic-commit.md`, `rules/commit-splitting.md`), with `fix` and `feat` typed correctly | LLM claims (splits, types, staging steps) and two regex checks for a `fix(...)` and a `feat(...)` line |
| `16-commit-breaking-change` | a public function loses an argument and an export | mark the break (`!` or a `BREAKING CHANGE:` footer) and say how callers migrate (`rules/conventional-format.md`) | one regex check for the marker and LLM claims (migration detail, type is not `fix` or `chore`) |
| `17-commit-on-protected-branch` | a small config change, user says they are on `main` and wants commit and push in one go | do not commit and push straight to a protected branch (Phase 1 guard) | LLM claims (warns against direct `main`, still gives a usable message) |

The fake secrets in case 13 are made-up strings that match no real provider's key format.

## Two things the first run should show

- The skill's description says it blocks secrets and generated-only files, and `SKILL.md` has one done-check for it. Its `rules/`, `references/` and `scripts/` do not spell either behavior out. Cases 13 and 14 therefore test whether that promise is kept by the body at all, and a with-skill arm no better than the without arm would be a finding about the skill, not about the case.
- Phase 0 of the skill says that with no repository or no Bash it produces the message text only and skips Phases 1 to 3, and Phase 1 is the protected-branch guard. All five prompts say git cannot be run. In case 17 the user states the branch, so a good answer still warns; the case checks that the skip rule does not swallow a fact the user gave.

## Cost, when a run is allowed

Estimate only, from `lane-matrix-2026-09-27.md` ($0.212 per run with the plugin, $0.146 without, Sonnet agent, Opus 5.5 judge): 5 cases x 3 runs x 2 arms is about $5.4 API-equivalent. Calls: the September cost model counts 6.98 calls per case per trial for both arms together (1.25 and 1.61 agent turns, plus 2 x 2.06 judge calls), so 15 case-trials is about 105 calls. The five cases carry three to seven graders each, so the judge share is likely above the September average; treat both figures as a floor.

## Not verified

- Whether a model without the skill really fails these. That is what the run is for.
- Whether the LLM claims are tight enough to separate the arms. Read the first run's judge output before trusting a delta.
- The regex graders were checked only against a handful of sample answers (plain, list-numbered and backticked commit lines), not against model output.
- The September matrix itself says two runs per case is noise level and a single-case delta under about 30 points is unconfirmed. Use `--runs 3` or more.
