# Audit Edge Cases

## Manifest "all" Shorthand

`manifests/ork.json` uses `"skills": "all"` to include every skill in `src/skills/`. When this is present, every discovered skill is automatically manifest-registered — mark Mfst as `YES` without listing individual names.

```json
// manifests/ork.json — "all" means everything in src/skills/ qualifies
{ "skills": "all" }
```

When `manifests/ork.json` has `"skills": "all"`, every skill in `src/skills/` is registered.

## Orchestration Skills with 0 Rules

Orchestration/workflow skills describe multi-phase processes rather than prescriptive code patterns. They legitimately have 0 rule files but use `references/` for workflow templates, rubrics, and report formats.

Skills in this category (not exhaustive):
- `implement`, `explore`, `verify`, `brainstorm`
- `review-pr`, `assess`, `fix-issue`
- `plan-viz`, `configure`, `remember`

These should only receive `WARN: no_rules_or_refs` if BOTH `rules/` AND `references/` are empty.

## Required Frontmatter Fields

The authoring standard (`src/skills/CONTRIBUTING-SKILLS.md`) lists these as required:

```
name, description, tags, version, author, user-invocable, complexity
```

Older skills may be missing `version` and `author` — flag as WARN, not FAIL, since the skill still functions.

## Broken Reference Detection

Scan SKILL.md body for patterns like:

```
rules/some-file.md
references/some-file.md
```

For each mentioned path, verify the file exists under `src/skills/<name>/`. Flag WARN if missing.

False positive: generic markdown links to external URLs — skip `http://` and `https://` patterns.

## Project-Level Skills

Skills under `.claude/skills/` (project-level) are not registered in `manifests/`. Exclude them from manifest checks or mark Mfst as `N/A`.
