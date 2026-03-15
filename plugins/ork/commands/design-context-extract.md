---
description: "Extract design DNA from existing app screenshots or live URLs using Google Stitch. Produces color palettes, typography specs, spacing tokens, and component patterns as design-tokens.json or Tailwind config. Use when auditing an existing design, creating a design system from a live app, or ensuring new pages match an established visual identity."
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/design-context-extract/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Design Context Extract

Extract the "Design DNA" from existing applications — colors, typography, spacing, and component patterns — and output as structured tokens.

```bash
/ork:design-context-extract /tmp/screenshot.png       # From screenshot
/ork:design-context-extract https://example.com        # From live URL
/ork:design-context-extract current project            # Scan project's existing styles
```

## Pipeline

```
Input (screenshot/URL/project)
  │
  ▼
┌──────────────────────────────┐
│ Capture                       │  Screenshot or fetch HTML/CSS
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Extract                       │  Stitch extract_design_context
│                               │  OR multimodal analysis (fallback)
│ → Colors (hex + oklch)        │
│ → Typography (families, scale)│
│ → Spacing (padding, gaps)     │
│ → Components (structure)      │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Output                        │  Choose format:
│ → design-tokens.json (W3C)    │
│ → tailwind.config.ts          │
│ → tokens.css (CSS variables)  │
│ → Markdown spec               │
└──────────────────────────────┘
```

## Step 0: Detect Input and Context

```python
INPUT = ""

TaskCreate(subject="Extract design context: {INPUT}", description="Extract design DNA")

# Determine input type
# "/path/to/file.png" → screenshot
# "http..." → URL
# "current project" → scan project styles
```

## Step 1: Capture Source

**For screenshots:** Read the image directly (Claude is multimodal).

**For URLs:**
```python
# If stitch-mcp available: use get_screen_image + get_screen_code
# If not: WebFetch the URL and analyze HTML/CSS
```

**For current project:**
```python
Glob("**/tailwind.config.*")
Glob("**/tokens.css")
Glob("**/*.css")  # Look for design token files
Glob("**/theme.*")
# Read and analyze existing style definitions
```

## Step 2: Extract Design Context

**If stitch-mcp is available:**
```python
# Use extract_design_context tool
# Returns structured design data: colors, typography, layout, components
```

**If stitch-mcp is NOT available (fallback):**
```python
# Multimodal analysis of screenshot:
# - Identify dominant colors (sample from regions)
# - Detect font families and size hierarchy
# - Measure spacing patterns
# - Catalog component types (cards, buttons, headers, etc.)
#
# For URLs: parse CSS custom properties, Tailwind config, computed styles
```

Extracted data structure:
```json
{
  "colors": {
    "primary": { "hex": "#3B82F6", "oklch": "oklch(0.62 0.21 255)" },
    "secondary": { "hex": "#10B981", "oklch": "oklch(0.69 0.17 163)" },
    "background": { "hex": "#FFFFFF" },
    "text": { "hex": "#1F2937" },
    "muted": { "hex": "#9CA3AF" }
  },
  "typography": {
    "heading": { "family": "Inter", "weight": 700 },
    "body": { "family": "Inter", "weight": 400 },
    "scale": [12, 14, 16, 18, 24, 30, 36, 48]
  },
  "spacing": {
    "base": 4,
    "scale": [4, 8, 12, 16, 24, 32, 48, 64]
  },
  "components": ["navbar", "hero", "card", "button", "footer"]
}
```

## Step 3: Choose Output Format

```python
AskUserQuestion(questions=[{
  "question": "Output format for extracted tokens?",
  "header": "Format",
  "options": [
    {"label": "Tailwind config (Recommended)", "description": "tailwind.config.ts with extracted theme values"},
    {"label": "W3C Design Tokens", "description": "design-tokens.json following W3C DTCG spec"},
    {"label": "CSS Variables", "description": "tokens.css with CSS custom properties"},
    {"label": "Markdown spec", "description": "Human-readable design specification document"}
  ],
  "multiSelect": false
}])
```

## Step 4: Generate Output

Write the extracted tokens in the chosen format. If the project already has tokens, show a diff of what's new vs existing.

## Anti-Patterns

- **NEVER** guess colors without analyzing the actual source — use precise extraction
- **NEVER** skip the oklch conversion — all colors must have oklch equivalents
- **NEVER** output flat token structures — use three-tier hierarchy (global/alias/component)

## Related Skills

- `ork:design-to-code` — Full pipeline that uses this as Stage 1
- `ork:design-system-tokens` — Token architecture and W3C spec compliance
- `ork:component-search` — Find components that match extracted patterns
