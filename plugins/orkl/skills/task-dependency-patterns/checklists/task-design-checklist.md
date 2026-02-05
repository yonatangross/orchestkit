# Task Design Checklist

## Before Creating Tasks

- [ ] Is this work complex enough to need task tracking? (3+ steps)
- [ ] Have you identified the natural work boundaries?
- [ ] Can each task be completed independently once unblocked?

## Task Structure

### Subject (required)

- [ ] Uses imperative form ("Add", "Fix", "Update", not "Adding", "Fixed")
- [ ] Describes the outcome, not the process
- [ ] Concise but descriptive (5-10 words max)

**Good examples:**
- "Create User model with validation"
- "Add JWT authentication endpoint"
- "Fix pagination in search results"

**Bad examples:**
- "Work on the feature" (too vague)
- "Adding stuff to the database" (wrong tense, vague)
- "Implement the new user authentication system with JWT tokens and refresh token rotation including rate limiting" (too long)

### Description (required)

- [ ] Explains what needs to be done
- [ ] Includes acceptance criteria
- [ ] Notes any constraints or considerations
- [ ] References relevant files or patterns

**Template:**
```
Implement [specific thing] that:
- [Requirement 1]
- [Requirement 2]

Acceptance criteria:
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No type errors
```

### activeForm (recommended)

- [ ] Uses present continuous tense
- [ ] Matches the subject semantically
- [ ] Reads naturally as spinner text

| Subject | activeForm |
|---------|-----------|
| Add user validation | Adding user validation |
| Fix broken tests | Fixing broken tests |
| Update API schema | Updating API schema |

## Dependency Design

- [ ] Dependencies represent real execution order requirements
- [ ] No circular dependency chains
- [ ] Parallel work identified and unblocked appropriately
- [ ] Critical path minimized

## Task Granularity

### Too Large

Signs your task is too large:
- Description exceeds 200 words
- Estimated to touch 5+ files
- Multiple distinct outcomes combined

**Split strategy:**
1. Identify sub-outcomes
2. Create task per outcome
3. Link with dependencies

### Too Small

Signs your task is too small:
- Single line change
- Pure refactoring without behavior change
- Part of another task's natural work

**Merge strategy:**
1. Combine with related task
2. Add to description as sub-item

## Review Before Submitting

- [ ] Each task has clear completion criteria
- [ ] Dependencies are minimal but sufficient
- [ ] Task can be understood without external context
- [ ] activeForm provides useful progress feedback
