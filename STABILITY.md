# Stability contract

What OrchestKit promises about versions, and what it does not.

OrchestKit follows [Semantic Versioning](https://semver.org). The version number is
`MAJOR.MINOR.PATCH` and is owned end to end by release-please, driven by
[Conventional Commits](https://www.conventionalcommits.org). No one hand-edits a version.

## What counts as breaking

A change is MAJOR if a user on the previous version can be worse off after updating without
changing anything themselves.

| Change | Bump | Why |
|---|---|---|
| **Raising the Claude Code support floor** | **MAJOR** | Users between the old and new floor lose support. See below. |
| Removing or renaming a user-invocable skill (`/ork:<name>`) | MAJOR | Muscle memory and scripts break. |
| Removing an agent, or removing a tool from an agent's grants | MAJOR | Delegation that worked stops working. |
| Deleting a subsystem (v8.0.0 removed `monitors/`) | MAJOR | No replacement in the same release. |
| Changing what a model alias resolves to | MAJOR | Silently changes which model runs and what it costs. |
| Changing a hook from advisory to blocking | MAJOR | Previously-allowed work starts getting denied. |
| Adding a skill, agent, hook, or rule | MINOR | Additive. |
| Adopting a new CC feature without moving the floor | MINOR | Additive. |
| Bug fix, doc change, dependency bump, telemetry | PATCH | No surface change. |

## The Claude Code support floor is a breaking change

This is the rule most easily got wrong, so it is stated explicitly.

The floor lives in `shared/cc-support.json` (`supported_floor`) and is stamped into every
derived declaration by `scripts/stamp-cc-support.mjs`. Raising it strands every user between the
old floor and the new one: the SessionStart version check warns them, and all skill
`compatibility:` floors move, which `tests/manifests/test-cc-version-floor.sh` enforces.

**Therefore a floor bump must be committed as `feat(cc)!:` with a `BREAKING CHANGE:` footer, and
must cut a MAJOR.**

Historically it did not. Floor bumps shipped as plain `feat:` and released as minors, which
understated the impact for anyone on an older CC. A 2026-06-22 versioning review named this
"the one real SemVer lie" in the project and recommended the fix; it is adopted here, starting
with the 2.1.206 to 2.1.220 bump.

Advancing `latest_known` **without** moving the floor is not breaking. That only widens the range
of releases whose features have been triaged, and it is how most CC adoption cycles land.

## Support window

`shared/cc-support.json` is the single source of truth. Read it rather than inferring from a
version number.

- `supported_floor` is the minimum Claude Code version OrchestKit is tested against.
- `latest_known` is the newest CC release whose changelog has been triaged for adoption. It can
  be ahead of the floor.
- `policy` describes the steady-state window. A `manual_override` block can deliberately pin the
  floor tighter than the policy, with a reason and an expiry; when it expires,
  `.github/workflows/cc-support-window-bump.yml` resumes the policy.

Running below the floor is not blocked. Hooks and skills may no-op or error, and that is not
treated as a bug.

## What is not covered

These carry no stability promise and can change in any release:

- Internal hook module paths under `src/hooks/src/`, and anything in `plugins/` (generated).
- Telemetry file locations, schemas, and contents under `.claude/state/`.
- The wording of any hook's advisory output.
- Skill `references/` and `rules/` file layout. The skill's own name and trigger are covered; how
  it splits its supporting files is not.
- Anything documented as experimental in the skill or agent body.

## Channels

`alpha`, `beta`, and `stable` marketplace channels exist (since v7.0.0). `stable` is the default.
Breaking changes land on `stable` only in a MAJOR release.

## Checking compatibility

```bash
claude --version                      # your Claude Code
jq -r .supported_floor shared/cc-support.json   # the floor this checkout requires
claude plugin details ork             # installed component counts and per-session token cost
```
