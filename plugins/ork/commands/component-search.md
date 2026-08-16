---
description: "Search 21st.dev component registry for production-ready React components. Finds components by natural language description, filters by framework and style system, returns ranked results with install instructions. Use when looking for UI components, finding alternatives to existing components, or sourcing design system building blocks."
argument-hint: "[component description]"
model: sonnet
effort: low
context: fork
user-invocable: true
name: component-search
background: false
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
│ 21st.dev Magic MCP           │  Search the 21st.dev developer registry
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

# 1. Create main task IMMEDIATELY
TaskCreate(subject="Component search: {QUERY}", description="Search 21st.dev registry", activeForm="Searching for {QUERY}")

# 2. Create subtasks for each phase
TaskCreate(subject="Parse query and detect project context", activeForm="Detecting project context")  # id=2
TaskCreate(subject="Search component registry", activeForm="Searching registry")                      # id=3
TaskCreate(subject="Present and deliver results", activeForm="Presenting results")                    # id=4

# 3. Set dependencies for sequential phases
TaskUpdate(taskId="3", addBlockedBy=["2"])  # Search needs project context first
TaskUpdate(taskId="4", addBlockedBy=["3"])  # Results need search done

# 4. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done — repeat for each subtask

# Detect project context for framework filtering
Glob("**/package.json")
# Read to determine: React version, Tailwind, shadcn/ui, styling approach

# Detect shadcn/ui style for result ranking
Glob("**/components.json")
# Read → "style" field (e.g., "radix-luma", "base-nova")
# Used to prefer components matching the project's visual language
```

## Step 1: Search Registry

### The metering split — read this before calling anything

Verified against a live free-tier account (2026-08-16, `get_usage`):

| Tool | Cost |
|---|---|
| `search`, `search_picker`, `search_logo`, `get_theme`, all list/metadata | **free, unmetered** |
| `get_component` (the actual code) | **metered — 2 / DAY on free tier** |

Search returns name, description, preview image, video, author, and the
`installCommand` **for free**. Only fetching a component's source is metered.
So a full exploration costs nothing, and the entire budget is the final pick.

**If 21st-dev-magic MCP is available (the real path):**

```python
# 1. BROWSE — free. Prefer search_picker: same params and results as search,
#    but renders an inline picker so the USER chooses. Never burn a retrieval
#    to find out what something looks like; the preview is already free.
mcp__21st-dev-magic__search_picker(query="{QUERY}", type="component", limit=8)

# 2. PICK — the user selects. Stop here and wait. Do not guess on their behalf.

# 3. RETRIEVE — metered. Exactly ONE call, for the ONE chosen component.
mcp__21st-dev-magic__get_component(id=<demo id from the chosen result>)
```

Rules that follow from the split:

- **Never call `get_component` speculatively, in a loop, or "to compare".**
  Two careless calls exhaust the day.
- If the user only needs to know *whether* something exists, or wants the
  install command, **stop after step 1** — that answer is already free.
- Call `get_usage` first when a session may already have spent retrievals; it
  reports `freeRetrievalsRemaining`.
- `search` returns `installCommand` containing `?api_key=$API_KEY_21ST`. That
  is a **different env var** from the MCP's `TWENTY_FIRST_API_KEY`; if
  `npx shadcn add` fails auth, that variable is missing from the environment.

**If 21st-dev-magic is NOT available (fallback):**
```python
# Genuine fallback ONLY — scraping returns no ids, no install commands, and
# no structured metadata. If the MCP is configured, you should never be here.
WebSearch("site:21st.dev {QUERY} React component")
# Or browse the registry
WebFetch("https://21st.dev", "Search for: {QUERY}")
```

**Alternative generation path — v0.app MCP (2026):**
When the registry doesn't have a matching component, fall back to AI
generation via the v0.app MCP server rather than WebFetch scraping:

```python
# If @vercel/v0-mcp is available
# v0.app generates from the same query and can pin to shadcn style
# (e.g., luma / nova / lyra) via `shadcn apply` after download.
```

This is a **generation** path, not a registry search — results will not
have view counts or stars. Prefer registry search when possible so you
get battle-tested components; use v0.app only when the registry misses.

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
