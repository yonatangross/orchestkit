---
title: Automated Issue Progress Updates
impact: HIGH
impactDescription: "Without automation, issue status drifts from reality — stakeholders see stale progress and make wrong decisions"
tags: github, issues, progress, tracking, automation, commits, hooks
---

## Automated Issue Progress Updates

Track issue progress automatically through commit detection, sub-task matching, and session summaries. Eliminates manual status updates.

### Three-Hook Pipeline

| Hook | Trigger | Action |
|------|---------|--------|
| Commit Detection | Each commit | Extracts issue number, queues for batch comment |
| Sub-task Updater | Commit message match | Checks off matching `- [ ]` items in issue body |
| Session Summary | Session end | Posts consolidated progress comment |

### Issue Number Extraction

```bash
# From branch name (priority)
issue/123-implement-feature  # Extracts: 123
fix/456-resolve-bug          # Extracts: 456
feature/789-add-tests        # Extracts: 789

# From commit message (fallback)
"feat(#123): Add user validation"     # Extracts: 123
"fix: Resolve bug (closes #456)"      # Extracts: 456
```

### Sub-task Auto-Completion

Commit messages are matched against issue checkboxes using normalized text comparison:

```markdown
# Issue body (before)
- [ ] Add input validation
- [ ] Write unit tests

# Commit: "feat(#123): Add input validation"

# Issue body (after)
- [x] Add input validation
- [ ] Write unit tests
```

### Session Summary Format

```markdown
## Claude Code Progress Update

**Session**: `abc12345...`
**Branch**: `issue/123-implement-feature`

### Commits (3)
- `abc1234`: feat(#123): Add input validation
- `def5678`: test(#123): Add unit tests

### Files Changed
- `src/validation.ts` (+45, -12)
- `tests/validation.test.ts` (+89, -0)

### Sub-tasks Completed
- [x] Add input validation
- [x] Write unit tests
```

**Incorrect — Manual issue updates without automation:**
```bash
# Commit without issue reference
git commit -m "Add validation"

# Manually comment on issue #123:
"Added validation - see commit abc1234"
[Time-consuming, error-prone]
```

**Correct — Automated progress tracking:**
```bash
# Issue-prefixed branch
git checkout -b issue/123-validation

# Conventional commit
git commit -m "feat(#123): Add input validation"

# Hook auto-posts to issue:
"[Session abc123] feat(#123): Add input validation
Files: src/validation.ts (+45)"
```

### Key Rules

- Use **issue-prefixed branches** (`issue/N-`, `fix/N-`, `feature/N-`) for automatic detection
- Include **`#N`** in commit messages as fallback for issue linking
- Use **conventional commits** (`feat(#123):`, `fix(#123):`) for reliable matching
- Match commit message text to **checkbox descriptions** for auto-completion
- Post **consolidated summaries** at session end, not per-commit
