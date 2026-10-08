# Rule-check Mode (opt-in)

Source: claude.dev, "A harness for every task". Rule adherence is a harness, not a reviewer's afterthought: one verifier agent per rule against the diff, then a skeptic agent that filters false positives, and only the survivors are reported. A single reviewer holding every CLAUDE.md rule at once skims them; a verifier holding one rule does not.

Off by default. It runs when `/ork:review-pr` gets `--rules`, or when the user asks to check a change against their CLAUDE.md, rules files or "my rules".

## Pipeline

| Step | Who | What |
|------|-----|------|
| Collect | `scripts/collect-rules.mjs` | Reads `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/**/*.md` in the repo, then `~/.claude/CLAUDE.md` and `~/.claude/rules/**/*.md`, plus whole-line `@path` imports one level deep. Every path the reviewed PR controls is confined: the repo's own `CLAUDE.md`, `.claude/CLAUDE.md` and `.claude/rules/**` are read only when their realpath is a `.md` inside the repo root (a symlinked rules directory that leaves the repo is not even walked), and an import made from one of them only when its realpath is a `.md` inside the repo root (so a PR cannot import the operator's `~/.claude` memory into a review comment); an import made from `~/.claude/CLAUDE.md` or `~/.claude/rules/**` may also reach a `.md` inside `~/.claude`. Anything refused is listed in `skipped` (`missing`, `outside-root`, `symlink-escape`, `not-md`) and never opened, so a PR cannot pull a credential file from the home directory into a prompt. `~/.claude/CLAUDE.md` and `~/.claude/rules/**` are exempt: they are the operator's own files, often symlinked into a dotfiles repo. `--no-user` keeps it to the project. A file reached twice is read once. |
| Split | `workflows/rule-check.js`, plain code | Top-level list items (nested items and continuation lines fold in), table data rows, directive paragraphs and quotes become rules. Code fences, YAML frontmatter, HTML comments and table headers never do. Text without a directive word (must, never, always, do not, avoid, prefer, should, only, required, ...) is skipped and listed in `skipped`. A rule copied into several files is checked once; `alsoIn` names the copies. |
| Verify | one agent per rule, effort `low` | Reads the diff itself (`diffCommand`), answers `applies` and lists violations on ADDED or changed lines only, each with file, line and the quoted line. |
| Skeptic | one agent per violation, session effort | Gets the rule, the location and the quoted line, not the verifier's explanation, and is told to refute it. |
| Report | plain code | `survivors`, `refuted`, `outOfScope`, `unverified`, `unchecked`, `notApplicable`, `skipped`, `reasons`. |

## Ceilings

- Verifiers: 12 by default (`maxVerifiers`, lowerable, never above 24). With more rules than that, rules share verifiers in contiguous batches of near-equal size, each rule still answered on its own row. The `reasons` line says so; no rule is dropped.
- Skeptics: 12 by default (`maxSkeptics`, same bounds). Violations past the ceiling go to `unverified` with the reason, never silently into `survivors`.

## The survivor filter

A violation is **refuted** only when the skeptic answers `refuted=true` AND cites a `file:line` in the violation's file or another changed file AND gives a reason. Anything less leaves it standing:

| Skeptic answer | Outcome |
|----------------|---------|
| `refuted=true`, in-diff `file:line`, reason | refuted (listed with the citation) |
| `refuted=true` without a citation, outside the diff, or no line | survives, `skeptic: "unbacked refutation"` |
| `refuted=false` | survives, `skeptic: "upheld"` |
| dead or throwing skeptic | survives, `confidence: "low"` |

Before any skeptic runs: a violation in a file outside `changedFiles` is `outOfScope` (rule check is diff-scoped), and one with no file goes to `unverified`. A dead, BLOCKED or silent verifier leaves its rules in `unchecked`.

## In the report

- Each survivor is an `issue (rule)` finding: the rule text with its `source:line`, the violating `file:line`, the quoted line. Any survivor floors the verdict at `comment`; rule findings never raise it to `request-changes` on their own.
- `unverified` and `unchecked` are listed as "not checked, manual review required".
- `skipped` is a count, plus the list on request.
- `refuted` is listed in a collapsed section with each citation, so a wrong kill is auditable.

Tests: `tests/unit/test-review-rule-check.mjs` (splitting fixtures, fan-out and batching, the survivor filter, the collector), no live agent runs.

## Standards pass (`--standards`)

Two-pass review: the builder makes it work, then a separate pass checks the repo's standards. The source is only `.github/review-standards.md` (no CLAUDE.md, no `~/.claude`, no imports), a file Claude Code never loads into a builder session. At most 20 rules and 3 KB. A leading `[glob]` limits a rule to matching paths, and a violation outside it goes to `outOfScope`.

- The file is read from the repo's default branch (`--default-branch`, as `refs/remotes/origin/<name>`), never from the PR head or the PR's chosen base; a differing base gets one `notes` line. `--base-ref` accepts only `refs/remotes/origin/*`, `origin/*` or a full SHA, and is refused when it resolves to the checked-out HEAD. The ref is resolved to one SHA, and both git reads use it. A symlink committed there is refused.
- No file at the rules ref, neither `--default-branch` nor `--base-ref`, or a tree or file git cannot read (a shallow clone): the collector returns no sources and one `skip` line, and the pass logs it and stops.
- Every verifier row counts, also a second row for the same rule. A row naming a rule the agent was not given is reported in `unverified`, `unknownRuleIds` and `findingLines`.
- Rules are numbered `S1..Sn` in file order. Each survivor prints as `S<n> (.github/review-standards.md:<line>) broken at <file>:<line>` (`findingLines`).
- Default `strategy: "single"`: one agent holds every rule at session effort and refutes its own findings first, with no skeptics. `--standards --rules` sets `strategy: "fanout"` (one verifier per rule plus skeptics). Measured on #4667 at 03f6132d: single 107,832 tokens, fan-out 1,099,909, the same one finding.
- The pass never gives LAND or HOLD and never commits. The conductor sends the findings to a separate fix lane, then the LAND reviewer reviews the final head.

Tests: `tests/unit/test-review-standards-pass.mjs`.
