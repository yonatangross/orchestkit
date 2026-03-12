---
title: Cross-check skill category assignments against skill tags to prevent miscategorization
impact: MEDIUM
impactDescription: "Miscategorized skills confuse users who look in the wrong category and miss the skill they need"
tags: category, tags, accuracy, classification, discovery
---

## Problem

The help skill maps skills to categories (BUILD, GIT, PLAN, MEMORY, QUALITY, CONFIG, EXPLORE). When skills are recategorized or their tags change, the hardcoded mapping in the help skill can assign a skill to a category that no longer matches its actual function. Users looking for a specific capability browse the wrong category and miss the skill entirely.

## Rule

When assigning a skill to a display category, verify the assignment by checking the skill's `tags` and `metadata.category` fields from its SKILL.md frontmatter. If the skill's tags contradict the category placement, use the tags as the source of truth.

### Category-to-Tag Mapping

```
BUILD   -> tags contain: implement, build, feature, brainstorm, verify
GIT     -> tags contain: git, commit, pr, pull-request, branch, issue
PLAN    -> tags contain: plan, prd, assessment, visualization, strategy
MEMORY  -> tags contain: memory, decisions, patterns, graph-memory
QUALITY -> tags contain: quality, review, assess, health, diagnostics
CONFIG  -> tags contain: setup, config, onboarding, diagnostics
EXPLORE -> tags contain: explore, analysis, architecture, codebase
```

### Incorrect -- placing skill in wrong category:

```python
# "assess" placed only in PLAN category
PLAN_SKILLS = ["visualize-plan", "write-prd", "assess"]
# But assess has tags: [quality, assessment, scoring, grading]
# User looking in QUALITY never finds it

# "doctor" placed only in CONFIG
CONFIG_SKILLS = ["setup", "doctor", "configure"]
# But doctor has tags: [health, diagnostics, quality]
# User checking QUALITY for diagnostics misses it
```

### Correct -- using tags to allow multi-category placement:

```python
# Read skill frontmatter
assess_tags = ["quality", "assessment", "scoring", "grading"]

# assess matches both PLAN (assessment) and QUALITY (quality)
PLAN_SKILLS = ["visualize-plan", "write-prd", "assess"]
QUALITY_SKILLS = ["assess", "review-pr", "doctor"]

# doctor matches both CONFIG (diagnostics) and QUALITY (diagnostics, health)
CONFIG_SKILLS = ["setup", "doctor", "configure"]
# doctor appears in QUALITY too -- correct cross-listing
```

### Incorrect -- ignoring metadata.category field:

```python
# Skill has metadata.category: "workflow-automation"
# But help places it under CONFIG because of a legacy mapping
CONFIG_SKILLS = ["setup", "doctor", "configure", "remember"]
#                                                  ^^^^^^^^
# remember.metadata.category = "workflow-automation", not config
# remember.tags = [memory, decisions, patterns]
# Belongs in MEMORY, not CONFIG
```

### Correct -- checking metadata.category:

```python
skill_meta = read_frontmatter("src/skills/remember/SKILL.md")
# metadata.category = "workflow-automation"
# tags = [memory, decisions, patterns]
# -> Place in MEMORY (tags match), not CONFIG
```

### Validation Steps

1. For each skill in a category listing, read its `tags` array from SKILL.md
2. Verify at least one tag matches the category-to-tag mapping above
3. If zero tags match, the skill is miscategorized -- move it to the correct category
4. Skills matching multiple categories should appear in all matching categories

### Key Rules

- Tags from SKILL.md frontmatter are the source of truth for categorization
- A skill can appear in multiple categories if its tags span them
- Never place a skill in a category where none of its tags match
- When "Show all" is selected, group by `metadata.category` from each SKILL.md, not by the hardcoded mapping
