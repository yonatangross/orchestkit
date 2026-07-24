# Rapid UI Designer - Agent Memory

## Project Context
- **OrchestKit docs site**: Fumadocs v16.5 + Next.js 16 + Tailwind v4
- **Current theme**: fumadocs-ui/css/ocean.css (light/dark), Geist + Geist Mono fonts
- **Fumadocs CSS vars**: Use `--fd-*` prefix (--fd-background, --fd-primary, --fd-border, etc.)
- **Tailwind v4**: Uses `@theme` directive for token generation, NOT tailwind.config.js

## Docs Site Redesign (2026-02-08)
- Created 3 concepts: A (Neon Command Center), B (Obsidian Studio), C (Circuit Forge)
- All specs at: `designs/docs-site-redesign/`
- Each concept has: JSON spec, CSS theme file, hero mockup in hero-mockups.md
- Decision matrix recommends Concept C but notes hybrid possibility
- Key insight: Fumadocs needs `--fd-*` CSS variable overrides to theme properly

## Fumadocs Theming Pattern
- Import order matters: `@import "tailwindcss"` then `fumadocs-ui/css/preset.css` then custom theme
- Override `--fd-*` vars in both `:root` and `.dark` selectors
- The `fd-*` utility classes (fd-primary, fd-border, etc.) map to these CSS vars
- Set `color-scheme: dark` in `:root` for dark-first designs

## Tailwind v4 Patterns
- `@theme {}` generates utility classes from custom properties
- `--color-*` tokens in @theme become `bg-*`, `text-*`, `border-*` utilities
- `--shadow-*` tokens become `shadow-*` utilities
- `--radius-*` tokens become `rounded-*` utilities
- DO NOT use `bg-[var(--color-x)]` — use the utility class directly

## Accessibility Baseline (Dark UIs)
- #e2e8f0 on #0a0a0f = 14.5:1 (excellent for primary text)
- #94a3b8 on #0a0a0f = 7.2:1 (good for body text)
- #64748b on #0a0a0f = 4.6:1 (minimum for captions — just passes AA)
- Always define focus-visible with ring-offset matching page bg color
- `prefers-reduced-motion: reduce` must disable all animations
