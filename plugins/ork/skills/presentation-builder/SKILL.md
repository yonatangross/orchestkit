---
name: presentation-builder
license: MIT
compatibility: "Claude Code 2.1.59+."
description: "Creates zero-dependency, animation-rich HTML presentations from scratch or by converting PowerPoint files. Use when the user wants to build a presentation, convert a PPT/PPTX to web slides, or create a slide deck for a talk, pitch, or tutorial. Generates single self-contained HTML files with inline CSS/JS."
argument-hint: "[topic-or-description]"
user-invocable: false
disable-model-invocation: true
allowed-tools: [AskUserQuestion, Bash, Read, Write, Edit, Grep, Glob, Task]
context: fork
version: 1.0.0
author: OrchestKit
tags: [presentation, slides, html, pptx, design, animation, zero-dependency]
complexity: medium
metadata:
  category: document-asset-creation
  upstream: https://github.com/zarazhangrui/frontend-slides
---

# Presentation Builder

Create zero-dependency, animation-rich HTML presentations that run entirely in the browser.

Based on [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides), restructured for OrchestKit.

## Core Philosophy

1. **Zero Dependencies** -- Single HTML files with inline CSS/JS. No npm, no build tools.
2. **Show, Don't Tell** -- Generate visual previews, not abstract choices. People discover preferences by seeing.
3. **Distinctive Design** -- Avoid generic "AI slop" aesthetics. Every presentation should feel custom-crafted.
4. **Production Quality** -- Well-commented, accessible, performant code.
5. **Viewport Fitting** -- Every slide MUST fit exactly within the viewport. No scrolling within slides, ever.

## Phase 0: Detect Mode

Determine what the user wants:

| Mode | Trigger | Next Phase |
|------|---------|------------|
| **A: New Presentation** | Create slides from scratch | Phase 1 |
| **B: PPT Conversion** | Has a .ppt/.pptx file | [PPT Conversion](references/pptx-conversion.md) then Phase 2 |
| **C: Enhancement** | Has existing HTML presentation | Read file, understand structure, enhance |

---

## Phase 1: Content Discovery

Before designing, understand the content. Use `AskUserQuestion`:

**Question 1: Purpose**
- Header: "Purpose"
- Options: "Pitch deck", "Teaching/Tutorial", "Conference talk", "Internal presentation"

**Question 2: Slide Count**
- Header: "Length"
- Options: "Short (5-10)", "Medium (10-20)", "Long (20+)"

**Question 3: Content Readiness**
- Header: "Content"
- Options: "I have all content ready", "I have rough notes", "I have a topic only"

If user has content, ask them to share it. If topic only, help structure an outline.

---

## Phase 2: Style Discovery

**This is the "show, don't tell" phase.**

### Step 2.0: Style Path Selection

Ask how the user wants to choose their style:

- **"Show me options"** -- Generate 3 previews based on mood (recommended)
- **"I know what I want"** -- Pick from preset list directly

**Available Presets** (see [Style Presets](references/style-presets.md) for full details):

| Preset | Vibe | Best For |
|--------|------|----------|
| Bold Signal | Confident, high-impact | Pitch decks, keynotes |
| Electric Studio | Clean, professional | Agency presentations |
| Creative Voltage | Energetic, retro-modern | Creative pitches |
| Dark Botanical | Elegant, sophisticated | Premium brands |
| Notebook Tabs | Editorial, organized | Reports, reviews |
| Pastel Geometry | Friendly, approachable | Product overviews |
| Split Pastel | Playful, modern | Creative agencies |
| Vintage Editorial | Witty, personality-driven | Personal brands |
| Neon Cyber | Futuristic, techy | Tech startups |
| Terminal Green | Developer-focused | Dev tools, APIs |
| Swiss Modern | Minimal, precise | Corporate, data |
| Paper & Ink | Literary, thoughtful | Storytelling |

### Step 2.1: Mood Selection (Guided Discovery)

If "Show me options", ask via `AskUserQuestion`:

**Question: Vibe**
- "What feeling should the audience have?"
- Options (multiSelect: true, pick up to 2):
  - "Impressed/Confident" -- Professional, trustworthy
  - "Excited/Energized" -- Innovative, bold
  - "Calm/Focused" -- Clear, easy to follow
  - "Inspired/Moved" -- Emotional, memorable

**Mood-to-Style Mapping:**

| Mood | Suggested Styles |
|------|-----------------|
| Impressed/Confident | Bold Signal, Electric Studio, Dark Botanical |
| Excited/Energized | Creative Voltage, Neon Cyber, Split Pastel |
| Calm/Focused | Notebook Tabs, Paper & Ink, Swiss Modern |
| Inspired/Moved | Dark Botanical, Vintage Editorial, Pastel Geometry |

### Step 2.2: Generate Style Previews

Generate **3 distinct mini HTML files** in `.claude-design/slide-previews/`:

```
.claude-design/slide-previews/
├── style-a.html   # ~50-100 lines, single title slide
├── style-b.html
└── style-c.html
```

Each preview: self-contained, inline CSS/JS, animated title slide showing typography, colors, and motion style.

### Step 2.3: Present Previews

Show user the 3 options and ask via `AskUserQuestion`:
- "Which style preview do you prefer?"
- Options: Style A, Style B, Style C, "Mix elements"

---

## Phase 3: Generate Presentation

Generate the full presentation based on content (Phase 1) and style (Phase 2).

### File Output

```
presentation.html    # Self-contained presentation
assets/              # Images if any (PPT conversion)
```

### HTML Architecture

Every presentation follows this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Presentation Title</title>
    <!-- Fonts from Fontshare or Google Fonts -->
    <style>
        /* Theme variables in :root */
        /* Base styles + viewport fitting (see rules/viewport-fitting.md) */
        /* Slide container styles */
        /* Animations */
        /* Responsive breakpoints */
    </style>
</head>
<body>
    <div class="progress-bar"></div>
    <nav class="nav-dots"><!-- JS generated --></nav>
    <section class="slide title-slide">...</section>
    <section class="slide">...</section>
    <!-- More slides -->
    <script>
        /* SlidePresentation class with navigation */
    </script>
</body>
</html>
```

### Critical: Viewport Fitting

**Every slide MUST fit exactly in the viewport. See [Viewport Fitting Rules](rules/viewport-fitting.md).**

Quick checklist:
- Every `.slide` has `height: 100vh; height: 100dvh; overflow: hidden;`
- All font sizes use `clamp(min, preferred, max)`
- All spacing uses `clamp()` or viewport units
- Content respects [density limits](rules/content-density.md)
- Breakpoints exist for heights: 700px, 600px, 500px
- When content doesn't fit: **split into multiple slides, never scroll**

Also see `responsive-patterns` skill for advanced clamp()/container query patterns.

### Required JavaScript Features

1. **SlidePresentation Class** -- Keyboard (arrows, space), touch/swipe, mouse wheel, progress bar, nav dots
2. **Intersection Observer** -- Add `.visible` class on scroll for CSS animations
3. **Optional enhancements** (style-dependent): Custom cursor, particle backgrounds, parallax, 3D tilt, magnetic buttons

### Code Quality

- Every CSS/JS section has clear comments explaining what, why, and how to modify
- Semantic HTML (`<section>`, `<nav>`, `<main>`)
- Keyboard navigation works
- ARIA labels where needed
- Reduced motion support: `@media (prefers-reduced-motion: reduce)`

### Anti-Patterns (DO NOT USE)

- **Fonts:** Inter, Roboto, Arial, system fonts as display
- **Colors:** `#6366f1` (generic indigo), purple gradients on white
- **Layouts:** Everything centered, generic hero sections, identical card grids
- **Decorations:** Realistic illustrations, gratuitous glassmorphism

---

## Phase 4: Delivery

1. **Clean up** `.claude-design/slide-previews/` if it exists
2. **Open** the presentation: `open [filename].html`
3. **Provide summary:**

```
Your presentation is ready!

File: [filename].html
Style: [Style Name]
Slides: [count]

Navigation:
- Arrow keys or Space to navigate
- Scroll/swipe also works
- Click dots on the right to jump

To customize:
- Colors: :root CSS variables at top
- Fonts: Change the font link
- Animations: Modify .reveal class timings
```

---

## Style Reference: Effect-to-Feeling Mapping

| Feeling | Animation Style | Visual Approach |
|---------|----------------|-----------------|
| Dramatic/Cinematic | Slow fade-ins (1-1.5s), large scale transitions | Dark BG, spotlight effects, parallax |
| Techy/Futuristic | Neon glow, glitch/scramble text | Particle systems, grid patterns, monospace accents |
| Playful/Friendly | Bouncy easing, floating animations | Pastel/bright colors, rounded corners |
| Professional/Corporate | Subtle fast animations (200-300ms) | Clean sans-serif, navy/slate, data viz focus |
| Calm/Minimal | Very slow subtle motion | High whitespace, muted palette, serif typography |
| Editorial/Magazine | Strong typography hierarchy | Pull quotes, grid-breaking layouts, B&W + accent |

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Fonts not loading | Check Fontshare/Google Fonts URL, verify font names match CSS |
| Animations not triggering | Verify Intersection Observer is running, check `.visible` class |
| Scroll snap not working | Ensure `scroll-snap-type` on html, `scroll-snap-align` on slides |
| Mobile issues | Disable heavy effects at 768px, test touch events, reduce particles |
| Performance | Use `will-change` sparingly, prefer `transform`/`opacity` animations |

---

## Related Skills

- `ork:responsive-patterns` -- Advanced clamp(), container queries, responsive breakpoints
- `ork:accessibility` -- WCAG 2.2 compliance, keyboard navigation, ARIA patterns
- `ork:ui-components` -- shadcn/ui and Radix component patterns
- `ork:demo-producer` -- Terminal recording and video demos

## Rules

- [Viewport Fitting](rules/viewport-fitting.md) -- Mandatory CSS for viewport-locked slides
- [Content Density](rules/content-density.md) -- Maximum content per slide type

## References

- [Style Presets](references/style-presets.md) -- 12 curated visual themes with CSS variables
- [PPT Conversion](references/pptx-conversion.md) -- PowerPoint extraction and conversion workflow
