# Conventional Comments

A standardized format for review comments that makes intent clear.

## Format

```
<label> [decorations]: <subject>

[discussion]
```

## Labels

| Label | Meaning | Blocks Merge? |
|-------|---------|---------------|
| **praise** | Highlight something positive | No |
| **nitpick** | Minor, optional suggestion | No |
| **suggestion** | Propose an improvement | No |
| **issue** | Problem that should be addressed | Usually |
| **question** | Request clarification | No |
| **thought** | Idea to consider | No |
| **chore** | Routine task (formatting, deps) | No |
| **note** | Informational comment | No |
| **todo** | Follow-up work needed | Maybe |
| **security** | Security concern | **Yes** |
| **bug** | Potential bug | **Yes** |
| **breaking** | Breaking change | **Yes** |

## Decorations

| Decoration | Meaning |
|------------|---------|
| **[blocking]** | Must be addressed before merge |
| **[non-blocking]** | Optional, can be deferred |
| **[if-minor]** | Only if it's a quick fix |

## Examples

```typescript
// Good: Clear, specific, actionable

praise: Excellent use of TypeScript generics here!
This makes the function much more reusable while maintaining type safety.

---

nitpick [non-blocking]: Consider using const instead of let
This variable is never reassigned, so `const` would be more appropriate.

---

issue: Missing error handling for API call
If the API returns a 500 error, this will crash the application.
Add a try/catch block with proper error logging.

---

security [blocking]: API endpoint is not authenticated
The `/api/admin/users` endpoint is missing authentication middleware.

---

suggestion [if-minor]: Extract magic number to named constant
```
