# PR Review Template

## Review Output Format

```markdown
# PR Review: #[NUMBER]
**Title**: [PR Title]
**Author**: [Author]
**Files Changed**: X | **Lines**: +Y / -Z

## Summary
[1-2 sentence overview of changes]

## ✅ Strengths
- [What's done well - from praise comments]
- [Good patterns observed]

## 🔍 Code Quality
| Area | Status | Notes |
|------|--------|-------|
| Readability | ✅/⚠️/❌ | [notes] |
| Type Safety | ✅/⚠️/❌ | [notes] |
| Test Coverage | ✅/⚠️/❌ | [X% coverage] |
| Error Handling | ✅/⚠️/❌ | [notes] |

## 🔒 Security
| Check | Status | Issues |
|-------|--------|--------|
| Secrets Scan | ✅/❌ | [count] |
| Input Validation | ✅/❌ | [issues] |
| Dependencies | ✅/❌ | [vulnerabilities] |

## ⚠️ Suggestions (Non-Blocking)
- [suggestion 1 with file:line reference]
- [suggestion 2]

## 🔴 Blockers (Must Fix Before Merge)
- [blocker 1 if any]
- [blocker 2 if any]

## 📋 CI Status
- Backend Lint: ✅/❌
- Backend Types: ✅/❌
- Backend Tests: ✅/❌
- Frontend Format: ✅/❌
- Frontend Lint: ✅/❌
- Frontend Types: ✅/❌
- Frontend Tests: ✅/❌
```

## Approval Message

```markdown
## ✅ Approved

Great work! Code quality is solid, tests pass, and security looks good.

### Highlights
- [specific positive feedback]

### Minor Suggestions (Non-Blocking)
- [optional improvements]

🤖 Reviewed with Claude Code (6 parallel agents)
```

## Request Changes Message

```markdown
## 🔄 Changes Requested

Good progress, but a few items need addressing before merge.

### Must Fix
1. [blocker 1]
2. [blocker 2]

### Suggestions
- [optional improvements]

🤖 Reviewed with Claude Code (6 parallel agents)
```

## Conventional Comments

| Prefix | Usage |
|--------|-------|
| `praise:` | Highlight good patterns |
| `nitpick:` | Minor style preference |
| `suggestion:` | Non-blocking improvement |
| `issue:` | Must be addressed |
| `question:` | Needs clarification |

## Example Comments

```
praise: Excellent use of the repository pattern here - clean separation of concerns.

nitpick: Consider using a more descriptive variable name than `d` - maybe `data` or `response`.

suggestion: This loop could be replaced with a list comprehension for better readability.

issue: This SQL query is vulnerable to injection - use parameterized queries instead.

question: Is there a reason we're not using the existing `UserService` here?
```