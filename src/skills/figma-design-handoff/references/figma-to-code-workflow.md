# Figma-to-Code Workflow

End-to-end workflow for converting Figma designs to production code with automated token pipelines.

## Workflow Diagram

```
┌────────────────────────────────────────────────────────────┐
│                     DESIGN PHASE                           │
│                                                            │
│  Designer creates:                                         │
│  • Components with variants (Button: primary/secondary)    │
│  • Variables for colors, spacing, typography                │
│  • Auto Layout for all container frames                    │
│  • Modes for light/dark, compact/comfortable               │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│                    EXPORT PHASE                             │
│                                                            │
│  Automated via Figma REST API or plugin:                   │
│  • GET /v1/files/{key}/variables/local → token JSON        │
│  • GET /v1/files/{key}/component_sets → component specs    │
│  • Export assets via /v1/images/{key} → SVG/PNG            │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│                   TRANSFORM PHASE                           │
│                                                            │
│  Style Dictionary processes W3C DTCG tokens:               │
│  • Input: tokens/figma-raw.json                            │
│  • Transforms: color/oklch, size/rem, name/cti/kebab       │
│  • Output: CSS variables, Tailwind theme, iOS/Android      │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│                    BUILD PHASE                              │
│                                                            │
│  Developer implements components:                          │
│  • Map Auto Layout → CSS Flexbox/Grid                      │
│  • Apply token variables (not hardcoded values)            │
│  • Implement all variant/state combinations                │
│  • Write Storybook stories for each component              │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│                   VERIFY PHASE                              │
│                                                            │
│  Visual regression in CI:                                  │
│  • Chromatic captures Storybook story snapshots            │
│  • Applitools compares production ↔ Figma frames           │
│  • Percy captures full-page responsive screenshots         │
│  • PR blocked until visual diffs approved                  │
└────────────────────────────────────────────────────────────┘
```

## Toolchain Options

| Stage | Tool | Purpose |
|-------|------|---------|
| Export | Figma REST API | Programmatic access to Variables, components, images |
| Export | Tokens Studio Plugin | GUI-based token export to JSON |
| Transform | Style Dictionary | Token transformation to platform outputs |
| Transform | Cobalt UI | W3C DTCG-native token compiler |
| Build | Tailwind CSS | Utility-first CSS from token theme |
| Build | CVA + cn() | Type-safe component variants |
| Verify | Chromatic | Storybook visual regression |
| Verify | Applitools Eyes | AI-powered visual comparison |
| Verify | Percy | Page-level visual snapshots |

## CI Pipeline Example

```yaml
# .github/workflows/design-sync.yml
name: Design Token Sync
on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly Monday 9am
  workflow_dispatch:

jobs:
  sync-tokens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node scripts/figma-to-w3c-tokens.js
        env:
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
          FIGMA_FILE_KEY: ${{ vars.FIGMA_FILE_KEY }}
      - run: npx style-dictionary build
      - uses: peter-evans/create-pull-request@v6
        with:
          title: 'chore: sync design tokens from Figma'
          branch: chore/design-token-sync
```
