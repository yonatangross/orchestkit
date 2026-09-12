# Plugin evals (`claude plugin eval`)

How OrchestKit measures whether a skill actually changes the answer.

`claude plugin eval` runs a suite of prompts twice: once with the plugin loaded,
once without it. The headline number is the delta between the two arms, not the
pass rate. A skill that scores 9/10 with the plugin and 9/10 without it is doing
nothing, and only the ablation shows that.

Verified against Claude Code 2.1.269. The command is generally available and
needs no early-access flag.

## Where the cases live

```
evals/                        <- tracked source of truth
  10-commit-message-from-diff/
    prompt.md
    graders/
      conventional-prefix.md
      message-quality.md
      skill-fired.md
  ...
  results/                    <- raw reports, gitignored
```

The eval command reads cases from a directory **below the plugin root**, which
would be `plugins/ork/evals/`. That cannot be their home: `scripts/build-plugins.sh`
wipes everything under `plugins/` on every build. So the tracked home is `evals/`
at the repo root and `scripts/run-plugin-eval.sh` stages it into the plugin for
the duration of the run, then removes the staged copy.

This is a different thing from `tests/evals/`, which is OrchestKit's own older
YAML harness. The two do not share a format and neither replaces the other.

## Running it

```bash
bash scripts/run-plugin-eval.sh                      # pilot: 1 run per case, $3 ceiling
bash scripts/run-plugin-eval.sh --runs 3 --max-cost-usd 10
bash scripts/run-plugin-eval.sh --case '2*'          # one skill's cases
```

Every case is tagged with its skill and with `fire` or `negative`, so a run can
be scoped without knowing the numeric prefixes:

```bash
bash scripts/run-plugin-eval.sh --tag commit       # the 3 commit cases
bash scripts/run-plugin-eval.sh --tag negative     # the 3 should-NOT-fire cases
```

Both filters were confirmed against a real run's `run.json`, selecting exactly
three cases each.

Raw reports land in `evals/results/<timestamp>/` as `run.json`, `report.html`,
and `aggregate-result.json`. `scripts/summarise-eval-run.mjs` turns the newest
one into a markdown delta table, and says so loudly when runs errored or the run
was partial, so a failed run is never read as a quality verdict.

### What a run costs

Each case runs once per arm per `runs`, and **each `llm` grader costs three judge
votes** on top of the agent turn, because the judge decides by majority of three.
Every case here has exactly one `llm` grader, so:

| Mode | Agent runs | Judge calls |
|---|---|---|
| Pilot, `--runs 1` | 18 | 54 |
| Full suite, `--runs 3` | 54 | 162 |

The dollar figure is list-price, but on a Max plan the real cost is weekly quota
drawn from the same pool as interactive sessions.

Two things the wrapper handles that are easy to get wrong by hand:

- **`--no-publish` is mandatory.** The HTML report is published to claude.ai by
  default. Every run this repo makes keeps it local.
- **`--judge-model sonnet`.** The default judge is haiku, which is too small to
  grade a rubric reliably. The judge must also not be the agent model, to avoid
  self-preference.

## Case format

`prompt.md` frontmatter:

| Field | Meaning |
|---|---|
| `max_turns` | Turn ceiling for the run |
| `timeout_seconds` | Wall-clock ceiling; an under-set value reads as a 0 score, not a timeout |
| `allowed_tools` | Tools the run may use. Read-only tools are the default set |
| `model` | Override the agent model for this case |
| `runs` | Runs per case per arm, default 3 |
| `tags` | Labels for `--tag` filtering; a case runs if ANY tag matches |

The body is the user prompt. No absolute paths and no `~/`: cases run in a
sandbox working directory.

`graders/<name>.md` frontmatter picks the type:

| `type` | Frontmatter | Body |
|---|---|---|
| `regex` | `target`, `match` (`contains`, `not_contains`, `count:N`), `flags` | the pattern |
| `file_exists` | `path`, `exists` | none |
| `llm` | `focus`, `weight` | the rubric |
| `tool_used` | `tool`, `input_match`, `min`, `max`, `arm` | none |
| `tool_order` | `before`, `after` | none |

Defaults: `target`/`focus` is `last_message`, `weight` is 1, `match` is
`contains`, `tool_used.min` is 1.

## Rules this suite follows

These come from the eval command's own authoring guide, and breaking them makes
the number meaningless rather than merely imperfect.

1. **Grade outcomes, not trajectories.** A `tool_used: Skill` grader is reported
   under ablation but excluded from the score in both arms, so it never moves the
   delta. It is a display-only trigger check. It is never a case's only grader.
2. **Every skill gets a should-NOT-fire case.** A suite that only tests firing
   cannot catch over-triggering, which is the more common real-world failure.
   The negatives here set `min: 0`, `max: 0`, and `arm: both`.
3. **Spec literals are secondary.** A regex lifted from a SKILL.md format string
   is scored at `weight: 0.5` and always paired with an outcome grader as the
   primary. Otherwise the eval measures whether the skill quotes itself.
4. **`runs: 3` minimum.** Single-run scores are noise.
5. **Tools follow graders.** A grader that implies a side effect only passes if
   the case allows the tool that produces it.

## What the suite covers

| Case | Skill | Shape |
|---|---|---|
| `10-commit-message-from-diff` | `commit` | Types a security fix correctly and explains the why |
| `11-commit-scope-detection` | `commit` | Detects the `billing` scope, types a refactor as refactor |
| `12-commit-should-not-fire` | `commit` | A rebase-vs-merge question must not produce a commit |
| `20-prd-to-goal-basic` | `prd-to-goal` | One goal line, AND-joined shell-checkable assertions |
| `21-prd-to-goal-unfalsifiable` | `prd-to-goal` | A spec with no observable criteria must be refused, not faked |
| `22-prd-to-goal-should-not-fire` | `prd-to-goal` | A conceptual question must not produce a goal line |
| `30-glyph-status-render` | `glyph` | Four worker states drawn, failing distinguished from not-scheduled |
| `31-glyph-comparison` | `glyph` | Aligned side-by-side comparison, not two paragraphs |
| `32-glyph-should-not-fire` | `glyph` | A one-sentence factual answer needs no diagram |

All three skills are `context: inherit` and `complexity: low`, so a run is a
single agent turn rather than a subagent fan-out. That is deliberate: it keeps
the suite cheap enough to run on every PR that touches a skill.

## Known limitation on macOS

The eval runner creates its scaffold with `mkdtemp` under **bare `/tmp`** on
macOS. This is hardcoded and ignores `TMPDIR`. A Claude Code session whose
filesystem boundary denies bare `/tmp` cannot start any run, and fails with:

```
run could not start: EPERM: operation not permitted, mkdtemp '/tmp/e-XXXXXX'
```

Disabling the Bash tool sandbox for the command does not lift it. Either allow
writes to `/private/tmp`, or run the suite from a plain terminal.

## What the eval cannot measure

- **Hooks.** All 171 of them. The eval scores the agent's final message and the
  files it created, so a hook that blocks, rewrites, or annotates a tool call is
  invisible unless it changes that final message.
- **Anything needing a real repository.** The commit cases grade the message,
  not the commit, because cases run in an empty sandbox directory. Staging,
  pre-commit hook compliance, and secret detection are out of scope here.
- **Multi-turn behaviour.** Each case is one prompt. Skills whose value shows up
  across a conversation are not represented.
- **Agents.** A skill with `context: fork` spawns a subagent; the eval sees only
  what comes back.
