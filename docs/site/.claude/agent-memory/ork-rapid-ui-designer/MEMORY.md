# Rapid UI Designer -- Agent Memory

## OrchestKit Docs Site Design Audit (2026-02-08)

### Critical Finding: Dual Design Language
- Landing page (`app/(home)/page.tsx`) uses Circuit Forge raw hex colors
- All interactive components (`agent-selector`, `skill-browser`, `setup-wizard`, `demo-gallery`) use generic gray/teal Tailwind instead of fd-* tokens
- Accent hue mismatch: landing = emerald (#10b981), components = teal (Tailwind teal-500 = #14b8a6)
- Score: 6.3/10 overall, 5/10 on visual consistency and brand coherence

### Token System
- `global.css` defines `@theme` tokens: `--color-fd-background`, `--color-fd-primary`, etc.
- fd-* utility classes exist but are used in only ~4 lines across all 4 interactive components
- Landing page uses raw hex (#0c0f14, #111621, #1e293b, #10b981, #e2e8f0, #94a3b8, #64748b)
- Both should migrate to fd-* utilities

### Key Color Mapping
| Token | Hex | Tailwind Utility |
|-------|-----|-----------------|
| background | #0c0f14 | bg-fd-background |
| card/popover | #111621 | bg-fd-card |
| border | #1e293b | border-fd-border |
| primary (emerald) | #10b981 | bg-fd-primary, text-fd-primary |
| foreground | #e2e8f0 | text-fd-foreground |
| muted-foreground | #94a3b8 | text-fd-muted-foreground |
| muted | #1c2436 | bg-fd-muted |
| secondary | #171d2b | bg-fd-secondary |

### Known Bugs
- `slide-up` keyframe used in agent-selector quiz modal and demo-gallery modal but never defined in global.css
- Desktop stat bar (page.tsx:72-98) uses dd/dt without dl wrapper
- DOM manipulation in demo-gallery.tsx:360-371 onError handler bypasses React

### Duplicated Code
- `useFocusTrap` hook copy-pasted in agent-selector.tsx and demo-gallery.tsx -- extract to shared hook

### Category Color Inconsistency
- agent-data.ts devops = violet, skill-browser.tsx devops = orange
- agent-data.ts quality = emerald (same as brand primary -- confusing)
- demo-gallery.tsx has its own separate COMP_CATEGORY_META

### Accessibility Notes
- global.css focus-visible ring: 2px offset with emerald -- good
- prefers-reduced-motion respected for animations
- Skip-to-content link implemented in layout.tsx
- All filter buttons have aria-pressed
- Modals have role="dialog", aria-modal, focus trap, escape key, scroll lock
- Missing: global search, URL state persistence for filters
