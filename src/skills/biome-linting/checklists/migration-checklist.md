# ESLint to Biome Migration Checklist

Step-by-step verification for migration.

## Pre-Migration

- [ ] Document current ESLint config
- [ ] List all ESLint plugins in use
- [ ] Identify critical rules that must be preserved
- [ ] Backup existing config files
- [ ] Note any custom rules

## Installation

- [ ] Install Biome: `npm install -D --save-exact @biomejs/biome`
- [ ] Run init: `npx @biomejs/biome init`
- [ ] Run auto-migrate: `npx @biomejs/biome migrate eslint --write`
- [ ] Review generated `biome.json`

## Rule Mapping

### Core ESLint Rules
- [ ] `no-unused-vars` → `correctness/noUnusedVariables`
- [ ] `no-console` → `suspicious/noConsole`
- [ ] `eqeqeq` → `suspicious/noDoubleEquals`
- [ ] `no-var` → `style/noVar`
- [ ] `prefer-const` → `style/useConst`

### TypeScript ESLint
- [ ] `@typescript-eslint/no-explicit-any` → `suspicious/noExplicitAny`
- [ ] `@typescript-eslint/no-unused-vars` → `correctness/noUnusedVariables`
- [ ] `@typescript-eslint/no-floating-promises` → `nursery/noFloatingPromises`

### React Rules
- [ ] `react-hooks/rules-of-hooks` → `correctness/useHookAtTopLevel`
- [ ] `react-hooks/exhaustive-deps` → `correctness/useExhaustiveDependencies`
- [ ] `react/jsx-no-duplicate-props` → `suspicious/noDuplicateJsxProps`

### Accessibility Rules
- [ ] `jsx-a11y/alt-text` → `a11y/useAltText`
- [ ] `jsx-a11y/anchor-is-valid` → `a11y/useValidAnchor`

## Formatting (Prettier Replacement)

- [ ] Configure `formatter` section in biome.json
- [ ] Set `indentStyle` (tab/space)
- [ ] Set `indentWidth`
- [ ] Set `lineWidth`
- [ ] Set `quoteStyle` (single/double)
- [ ] Set `trailingCommas` preference
- [ ] Set `semicolons` preference

## Editor Setup

### VS Code
- [ ] Install Biome extension
- [ ] Update settings.json:
  ```json
  {
    "editor.defaultFormatter": "biomejs.biome",
    "editor.formatOnSave": true
  }
  ```
- [ ] Disable ESLint extension (or set for specific workspaces)
- [ ] Disable Prettier extension

### Other Editors
- [ ] Neovim: Configure LSP with biome
- [ ] WebStorm: Enable Biome support

## CI/CD

- [ ] Update lint script: `"lint": "biome check ."`
- [ ] Update format script: `"format": "biome format --write ."`
- [ ] Update GitHub Actions workflow
- [ ] Update any pre-commit hooks

## Testing

- [ ] Run `biome check .` on full codebase
- [ ] Compare output to previous ESLint output
- [ ] Fix any new issues found
- [ ] Run `biome format --write .` to standardize formatting
- [ ] Commit formatting changes in dedicated commit

## Parallel Running Period

- [ ] Keep ESLint installed temporarily
- [ ] Run both: `npm run lint && npm run lint:eslint`
- [ ] Address discrepancies
- [ ] Monitor for missed issues

## Cleanup

- [ ] Remove ESLint packages:
  ```bash
  npm uninstall eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
    eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y \
    eslint-config-prettier eslint-plugin-prettier
  ```
- [ ] Remove Prettier packages:
  ```bash
  npm uninstall prettier eslint-config-prettier eslint-plugin-prettier
  ```
- [ ] Delete config files:
  ```bash
  rm -f .eslintrc* eslint.config.* .eslintignore .prettierrc* .prettierignore
  ```
- [ ] Update README/docs

## Verification

- [ ] All lint scripts work
- [ ] CI pipeline passes
- [ ] Format on save works in editor
- [ ] Pre-commit hooks work
- [ ] No regression in code quality

## Post-Migration

- [ ] Document any rules not migrated
- [ ] Create issues for missing rule coverage
- [ ] Train team on Biome commands
- [ ] Update contributing guidelines
