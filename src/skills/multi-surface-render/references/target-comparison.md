# Target Comparison Matrix

## All Targets — Capabilities Overview

| Target | Package | Output | Server-Side | Streaming | File Output | Sizing |
|--------|---------|--------|-------------|-----------|-------------|--------|
| React | `@json-render/react` | JSX | No (client) | Yes (progressive) | No | Responsive |
| Vue | `@json-render/vue` | Vue components | SSR supported | Yes | No | Responsive |
| Svelte | `@json-render/svelte` | Svelte components | SSR supported | Yes | No | Responsive |
| React Native | `@json-render/react-native` | Native views | No | Yes | No | Flex-based |
| PDF | `@json-render/react-pdf` | Buffer/File/Stream | Yes | Via stream | Yes | Fixed (A4, Letter) |
| Email | `@json-render/react-email` | HTML string | Yes | No | No | 600px max-width |
| Remotion | `@json-render/remotion` | MP4/WebM | Yes (render) | No | Yes | Fixed (px) |
| Image | `@json-render/image` | SVG/PNG | Yes | No | Yes (buffer) | Fixed (px) |
| YAML | `@json-render/yaml` | YAML string | Yes | No | No | N/A |
| MCP | `@json-render/mcp` | Sandboxed iframe | Yes | Yes | No | Constrained |
| 3D | `@json-render/react-three-fiber` | Three.js canvas | No | No | No | Canvas-based |
| Codegen | `@json-render/codegen` | TypeScript/JSX | Yes | No | Yes | N/A |

## Registry Component Primitives by Target

| Target | Base Elements | Styling | Layout |
|--------|--------------|---------|--------|
| React | `div`, `span`, `h1`-`h6`, `p`, `img` | className, CSS modules, Tailwind | Flexbox, Grid, any CSS |
| PDF | `View`, `Text`, `Image` (react-pdf) | StyleSheet.create() | Flexbox only |
| Email | `Section`, `Text`, `Heading`, `Button` (react-email) | Inline styles | Table-based (email compat) |
| Image | `div`, `span`, `img` (Satori subset) | Inline styles only | Flexbox only (limited) |
| Remotion | `div`, `span` + Remotion primitives | Inline styles, CSS | Flexbox, absolute positioning |
| React Native | `View`, `Text`, `Image` (RN) | StyleSheet.create() | Flexbox only |

## Limitations by Target

### PDF (`@json-render/react-pdf`)
- No CSS grid — flexbox only
- No className — use `StyleSheet.create()`
- No `<div>`/`<span>` — must use `<View>`/`<Text>`
- Font embedding required for custom fonts
- No interactive elements (buttons, links are display-only)

### Email (`@json-render/react-email`)
- 600px max-width (email client constraint)
- Table-based layout for Outlook compatibility
- Limited CSS support (no flexbox in Outlook, no grid)
- Inline styles only for maximum compatibility
- No JavaScript interactivity

### Image (`@json-render/image` / Satori)
- No CSS grid
- Limited flexbox (no `flex-wrap`, limited `align-items`)
- No `box-shadow`
- No CSS animations or transitions
- No external stylesheets — inline styles only
- `position: absolute` has limited nesting support
- Custom fonts must be loaded as ArrayBuffer

### Remotion (`@json-render/remotion`)
- No user interaction (pre-rendered video)
- Rendering is CPU-intensive — use cloud rendering for production
- Must specify exact `durationInFrames` and `fps`
- All animations must be frame-based (`useCurrentFrame`)

### React Native (`@json-render/react-native`)
- No `div`/`span` — use `View`/`Text`
- No CSS grid — flexbox only
- No className — use `StyleSheet.create()`
- Platform-specific behavior (iOS vs Android)

## Performance Characteristics

| Target | Render Time | Memory | CPU |
|--------|-------------|--------|-----|
| React | <50ms (client) | Low | Low |
| PDF (buffer) | 200-500ms | Medium | Medium |
| PDF (stream) | 100-300ms start | Low | Medium |
| Email | 50-100ms | Low | Low |
| Image (SVG) | 100-200ms | Low | Low |
| Image (PNG) | 200-400ms | Medium | Medium |
| Remotion | 10-60s (full render) | High | High |
| Codegen | 50-100ms | Low | Low |

## When to Use Multiple Targets

Common multi-target combinations:

| Use Case | Targets | Example |
|----------|---------|---------|
| Dashboard + PDF export | React + PDF | Web dashboard with "Download PDF" button |
| Dashboard + email digest | React + Email | Web view + weekly email summary |
| Blog + social sharing | React + Image | Blog post + OG image preview |
| Product page + demo | React + Remotion | Landing page + demo video |
| Full marketing suite | React + PDF + Email + Image + Remotion | All surfaces from one spec |
