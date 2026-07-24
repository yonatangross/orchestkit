# Frontend UI Developer Memory

## Playground Design Patterns (confirmed from existing files)

Dark GitHub-inspired theme with CSS variables:
- `--bg: #0d1117` surface: `#161b22` surface2: `#21262d` border: `#30363d`
- Colors: blue `#58a6ff` green `#3fb950` yellow `#d29922` red `#f85149` purple `#bc8cff` orange `#e3b341` cyan `#39d2c0` pink `#f778ba`
- Font: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` mono: `'SF Mono','Fira Code','Cascadia Code',monospace`
- Single HTML file with inline CSS/JS — no external dependencies
- Grid layout: sidebar (260-300px) | main | right panel (320px)
- Tab switching via data-tab attribute + JS classList
- `display: none` / `display: block` pattern for tab panels (NOT visibility)
- Animations: `@keyframes` fadeIn, pulse; CSS `transition` for hover states
- Scrollbar: custom via `::-webkit-scrollbar` (6px width, border2 color)

## OrchestKit Data (v7.0.0 confirmed)
- 38 agents, 17 user-invocable skills, 52 internal skills, 96 hooks
- All playground files live at `/Users/yonatangross/coding/orchestkit/playground/`
