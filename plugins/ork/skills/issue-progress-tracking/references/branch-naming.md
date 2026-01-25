# Branch Naming for Issue Tracking

## Supported Patterns

The issue progress tracking hooks extract issue numbers from these branch patterns:

| Pattern | Example | Extracted Issue |
|---------|---------|-----------------|
| `issue/N-*` | `issue/123-add-login` | 123 |
| `fix/N-*` | `fix/456-null-check` | 456 |
| `feature/N-*` | `feature/789-dashboard` | 789 |
| `bug/N-*` | `bug/101-crash` | 101 |
| `feat/N-*` | `feat/202-search` | 202 |
| `N-*` | `123-my-feature` | 123 |

## Best Practices

### Create Branch from Issue
```bash
# From issue page or using gh CLI
gh issue develop 123 --checkout

# Or manually
git checkout -b issue/123-implement-feature
```

### Keep Issue Number First
```bash
# Good - issue number easily extracted
issue/123-add-user-validation
fix/456-resolve-null-pointer

# Avoid - harder to parse
add-validation-for-issue-123
feature-user-management-456
```

### Use Descriptive Suffixes
```bash
# Good - clear purpose
issue/123-add-jwt-auth
fix/456-handle-empty-response

# Avoid - too vague
issue/123-changes
fix/456-update
```

## Fallback: Commit Message

If branch name doesn't contain an issue number, the hooks check commit messages:

```bash
# These commit messages will extract issue 123
git commit -m "feat(#123): Add validation"
git commit -m "fix: Resolve bug (closes #123)"
git commit -m "test: Add tests for #123"
```

## Multiple Issues

Currently, only the **first** issue number is extracted. For commits touching multiple issues, use the primary issue in the branch name and reference others in commit messages.
