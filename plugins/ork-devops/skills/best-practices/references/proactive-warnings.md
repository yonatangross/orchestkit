# Proactive Anti-Pattern Warnings

When the best practices library is available, Claude proactively warns about anti-patterns.

## Automatic Detection

When Claude detects implementation of a known anti-pattern:

```
⚠️ Warning: You're about to use offset pagination.
   This pattern failed in 2 of your previous projects
   with similar data sizes. Consider cursor-based instead?

   [Proceed anyway] [Use alternative]
```

## Detection Logic

1. **Before implementing a pattern:**
   - Check if it matches any stored anti-patterns
   - If match found, show warning with context

2. **Category matching:**
   - Detect category from current implementation
   - Query mem0 for failed patterns in that category
   - Compare semantic similarity

3. **Threshold for warning:**
   - Pattern failed in 2+ projects, OR
   - Pattern has explicit "lesson" metadata

## Suggestion Mode

When implementing something in a category with successful patterns:

```
💡 Tip: For authentication, you've had success with
   "JWT + httpOnly refresh tokens" in 4 projects.
   Would you like to use that approach?
```

## Hook Integration

The `hooks/prompt/antipattern-warning.sh` hook automatically:
1. Extracts implementation context from user prompt
2. Queries for matching anti-patterns
3. Injects warning into system message if found

## Suppressing Warnings

User can suppress warnings for a session:
```
/best-practices --suppress-warnings
```

Or permanently for a specific pattern:
```
/remember --override "Offset pagination is fine for this use case"
```