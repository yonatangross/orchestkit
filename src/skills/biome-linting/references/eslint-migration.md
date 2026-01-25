# ESLint to Biome Migration

Step-by-step guide for migrating from ESLint + Prettier.

## Quick Migration

```bash
# Auto-migrate existing ESLint config
npx @biomejs/biome migrate eslint --write

# Preview changes without writing
npx @biomejs/biome migrate eslint
```

This reads your `.eslintrc.*` or `eslint.config.js` and creates `biome.json`.

## Manual Migration Steps

### 1. Install Biome

```bash
# Install as dev dependency
npm install --save-dev --save-exact @biomejs/biome

# Or with other package managers
pnpm add -D -E @biomejs/biome
yarn add -D -E @biomejs/biome
bun add -D -E @biomejs/biome
```

### 2. Initialize Configuration

```bash
npx @biomejs/biome init
```

This creates a basic `biome.json`.

### 3. Map ESLint Rules

| ESLint Rule | Biome Equivalent |
|-------------|------------------|
| `no-unused-vars` | `correctness/noUnusedVariables` |
| `no-console` | `suspicious/noConsole` |
| `eqeqeq` | `suspicious/noDoubleEquals` |
| `no-debugger` | `suspicious/noDebugger` |
| `no-empty` | `suspicious/noEmptyBlockStatements` |
| `no-extra-boolean-cast` | `complexity/noExtraBooleanCast` |
| `no-var` | `style/noVar` |
| `prefer-const` | `style/useConst` |
| `prefer-template` | `style/useTemplate` |

### 4. Map TypeScript ESLint Rules

| TypeScript ESLint | Biome Equivalent |
|-------------------|------------------|
| `@typescript-eslint/no-explicit-any` | `suspicious/noExplicitAny` |
| `@typescript-eslint/no-unused-vars` | `correctness/noUnusedVariables` |
| `@typescript-eslint/no-non-null-assertion` | `style/noNonNullAssertion` |
| `@typescript-eslint/prefer-as-const` | `style/useAsConstAssertion` |
| `@typescript-eslint/no-floating-promises` | `nursery/noFloatingPromises` |

### 5. Map React Rules

| ESLint React | Biome Equivalent |
|--------------|------------------|
| `react/jsx-no-duplicate-props` | `suspicious/noDuplicateJsxProps` |
| `react/no-children-prop` | `correctness/noChildrenProp` |
| `react/void-dom-elements-no-children` | `correctness/noVoidElementsWithChildren` |
| `react-hooks/rules-of-hooks` | `correctness/useHookAtTopLevel` |
| `react-hooks/exhaustive-deps` | `correctness/useExhaustiveDependencies` |

### 6. Map Accessibility Rules

| ESLint JSX A11y | Biome Equivalent |
|-----------------|------------------|
| `jsx-a11y/alt-text` | `a11y/useAltText` |
| `jsx-a11y/anchor-is-valid` | `a11y/useValidAnchor` |
| `jsx-a11y/click-events-have-key-events` | `a11y/useKeyWithClickEvents` |
| `jsx-a11y/no-autofocus` | `a11y/noAutofocus` |

### 7. Transition Period

Run both linters in parallel during migration:

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:legacy": "eslint .",
    "lint:compare": "npm run lint && npm run lint:legacy"
  }
}
```

### 8. Handle Unsupported Rules

Use `overrides` to disable Biome for files with unsupported patterns:

```json
{
  "overrides": [
    {
      "include": ["legacy/**"],
      "linter": {
        "enabled": false
      }
    }
  ]
}
```

### 9. Remove ESLint

Once migration is complete:

```bash
# Remove ESLint packages
npm uninstall eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y \
  eslint-config-prettier eslint-plugin-prettier prettier

# Remove config files
rm .eslintrc* eslint.config.* .eslintignore .prettierrc* .prettierignore
```

## VS Code Setup

Update `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

## Common Migration Issues

### Rule Not Available
Some ESLint rules don't have Biome equivalents. Check the Biome rules reference or disable in Biome's config.

### Different Behavior
Some rules behave slightly differently. Test thoroughly after migration.

### Plugin Rules
Framework-specific plugin rules may not all be available. Check Biome's roadmap for planned support.
