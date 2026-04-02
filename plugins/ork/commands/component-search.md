---
description: "Search 21st.dev component registry for production-ready React components. Finds components by natural language description, filters by framework and style system, returns ranked results with install instructions. Use when looking for UI components, finding alternatives to existing components, or sourcing design system building blocks."
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/component-search/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Component Search

Search 21st.dev's registry of production-ready React components. Returns ranked results with code, previews, and install instructions.

```bash
/ork:component-search animated pricing table
/ork:component-search sidebar with collapsible sections
/ork:component-search dark mode toggle switch
```

## How It Works

```
Query: "animated pricing table with monthly/annual toggle"
  │
  ▼
┌──────────────────────────────┐
│ 21st.dev Magic MCP           │  Search 1.4M+ developer registry
│ @21st-dev/magic              │  Filter: React, Tailwind, shadcn
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Results (ranked by relevance)│
│                              │
│ 1. PricingToggle (98% match) │  ★ 2.3K views · shadcn/ui
│ 2. PricingCards (87% match)  │  ★ 1.8K views · Radix
│ 3. AnimatedPricing (82%)     │  ★ 950 views · Motion
└──────────────────────────────┘
```

## Step 0: Parse Query

```python
QUERY = ""  # Component description

TaskCreate(subject="Component search: {QUERY}", description="Search 21st.dev registry")

# Detect project context for framework filtering
Glob("**/package.json")
# Read to determine: React version, Tailwind, shadcn/ui, styling approach

# Detect shadcn/ui style for result ranking
Glob("**/components.json")
# Read → "style" field (e.g., "radix-luma", "base-nova")
# Used to prefer components matching the project's visual language
```

## Step 1: Search Registry

**If 21st-dev-magic MCP is available:**
```python
# Use MCP tools to search the 21st.dev component registry
# Pass the natural language query
# The MCP handles semantic search and ranking
```

**If 21st-dev-magic is NOT available (fallback):**
```python
# Fallback to web search
WebSearch("site:21st.dev {QUERY} React component")
# Or browse the registry
WebFetch("https://21st.dev", "Search for: {QUERY}")
```

## Step 2: Present Results

Show top 3 matches with:
- Component name and description
- Match relevance score
- Popularity (views/bookmarks)
- Framework compatibility
- Preview (if available)
- Install command

```python
AskUserQuestion(questions=[{
  "question": "Which component to use?",
  "header": "Component",
  "options": [
    {"label": "{name_1} (Recommended)", "description": "{desc_1} — {views_1} views"},
    {"label": "{name_2}", "description": "{desc_2} — {views_2} views"},
    {"label": "{name_3}", "description": "{desc_3} — {views_3} views"},
    {"label": "None — generate from scratch", "description": "Build a custom component instead"}
  ],
  "multiSelect": false
}])
```

## Step 3: Deliver Component

For the selected component:
1. Show the full source code
2. List dependencies (`npm install` commands)
3. Note any required peer dependencies (Radix, Motion, etc.)
4. Highlight customization points (props, tokens, slots)

## Framework Compatibility

| Project Stack | Search Filter | Notes |
|--------------|---------------|-------|
| React + Tailwind | Default — best coverage | Most 21st.dev components |
| React + CSS Modules | Filter non-Tailwind | Fewer results |
| Next.js App Router | Prefer RSC-compatible | Check "use client" directives |
| Vue / Svelte | Not supported | 21st.dev is React-only |
| shadcn/ui style | Match visual language | Luma→rounded/pill, Nova→compact, Lyra→sharp |

**shadcn v4 style awareness:** When `components.json` has a style (e.g., `"radix-luma"`), prefer components whose visual language matches — rounded pill shapes for Luma, dense layouts for Nova/Mira, sharp edges for Lyra. Components can be adapted post-install, but a closer match reduces customization work.

## Related Skills

- `ork:design-to-code` — Full mockup-to-component pipeline (uses this skill)
- `ork:design-system-tokens` — Adapt components to project tokens
- `ork:ui-components` — Component library patterns
