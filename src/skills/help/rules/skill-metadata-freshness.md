---
title: Validate listed skills exist in manifest before displaying to prevent showing stale or removed skills
impact: HIGH
impactDescription: "Showing removed or renamed skills causes user frustration when invocation fails with 'skill not found'"
tags: freshness, manifest, validation, discovery, stale-data
---

## Problem

The help skill can display skills that have been removed, renamed, or merged if it relies on hardcoded lists or cached data instead of reading from the live manifest. When a user tries to invoke a stale skill, they get a confusing "skill not found" error with no guidance on the replacement.

## Rule

Before rendering any skill listing, cross-reference every skill name against `manifests/ork.json` or scan `src/skills/*/SKILL.md` files. Never display a skill that does not exist in the current manifest.

### Incorrect -- rendering from hardcoded list:

```python
# Hardcoded category mapping (goes stale when skills change)
BUILD_SKILLS = ["implement", "brainstorm", "verify", "scaffold"]
#                                                      ^^^^^^^^
# "scaffold" was merged into "implement" in v7.2.0
# User sees it in /ork:help, tries /ork:scaffold, gets "skill not found"

for skill in BUILD_SKILLS:
    render_skill_entry(skill)
```

### Correct -- validate against live source:

```python
# Step 1: Scan for all user-invocable skills
found_skills = Grep(
    pattern="user-invocable:\\s*true",
    path="src/skills",
    output_mode="files_with_matches"
)

# Step 2: Extract names from matched SKILL.md files
live_skills = set()
for skill_file in found_skills:
    frontmatter = Read(file_path=skill_file, limit=15)
    name = parse_frontmatter_field(frontmatter, "name")
    live_skills.add(name)

# Step 3: Filter category mapping against live skills
BUILD_CATEGORY = ["implement", "brainstorm", "verify", "scaffold"]
valid_build = [s for s in BUILD_CATEGORY if s in live_skills]
# "scaffold" is excluded because it no longer exists in source
```

### Incorrect -- showing a count without verification:

```
OrchestKit: 89 skills available
# Count is from CLAUDE.md header, may not match actual manifest
```

### Correct -- deriving count from scan:

```
OrchestKit: {len(live_skills)} user-invocable skills available
# Count derived from actual Grep scan in STEP 0
```

### Key Rules

- Always run STEP 0 (dynamic skill discovery) before rendering any skill list
- Never hardcode skill names or counts -- derive from source files
- If a skill appears in category mapping but not in live scan, silently omit it
- If a category becomes empty after filtering, omit the entire category from display
- Log a warning (not shown to user) when a mapped skill is missing for maintainer awareness
