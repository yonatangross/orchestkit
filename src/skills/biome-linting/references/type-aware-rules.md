# Biome 2.0 Type-Aware Rules

Leveraging TypeScript type inference for better linting.

## How Type Inference Works

Biome 2.0 reads `.d.ts` files from `node_modules` to infer types without requiring `tsconfig.json`. This enables type-aware lint rules similar to typescript-eslint.

## Key Type-Aware Rules

### noFloatingPromises

Catches unhandled promises:

```typescript
// ❌ Error: Promise not awaited or handled
async function fetchData() {
  return { data: 'example' }
}

fetchData() // Floating promise!

// ✅ Correct
await fetchData()
fetchData().catch(console.error)
void fetchData() // Explicitly ignored
```

Configuration:

```json
{
  "linter": {
    "rules": {
      "nursery": {
        "noFloatingPromises": "error"
      }
    }
  }
}
```

### noMisusedPromises

Prevents passing promises where non-promises expected:

```typescript
// ❌ Error: Promise passed to boolean context
const items = [1, 2, 3]
items.filter(async (item) => {
  const result = await checkItem(item)
  return result // This returns Promise<boolean>, not boolean!
})

// ✅ Correct: Use regular function and await inside Promise.all
const results = await Promise.all(items.map(checkItem))
const filtered = items.filter((_, i) => results[i])
```

### noVoidTypeReturn

Prevents returning value from void functions:

```typescript
// ❌ Error: Returning value from void function
function logMessage(msg: string): void {
  console.log(msg)
  return msg // Shouldn't return from void function
}
```

## Configuring Type Inference

```json
{
  "javascript": {
    "parser": {
      // Enable if using decorators without emitDecoratorMetadata
      "unsafeParameterDecoratorsEnabled": false
    }
  },
  "linter": {
    "rules": {
      "nursery": {
        "noFloatingPromises": "error"
      }
    }
  }
}
```

## Coverage Comparison

| Rule | Biome 2.0 Coverage | typescript-eslint |
|------|-------------------|-------------------|
| noFloatingPromises | ~85% | 100% |
| noMisusedPromises | ~80% | 100% |
| Type-narrowing | Partial | Full |

Biome's type inference covers common cases but may miss complex generics or conditional types.

## When Type Rules Don't Apply

Biome won't infer types for:

1. **Dynamic imports** without type annotations
2. **Complex generic inference**
3. **Conditional types with deep nesting**
4. **Files not in include patterns**

## Performance Considerations

Type inference adds overhead:

```json
{
  "files": {
    // Limit type inference scope
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "ignore": ["**/*.js", "**/*.mjs"]
  }
}
```

## Gradual Adoption

Start with warnings, then escalate:

```json
{
  "linter": {
    "rules": {
      "nursery": {
        // Start as warning
        "noFloatingPromises": "warn"
      }
    }
  }
}
```

After fixing issues:

```json
{
  "linter": {
    "rules": {
      "nursery": {
        // Promote to error
        "noFloatingPromises": "error"
      }
    }
  }
}
```

## Multi-File Analysis

Biome 2.0 supports cross-file analysis for:

- Import/export validation
- Type references across modules
- Dead code detection across files

This is still evolving; check Biome release notes for updates.

## Best Practices

1. **Enable gradually**: Start with warnings in CI
2. **Focus on high-value rules**: `noFloatingPromises` catches real bugs
3. **Pair with TypeScript**: Biome complements, doesn't replace tsc
4. **Monitor performance**: Type inference adds CPU time
5. **Keep dependencies typed**: Ensure packages have types
