# Biome Configuration Reference

Complete `biome.json` configuration options.

## Schema

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json"
}
```

## Top-Level Structure

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "formatter": { /* ... */ },
  "linter": { /* ... */ },
  "javascript": { /* ... */ },
  "json": { /* ... */ },
  "css": { /* ... */ },
  "files": { /* ... */ },
  "vcs": { /* ... */ },
  "overrides": [ /* ... */ ]
}
```

## Formatter Configuration

```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf",
    "formatWithErrors": false,
    "ignore": ["**/dist/**"]
  }
}
```

| Option | Values | Default |
|--------|--------|---------|
| `enabled` | `true`, `false` | `true` |
| `indentStyle` | `"tab"`, `"space"` | `"tab"` |
| `indentWidth` | `1-24` | `2` |
| `lineWidth` | `1-320` | `80` |
| `lineEnding` | `"lf"`, `"crlf"`, `"cr"` | `"lf"` |

## Linter Configuration

```json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noConsole": "warn"
      },
      "style": {
        "noVar": "error",
        "useConst": "error",
        "useTemplate": "warn"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": {
          "level": "warn",
          "options": {
            "maxAllowedComplexity": 15
          }
        }
      },
      "nursery": {
        "noFloatingPromises": "error"
      }
    }
  }
}
```

### Rule Levels

- `"off"` - Disable the rule
- `"warn"` - Show warning, don't fail
- `"error"` - Show error, fail CI

### Rule Categories

| Category | Description |
|----------|-------------|
| `recommended` | Enable all recommended rules |
| `correctness` | Likely bugs and mistakes |
| `suspicious` | Code that's likely wrong |
| `style` | Code style issues |
| `complexity` | Overly complex code |
| `performance` | Performance issues |
| `security` | Security vulnerabilities |
| `a11y` | Accessibility issues |
| `nursery` | Experimental rules |

## JavaScript Configuration

```json
{
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "asNeeded",
      "arrowParentheses": "always",
      "quoteProperties": "asNeeded",
      "bracketSpacing": true,
      "bracketSameLine": false
    },
    "globals": ["React", "JSX"],
    "parser": {
      "unsafeParameterDecoratorsEnabled": false
    }
  }
}
```

## JSON Configuration

```json
{
  "json": {
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "lineWidth": 80,
      "trailingCommas": "none"
    },
    "parser": {
      "allowComments": true,
      "allowTrailingCommas": true
    }
  }
}
```

## CSS Configuration

```json
{
  "css": {
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "lineWidth": 80,
      "quoteStyle": "double"
    },
    "linter": {
      "enabled": true
    }
  }
}
```

## Files Configuration

```json
{
  "files": {
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "ignore": [
      "node_modules",
      "dist",
      "build",
      ".next",
      "coverage",
      "*.min.js"
    ],
    "ignoreUnknown": true,
    "maxSize": 1048576
  }
}
```

## VCS Integration

```json
{
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "root": ".",
    "defaultBranch": "main"
  }
}
```

## Overrides

Apply different settings to specific files:

```json
{
  "overrides": [
    {
      "include": ["*.test.ts", "*.spec.ts", "**/__tests__/**"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    },
    {
      "include": ["scripts/**"],
      "linter": {
        "enabled": false
      }
    },
    {
      "include": ["*.config.js", "*.config.ts"],
      "formatter": {
        "lineWidth": 120
      }
    }
  ]
}
```

## Extends (2.0+)

Extend from other configurations:

```json
{
  "extends": ["./biome-base.json"]
}
```
