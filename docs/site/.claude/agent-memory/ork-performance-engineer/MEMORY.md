# Performance Engineer Memory - OrchestKit Docs Site

## Critical Finding: playground-data.ts (2026-02-08)

- File: `/Users/yonatangross/coding/projects/orchestkit/docs/site/lib/playground-data.ts`
- Size: 881KB source, 886KB bundled (263KB gzipped)
- The SKILLS record alone is 521KB (full SKILL.md content embedded in each entry)
- This single chunk is loaded on ALL 200+ docs pages via client components
- Only 3 pages actually need SKILLS data (skill-browser), only 3 need COMPOSITIONS (demo-gallery + home), only 1 needs PLUGINS (setup-wizard)
- Tree-shaking CANNOT work because all exports are from a single file and consumed by "use client" components

## Key Metrics Baseline (2026-02-08)

- Landing page JS: ~686KB total (no playground-data -- good)
- Docs pages JS: ~686KB + 886KB = ~1.5MB (bad)
- CSS: 124KB single chunk (Fumadocs + Tailwind + custom)
- Thumbnails: 64 PNGs, avg 38KB each, 2.5MB total
- Site is fully statically generated (SSG) -- good for LCP

## Architecture Observations

- Next.js 16 + Fumadocs v16.5 + React 19
- Fonts: Geist + Geist Mono via next/font/google (optimal -- preloaded, no CLS)
- No next/image usage anywhere -- raw `<img>` tags for thumbnails
- 5 "use client" components: copy-button, setup-wizard, demo-gallery, skill-browser, agent-selector
- CopyInstallButton on landing page is minimal (good -- tight client boundary)
- Landing page hero is SSR text-only (no images for LCP -- excellent)

## Priority Fixes (High to Low Impact)

1. **P0: Split playground-data.ts** into separate files per export (SKILLS, COMPOSITIONS, PLUGINS, AGENTS)
   - Or use dynamic imports in the client components that need them
   - Impact: -886KB on pages that don't need all data

2. **P1: Convert thumbnails to WebP/AVIF** and use next/image
   - Missing width/height on `<img>` tags causes CLS
   - No responsive sizing -- serves same image on mobile and desktop

3. **P2: Lazy load DemoGallery/SkillBrowser/SetupWizard** with React.lazy
   - These are below-the-fold interactive widgets in MDX docs pages

4. **P3: CSS duplication** -- dark mode overrides identical to @theme defaults (lines 49-67 in global.css)
