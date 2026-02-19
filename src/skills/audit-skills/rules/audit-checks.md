---
title: Per-Skill Audit Checks
impact: HIGH
impactDescription: "Skipping checks produces an incomplete audit that misses real quality issues"
tags: audit, skills, frontmatter, manifest, rules
---

## Per-Skill Audit Checks

Run these six checks for every `src/skills/<name>/SKILL.md`. Use parallel Glob/Grep calls where possible.

### Check 1: Line Count

Count lines in SKILL.md.

**Incorrect:**
```bash
# Skipping line count — misses the Anthropic 500-line limit
```

**Correct:**
```bash
wc -l src/skills/<name>/SKILL.md
# Flag FAIL if count > 500
# Flag WARN if count > 400 (approaching limit)
```

### Check 2: Required Frontmatter Fields

Parse the `---` block at the top of SKILL.md. Required fields:

```
name, description, tags, version, author, user-invocable, complexity
```

**Incorrect:**
```yaml
# Missing version, author — produces incomplete metadata
name: my-skill
description: Does something
tags: [tag]
user-invocable: true
complexity: low
```

**Correct:**
```yaml
name: my-skill
description: Does something. Use when X.
tags: [tag1, tag2]
version: 2.0.0
author: OrchestKit
user-invocable: true
complexity: low
```

Flag WARN for each missing required field. List the missing fields.

### Check 3: Rules Count

Glob `src/skills/<name>/rules/*.md`, excluding `_sections.md` and `_template.md`.

```bash
# Count rule files (non-underscore-prefixed)
ls src/skills/<name>/rules/*.md 2>/dev/null | grep -v '^_'
```

Store as `rules_count`. Used in Check 5 combined with refs count.

### Check 4: References Count

Glob `src/skills/<name>/references/*.md`.

```bash
ls src/skills/<name>/references/*.md 2>/dev/null
```

Store as `refs_count`. Used in Check 5 combined with rules count.

### Check 5: No Supporting Files

Flag WARN if `rules_count == 0 AND refs_count == 0`.

Exception: orchestration skills (`implement`, `explore`, `verify`, `brainstorming`, etc.) with inline workflow detail are acceptable with 0 rules — only flag if BOTH are zero.

### Check 6: Manifest Registration

Check whether the skill appears in `manifests/ork.json` or `manifests/orkl.json`.

**Incorrect:**
```bash
# Checking only orkl.json — misses skills covered by ork.json "all"
```

**Correct:**
```python
with open("manifests/ork.json") as f:
    ork = json.load(f)

# ork.json "skills": "all" means every src/skills/* is included
if ork.get("skills") == "all":
    in_ork = True
else:
    in_ork = skill_name in [s if isinstance(s,str) else s["name"]
                             for s in ork.get("skills", [])]
```

Flag FAIL if skill is absent from both manifests.

**Key rules:**
- Run Checks 3 and 4 in parallel (independent Glob calls)
- Check 6 must handle `"skills": "all"` shorthand in ork.json
- Checks 1 and 2 together form the SKILL.md header validation
- Never skip Check 6 — unregistered skills are dead weight
