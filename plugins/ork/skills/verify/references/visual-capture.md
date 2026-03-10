# Visual Capture — Phase 2.5

Visual verification that produces browsable screenshot evidence with AI evaluation.

## Architecture

```
Phase 2 agents (parallel)
         |
    Phase 2.5 (runs IN PARALLEL with Phase 2 agents)
         |
         v
┌─────────────────────────────────────────────────┐
│  1. Detect project type (package.json scan)      │
│  2. Start dev server (framework-aware)           │
│  3. Wait for server ready (poll localhost)        │
│  4. Discover routes (framework-aware)            │
│  5. agent-browser: navigate + screenshot each    │
│  6. Claude vision: evaluate each screenshot      │
│  7. Generate gallery.html (self-contained)       │
│  8. Stop dev server                              │
└─────────────────────────────────────────────────┘
```

## Step 1: Project Type Detection

Scan codebase to determine framework and dev server command:

```python
# PARALLEL — detect framework signals
Grep(pattern="\"next\":", glob="package.json", output_mode="content")
Grep(pattern="\"vite\":", glob="package.json", output_mode="content")
Grep(pattern="\"react-scripts\":", glob="package.json", output_mode="content")
Grep(pattern="\"vue\":", glob="package.json", output_mode="content")
Grep(pattern="\"nuxt\":", glob="package.json", output_mode="content")
Grep(pattern="\"@angular/core\":", glob="package.json", output_mode="content")
Glob(pattern="**/manage.py")
Glob(pattern="**/main.py")
Glob(pattern="**/app.py")
Glob(pattern="**/index.html")
```

### Detection Matrix

| Signal | Framework | Start Command | Default Port |
|--------|-----------|---------------|-------------|
| `"next":` in package.json | Next.js | `npm run dev` | 3000 |
| `"vite":` in package.json | Vite | `npm run dev` | 5173 |
| `"react-scripts":` | CRA | `npm start` | 3000 |
| `"vue":` + no vite | Vue CLI | `npm run serve` | 8080 |
| `"nuxt":` | Nuxt | `npm run dev` | 3000 |
| `"@angular/core":` | Angular | `npx ng serve` | 4200 |
| `manage.py` exists | Django | `python manage.py runserver` | 8000 |
| `main.py`/`app.py` + FastAPI | FastAPI | `uvicorn app:app` | 8000 |
| `index.html` only | Static | `npx serve .` | 3000 |
| None of the above | **Skip visual capture** | N/A | N/A |

### Override via Config

If `.claude/verification-config.yaml` exists with a `visual` section, use those settings instead of auto-detection.

## Step 2: Start Dev Server

```python
Bash(
  command=f"{start_command} &",
  description="Start dev server for visual capture",
  run_in_background=True
)
```

Wait for server readiness:
```python
Bash(command=f"for i in $(seq 1 30); do curl -s http://localhost:{port} > /dev/null && exit 0; sleep 1; done; exit 1",
     description="Wait for dev server to be ready (max 30s)")
```

**If server fails to start**: Skip visual capture with a warning in the report. Do NOT block verification.

## Step 3: Route Discovery

### Next.js App Router
```python
Glob(pattern="**/app/**/page.{tsx,jsx,ts,js}")
# Extract route from file path: app/dashboard/page.tsx → /dashboard
```

### Next.js Pages Router
```python
Glob(pattern="**/pages/**/*.{tsx,jsx,ts,js}")
# Exclude _app, _document, _error, api/
# Extract route: pages/about.tsx → /about
```

### React Router
```python
Grep(pattern="<Route.*path=[\"']([^\"']+)", glob="**/*.{tsx,jsx}", output_mode="content")
```

### FastAPI / Express
```python
Grep(pattern="@(app|router)\\.(get|post)\\([\"'](/[^\"']*)", glob="**/*.py", output_mode="content")
Grep(pattern="(app|router)\\.(get|post)\\([\"'](/[^\"']*)", glob="**/*.{ts,js}", output_mode="content")
```

### Fallback
If no routes discovered, screenshot just the root URL: `http://localhost:{port}/`

### Max Routes
Cap at **20 routes** to keep gallery manageable and generation fast. Prioritize:
1. Root `/`
2. Routes matching changed files (from Phase 1 git diff)
3. Routes with most sub-routes (likely important sections)

## Step 4: Screenshot Capture

Use `agent-browser` to navigate and screenshot each route:

```python
# For each route:
# 1. Navigate
agent-browser navigate http://localhost:{port}{route_path}
# 2. Wait for content
agent-browser wait-for-network-idle
# 3. Capture
agent-browser screenshot --full-page --path verification-output/{timestamp}/screenshots/{idx}-{slug}.png
```

### Auth-Protected Routes

If `verification-config.yaml` specifies auth:

```python
# Login first
agent-browser navigate http://localhost:{port}/login
agent-browser fill "#email" "test@example.com"
agent-browser fill "#password" "test123"
agent-browser click "button[type=submit]"
agent-browser wait-for-navigation
# Then screenshot protected routes
```

### Viewport Options

Default: `1280x720`. If `mobile: true` in config, also capture at `375x812`.

## Step 5: AI Vision Evaluation

For each screenshot, use Claude's vision (Read tool on PNG) with a **structured evaluation prompt**:

```python
Read(file_path=f"verification-output/{timestamp}/screenshots/{filename}")
```

Then evaluate using this prompt template (include it in the visual capture agent's instructions):

```
Evaluate this screenshot of route "{route_path}" against these 6 criteria.
For EACH criterion, provide a severity (ok/warning/error) and specific observation.
Do NOT use generic "looks good" — cite what you actually see.

1. LAYOUT: Overflow, alignment, spacing, responsive grid. Check: content cut off? Overlapping elements? Scroll needed?
2. NAVIGATION: Is nav present and functional? Sidebar, breadcrumbs, TOC visible? Active state correct?
3. CONTENT: Text readable? Headings hierarchical? Data populated (not placeholder/loading)? Counts/numbers accurate?
4. ACCESSIBILITY: Contrast sufficient? Focus indicators visible? Text size adequate? Color-only information?
5. INTERACTIVITY: Buttons/links styled consistently? Hover/focus states? Forms labeled? CTAs discoverable?
6. BRANDING: Consistent with site theme? Dark/light mode correct? Typography matches design system?

Output as JSON array — exactly 6 items, one per criterion:
[{"severity": "ok|warning|error", "message": "CRITERION: specific observation with evidence"}]
Score 0-10 based on: 0 errors=9+, 1-2 warnings=7-8, errors=5-6, multiple errors=<5.
```

**Per-route evaluation output** (6+ items, never a single line):
```json
{
  "route": "/dashboard",
  "score": 7.5,
  "evaluation": [
    {"severity": "ok", "message": "LAYOUT: Content within viewport, no horizontal overflow, grid columns align properly"},
    {"severity": "ok", "message": "NAVIGATION: Sidebar present with 8 sections, 'Dashboard' correctly highlighted as active"},
    {"severity": "warning", "message": "CONTENT: Stats show '79 skills' but should be '89 skills' — stale count detected"},
    {"severity": "ok", "message": "ACCESSIBILITY: Body text ~16px on dark bg (#e6edf3 on #0d1117), contrast ratio ~13:1, passes WCAG AAA"},
    {"severity": "warning", "message": "INTERACTIVITY: Code block copy buttons present but no visible hover state change"},
    {"severity": "ok", "message": "BRANDING: Dark theme consistent, green accent (#3fb950) used for active states, monospace for code"}
  ]
}
```

### Cross-Route Summary

After evaluating all routes, synthesize a **summary** object for the gallery:

```python
# Build summary from all per-route evaluations
summary = {
  "total_routes": len(routes),
  "avg_score": round(sum(r.score for r in routes) / len(routes), 1),
  "pass_count": len([r for r in routes if r.score >= 7]),
  "warn_count": len([r for r in routes if 5 <= r.score < 7]),
  "fail_count": len([r for r in routes if r.score < 5]),
  "common_issues": [  # Issues appearing on 2+ routes
    {"count": 3, "message": "Stale skill count (79 instead of 89) on 3/5 pages"},
    {"count": 2, "message": "Code block copy buttons lack hover state feedback"}
  ],
  "strengths": [  # Positive patterns across routes
    "Consistent dark theme and typography across all pages",
    "Sidebar navigation present and correctly highlights active page"
  ]
}
```

Include this summary in `GALLERY_JSON` alongside `routes`.

## Step 6: Gallery Generation

Read the gallery template:
```python
Read(file_path="${CLAUDE_SKILL_DIR}/assets/gallery-template.html")
```

Build the `GALLERY_JSON` data structure:
```json
{
  "branch": "feat/new-feature",
  "date": "2026-03-10",
  "timestamp": "2026-03-10T14:30:00Z",
  "compositeScore": 8.2,
  "visualScore": 7.8,
  "routes": [
    {
      "id": "homepage",
      "name": "Homepage",
      "path": "/",
      "screenshot": "data:image/png;base64,...",
      "score": 8.5,
      "evaluation": [
        {"severity": "ok", "message": "Layout consistent"},
        {"severity": "warning", "message": "Hero image loading slowly"}
      ],
      "annotations": [],
      "apiResponse": null
    }
  ]
}
```

**Base64 encoding**: Convert each PNG to base64 for self-contained HTML:
```bash
base64 -i screenshots/01-homepage.png
```

**Size guard**: If total HTML > 10MB, use `maxDiffPixelRatio` compression or reduce to top 10 routes.

Write the final gallery:
```python
Write(file_path=f"verification-output/{timestamp}/gallery.html", content=rendered_html)
```

## Step 7: Cleanup

```python
# Kill dev server
Bash(command="kill $(lsof -ti :PORT) 2>/dev/null || true", description="Stop dev server")
```

## Phase 8.5: Agentation Loop (Opt-In)

**Trigger**: Only when agentation MCP is configured in `.mcp.json`.

```python
# Check if agentation is available
ToolSearch(query="select:mcp__agentation__agentation_get_all_pending")
```

If available, offer the user:
```python
AskUserQuestion(questions=[{
  "question": "Agentation is configured. Want to annotate the UI before finalizing?",
  "header": "Visual Feedback Loop",
  "options": [
    {"label": "Yes, let me annotate", "description": "I'll mark issues on the live UI, then ui-feedback agent fixes them"},
    {"label": "Skip", "description": "Finalize gallery with current screenshots"}
  ]
}])
```

If yes:
```python
# 1. Watch for annotations
mcp__agentation__agentation_get_all_pending()

# 2. For each annotation:
mcp__agentation__agentation_acknowledge(annotationId=id)

# 3. Dispatch ui-feedback agent
Agent(subagent_type="ork:ui-feedback",
  prompt="Process agentation annotation: {annotation}. Fix the issue, then resolve.",
  run_in_background=True)

# 4. After fixes, re-screenshot affected routes
# 5. Save before/after pairs
# 6. Update gallery with annotation diffs
```

### Max Rounds
Default 3 rounds of annotate-fix-verify. Configurable in `verification-config.yaml`.

## Graceful Degradation

| Failure | Behavior |
|---------|----------|
| No frontend detected | Skip visual capture, log info in report |
| Dev server won't start | Skip visual capture with warning |
| agent-browser unavailable | Skip screenshots, try `curl` for API-only |
| Screenshot fails on a route | Skip that route, continue with others |
| Base64 output too large | Compress or reduce route count |
| Agentation not configured | Skip Layer 2 entirely (no prompt) |
| Auth flow fails | Skip protected routes, screenshot public only |
