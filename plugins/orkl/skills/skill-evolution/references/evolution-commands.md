# Evolution Subcommand Reference

Detailed implementation and sample output for each subcommand.

---

## Subcommand: Report (Default)

**Usage:** `/ork:skill-evolution`

Shows evolution report for all tracked skills.

### Implementation

```bash
# Run the evolution engine report
"${CLAUDE_PROJECT_DIR}/.claude/scripts/evolution-engine.sh" report
```

### Sample Output

```
Skill Evolution Report
══════════════════════════════════════════════════════════════

Skills Summary:
┌────────────────────────────┬─────────┬─────────┬───────────┬────────────┐
│ Skill                      │ Uses    │ Success │ Avg Edits │ Suggestions│
├────────────────────────────┼─────────┼─────────┼───────────┼────────────┤
│ api-design-framework       │     156 │     94% │       1.8 │          2 │
│ database-schema-designer   │      89 │     91% │       2.1 │          1 │
│ fastapi-patterns           │      67 │     88% │       2.4 │          3 │
└────────────────────────────┴─────────┴─────────┴───────────┴────────────┘

Summary:
  Skills tracked: 3
  Total uses: 312
  Overall success rate: 91%

Top Pending Suggestions:
1. 93% | api-design-framework | add add_pagination
2. 88% | api-design-framework | add add_rate_limiting
3. 85% | fastapi-patterns | add add_error_handling
```

---

## Subcommand: Analyze

**Usage:** `/ork:skill-evolution analyze <skill-id>`

Analyzes edit patterns for a specific skill.

### Implementation

```bash
# Run analysis for specific skill
"${CLAUDE_PROJECT_DIR}/.claude/scripts/evolution-engine.sh" analyze "$SKILL_ID"
```

### Sample Output

```
Skill Analysis: api-design-framework
────────────────────────────────────
Uses: 156 | Success: 94% | Avg Edits: 1.8

Edit Patterns Detected:
┌──────────────────────────┬─────────┬──────────┬────────────┐
│ Pattern                  │ Freq    │ Samples  │ Confidence │
├──────────────────────────┼─────────┼──────────┼────────────┤
│ add_pagination           │    85%  │ 132/156  │       0.93 │
│ add_rate_limiting        │    72%  │ 112/156  │       0.88 │
│ add_error_handling       │    45%  │  70/156  │       0.56 │
└──────────────────────────┴─────────┴──────────┴────────────┘

Pending Suggestions:
1. 93% conf: ADD add_pagination to template
2. 88% conf: ADD add_rate_limiting to template

Run `/ork:skill-evolution evolve api-design-framework` to review
```

---

## Subcommand: Evolve

**Usage:** `/ork:skill-evolution evolve <skill-id>`

Interactive review and application of improvement suggestions.

### Implementation

1. **Get Suggestions:**
```bash
SUGGESTIONS=$("${CLAUDE_PROJECT_DIR}/.claude/scripts/evolution-engine.sh" suggest "$SKILL_ID")
```

2. **For Each Suggestion, Present Interactive Options:**

Use `AskUserQuestion` to let the user decide on each suggestion:

```json
{
  "questions": [{
    "question": "Apply suggestion: ADD add_pagination to template? (93% confidence, 132/156 users add this)",
    "header": "Evolution",
    "options": [
      {"label": "Apply", "description": "Add this pattern to the skill template"},
      {"label": "Skip", "description": "Skip for now, ask again later"},
      {"label": "Reject", "description": "Never suggest this again"}
    ],
    "multiSelect": false
  }]
}
```

3. **On Apply:**
   - Create version snapshot first
   - Apply the suggestion to skill files
   - Update evolution registry

4. **On Reject:**
   - Mark suggestion as rejected in registry
   - Will not be suggested again

### Applying Suggestions

When a user accepts a suggestion, the implementation depends on the suggestion type:

**For `add` suggestions to templates:**
- Add the pattern to the skill's template files
- Update SKILL.md with new guidance

**For `add` suggestions to references:**
- Create new reference file in `references/` directory

**For `remove` suggestions:**
- Remove the identified content
- Archive in version snapshot first

---

## Subcommand: History

**Usage:** `/ork:skill-evolution history <skill-id>`

Shows version history with performance metrics.

### Implementation

```bash
# Run version manager list
"${CLAUDE_PROJECT_DIR}/.claude/scripts/version-manager.sh" list "$SKILL_ID"
```

### Sample Output

```
Version History: api-design-framework
══════════════════════════════════════════════════════════════

Current Version: 1.2.0

┌─────────┬────────────┬─────────┬───────┬───────────┬────────────────────────────┐
│ Version │ Date       │ Success │ Uses  │ Avg Edits │ Changelog                  │
├─────────┼────────────┼─────────┼───────┼───────────┼────────────────────────────┤
│ 1.2.0   │ 2026-01-14 │    94%  │   156 │       1.8 │ Added pagination pattern   │
│ 1.1.0   │ 2026-01-05 │    89%  │    80 │       2.3 │ Added error handling ref   │
│ 1.0.0   │ 2025-11-01 │    78%  │    45 │       3.2 │ Initial release            │
└─────────┴────────────┴─────────┴───────┴───────────┴────────────────────────────┘
```

---

## Subcommand: Rollback

**Usage:** `/ork:skill-evolution rollback <skill-id> <version>`

Restores a skill to a previous version.

### Implementation

1. **Confirm with User:**

Use `AskUserQuestion` for confirmation:

```json
{
  "questions": [{
    "question": "Rollback api-design-framework from 1.2.0 to 1.0.0? Current version will be backed up.",
    "header": "Rollback",
    "options": [
      {"label": "Confirm Rollback", "description": "Restore version 1.0.0"},
      {"label": "Cancel", "description": "Keep current version"}
    ],
    "multiSelect": false
  }]
}
```

2. **On Confirm:**
```bash
"${CLAUDE_PROJECT_DIR}/.claude/scripts/version-manager.sh" restore "$SKILL_ID" "$VERSION"
```

3. **Report Result:**
```
Restored api-design-framework to version 1.0.0
Previous version backed up to: versions/.backup-1.2.0-1736867234
```
