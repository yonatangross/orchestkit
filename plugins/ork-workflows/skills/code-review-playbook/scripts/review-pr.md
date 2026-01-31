---
name: review-pr
description: Review a pull request with auto-fetched context from GitHub. Use when reviewing pull requests.
user-invocable: true
argument-hint: [PR-number]
allowed-tools: Bash, Read, Grep
---

Review PR $ARGUMENTS

## PR Context (Auto-Fetched)

- **Recent PRs**: !`gh pr list --limit 10 --json number,title,author,state,createdAt,updatedAt --jq '.[] | "\(.number): \(.title) [\(.state)] by \(.author.login)"' 2>/dev/null || echo "Unable to fetch PR list"`
- **Current Branch PRs**: !`gh pr list --head "$(git branch --show-current 2>/dev/null || echo '')" --json number,title,state --jq '.[] | "\(.number): \(.title)"' 2>/dev/null | head -5 || echo "No PRs found for current branch"`
- **GitHub CLI Available**: !`which gh >/dev/null 2>&1 && echo "✅ Yes" || echo "❌ Not found - install GitHub CLI"`

## Your Task

Review pull request **#$ARGUMENTS**. Use the PR list above to locate the PR, then:

1. Fetch PR details using: `gh pr view $ARGUMENTS --json title,author,state,createdAt,updatedAt,comments`
2. Review the diff: `gh pr diff $ARGUMENTS`
3. Check changed files: `gh pr diff $ARGUMENTS --name-only`
4. Review comments: `gh pr view $ARGUMENTS --comments`

## Review Checklist

### Code Quality
- [ ] Code follows project style guide
- [ ] No obvious bugs or logic errors
- [ ] Error handling is appropriate
- [ ] Edge cases are considered
- [ ] Code is readable and maintainable

### Testing
- [ ] Tests are included for new functionality
- [ ] Existing tests still pass
- [ ] Test coverage is adequate
- [ ] Integration tests updated if needed

### Security
- [ ] No sensitive data exposed
- [ ] Input validation present
- [ ] Authentication/authorization correct
- [ ] No SQL injection or XSS vulnerabilities

### Performance
- [ ] No obvious performance issues
- [ ] Database queries are optimized
- [ ] No unnecessary API calls
- [ ] Caching considered where appropriate

### Documentation
- [ ] Code is well-commented
- [ ] README/docs updated if needed
- [ ] API changes documented
- [ ] Breaking changes noted

## Review Feedback Template

Use conventional comments format:

```
<label> [decorations]: <subject>

[discussion]
```

**Labels**: praise, nitpick, suggestion, issue, question, thought, chore, note, todo, security, bug, breaking

**Example Comments**:

- `praise: Great use of TypeScript types here`
- `suggestion [non-blocking]: Consider extracting this into a helper function`
- `issue [blocking]: This will fail if the array is empty`
- `security [blocking]: API key should not be logged`

## Review Process

1. **Read the PR description** - Understand the goal
2. **Review changed files** - Focus on the diff
3. **Check tests** - Ensure coverage and correctness
4. **Test locally** (if possible) - Verify it works
5. **Provide constructive feedback** - Be specific and kind
6. **Approve or request changes** - Based on blocking issues

## Common Issues to Watch For

- **Breaking changes** without migration path
- **Performance regressions** in critical paths
- **Security vulnerabilities** (SQL injection, XSS, etc.)
- **Missing error handling** for edge cases
- **Inconsistent patterns** with existing codebase
- **Over-engineering** simple solutions
- **Under-testing** complex logic

## Approval Criteria

**Approve if**:
- Code quality is good
- Tests are adequate
- No blocking issues
- Follows project conventions

**Request changes if**:
- Blocking bugs or security issues
- Missing critical tests
- Significant style violations
- Breaking changes without discussion
