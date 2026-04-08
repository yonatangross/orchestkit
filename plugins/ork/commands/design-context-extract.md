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

# 1. Create main task IMMEDIATELY
TaskCreate(subject="Extract design context: {INPUT}", description="Extract design DNA", activeForm="Extracting design from {INPUT}")

# 2. Create subtasks for each phase
TaskCreate(subject="Detect input type and context", activeForm="Detecting input type")             # id=2
TaskCreate(subject="Capture source material", activeForm="Capturing source")                       # id=3
TaskCreate(subject="Extract design tokens", activeForm="Extracting tokens")                        # id=4
TaskCreate(subject="Choose output format and generate", activeForm="Generating output")            # id=5
TaskCreate(subject="Recommend shadcn/ui style", activeForm="Recommending style")                   # id=6

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Capture needs input type detected
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Extraction needs captured source
TaskUpdate(taskId="5", addBlockedBy=["4"])  # Output needs extracted tokens
TaskUpdate(taskId="6", addBlockedBy=["5"])  # Style recommendation needs output

# 4. Before starting each task, verify it's unblocked
task = TaskGet(taskId="2")  # Verify blockedBy is empty

# 5. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask

# Determine input type
# "/path/to/file.png" → screenshot
# "http..." → URL
# "current project" → scan project styles
```

## Step 1: Capture Source

**For screenshots:** Read the image directly (Claude is multimodal).

**For URLs:**
```python
# If stitch available: use get_screen + get_project
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

**If stitch MCP is available:**
```python
# Use official Stitch MCP tools: get_screen, get_project, list_screens
# Returns structured design data: colors, typography, layout, components
```

**If stitch MCP is NOT available (fallback):**
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

## Step 5: Recommend Best-Fit shadcn/ui Style

After extracting design DNA, map the extracted characteristics to the best-fit shadcn/ui v4 style:

```python
# Map extracted design DNA → shadcn style recommendation
radius = extracted["radius"]      # e.g., "large", "pill", "none", "small"
density = extracted["spacing"]    # e.g., "generous", "balanced", "compact", "dense"
elevation = extracted["shadows"]  # e.g., "layered", "subtle", "none"

STYLE_MAP = {
    # (radius, density, elevation) → style
    ("pill/large", "generous", "layered"):  "Luma — polished, macOS-like",
    ("medium",     "balanced", "subtle"):   "Vega — general purpose",
    ("medium",     "compact",  "subtle"):   "Nova — dense dashboards",
    ("large",      "generous", "subtle"):   "Maia — soft, consumer-facing",
    ("none/sharp", "balanced", "none"):     "Lyra — editorial, dev tools",
    ("small",      "dense",    "none"):     "Mira — ultra-dense data",
}
# Present recommendation with preset code link:
# "Based on extracted design DNA, recommended style: Luma"
# "Configure: https://ui.shadcn.com/create?preset=b2D0xPaDb"
```

**Skip condition:** If the user only needs raw tokens (not a shadcn project), skip this step.

## Anti-Patterns

- **NEVER** guess colors without analyzing the actual source — use precise extraction
- **NEVER** skip the oklch conversion — all colors must have oklch equivalents
- **NEVER** output flat token structures — use three-tier hierarchy (global/alias/component)

## Related Skills

- `ork:design-to-code` — Full pipeline that uses this as Stage 1
- `ork:design-system-tokens` — Token architecture and W3C spec compliance
- `ork:component-search` — Find components that match extracted patterns
