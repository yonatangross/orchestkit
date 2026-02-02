# Brainstorm: Visualization System for Intelligent Decision Capture

**Date:** 2026-01-28
**Linked Issue:** #245 (Multi-User Intelligent Decision Capture System)

## Problem Statement

Current visualization capabilities are insufficient:
- `visualize-mem0-graph.py` - Only mem0 cloud data, not local profiles
- `decision-history.mjs` - CLI-only, parses CHANGELOG, no user profiles
- No unified dashboard for profiles, decisions, skill/agent usage
- No timeline views for decision evolution
- No graph relationship visualization (CHOSE, CHOSE_OVER, CONSTRAINT)
- No standard export formats (JSON, CSV, HTML report)
- No team/aggregated views

## Data Sources (from Issue #245)

1. **User Profiles** (`.claude/memory/users/{user_id}/profile.json`)
   - skill_usage: Record<string, UsageStats>
   - agent_usage: Record<string, UsageStats>
   - tool_usage: Record<string, UsageStats>
   - decisions: RecordedDecision[]
   - preferences: RecordedPreference[]
   - workflow_patterns: WorkflowPattern[]

2. **Session Events** (`.claude/memory/sessions/{session_id}/events.jsonl`)
   - skill_invoked, agent_spawned, hook_triggered
   - decision_made, preference_stated
   - problem_reported, solution_found
   - tool_used

3. **Graph Queue** (`.claude/memory/graph-queue.jsonl`)
   - Entities: Decision, Preference, Problem, Solution, Technology, Pattern
   - Relations: CHOSE, CHOSE_OVER, MENTIONS, CONSTRAINT, TRADEOFF, RELATES_TO

4. **Cross-Project Profiles** (`~/.claude/orchestkit/users/{anonymous_id}/profile.json`)
   - Aggregated from all projects (Phase P0 of Issue #245)

## Synthesized Design: 3-Tier Visualization

### Tier 1: CLI Tools (Zero-Dependency)

**File:** `src/hooks/bin/ork-viz.mjs`

```bash
# User profile summary
ork-viz profile [--user USER_ID] [--format table|json]

# Decision history with timeline
ork-viz decisions [--days 30] [--category CATEGORY]

# Skill/agent usage heatmap (ASCII)
ork-viz usage [--type skills|agents|tools]

# Export to formats
ork-viz export --format json|csv|html [--output FILE]
```

### Tier 2: HTML Report Generator (Single-File)

**File:** `src/hooks/bin/generate-profile-report.mjs`

Generates a single self-contained HTML file with:
- Embedded CSS (Tailwind-like utility classes)
- Embedded JavaScript (Chart.js for charts)
- User profile summary card
- Skill/agent usage bar charts
- Decision timeline (vertical)
- Preference list with confidence bars
- Knowledge graph mini-visualization (D3.js force-directed)

```bash
generate-profile-report --user USER_ID --output profile-report.html
generate-profile-report --team TEAM_ID --output team-report.html
```

### Tier 3: Interactive Dashboard (Optional, Full App)

**File:** `src/skills/decision-capture-dashboard/` (new skill)

- React/Vite application
- TanStack Query for data fetching
- Recharts for visualizations
- Deployed as static site or served locally

Features:
- Real-time profile updates
- Cross-project aggregation view
- Team comparison dashboards
- Knowledge graph explorer (zoom, filter, search)
- Decision diff view (what changed over time)

## Export Formats

### JSON Export Schema

```json
{
  "version": "1.0.0",
  "exported_at": "2026-01-28T12:00:00Z",
  "user_id": "user@email.com",
  "anonymous_id": "anon-abc123",
  "profile": {
    "sessions_count": 42,
    "first_seen": "2026-01-01T00:00:00Z",
    "last_seen": "2026-01-28T12:00:00Z"
  },
  "skill_usage": [...],
  "agent_usage": [...],
  "decisions": [...],
  "preferences": [...],
  "knowledge_graph": {
    "entities": [...],
    "relations": [...]
  }
}
```

### CSV Export (Multiple Files)

- `profile-summary.csv` - One row per user
- `skill-usage.csv` - User, Skill, Count, SuccessRate, FirstUsed, LastUsed
- `agent-usage.csv` - User, Agent, Count, SuccessRate, FirstUsed, LastUsed
- `decisions.csv` - User, What, Rationale, Confidence, Timestamp, Project
- `preferences.csv` - User, Category, Preference, Confidence, ObservationCount

### HTML Report Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>OrchestKit Profile Report - {user}</title>
  <style>/* Embedded Tailwind-like CSS */</style>
</head>
<body>
  <header>
    <h1>Profile Report</h1>
    <div class="profile-card">
      <span class="user-name">{display_name}</span>
      <span class="sessions">{sessions_count} sessions</span>
      <span class="active-since">Active since {first_seen}</span>
    </div>
  </header>

  <main>
    <section id="usage">
      <h2>Usage Statistics</h2>
      <canvas id="skill-chart"></canvas>
      <canvas id="agent-chart"></canvas>
    </section>

    <section id="decisions">
      <h2>Decision Timeline</h2>
      <div class="timeline">...</div>
    </section>

    <section id="preferences">
      <h2>Learned Preferences</h2>
      <ul class="preference-list">...</ul>
    </section>

    <section id="graph">
      <h2>Knowledge Graph</h2>
      <svg id="force-graph"></svg>
    </section>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3"></script>
  <script>/* Embedded JS */</script>
</body>
</html>
```

## Knowledge Graph Visualization

### Entity Types (Colors)

| Type | Color | Description |
|------|-------|-------------|
| Decision | #3B82F6 (blue) | "Chose X over Y" |
| Preference | #10B981 (green) | User preferences |
| Technology | #F59E0B (orange) | Languages, frameworks |
| Pattern | #8B5CF6 (purple) | Design patterns |
| Problem | #EF4444 (red) | Issues encountered |
| Solution | #22C55E (green) | How problems were solved |

### Relation Types (Edge Styles)

| Relation | Style | Example |
|----------|-------|---------|
| CHOSE | solid, thick | "User CHOSE cursor-pagination" |
| CHOSE_OVER | dashed, red | "cursor-pagination CHOSE_OVER offset" |
| MENTIONS | dotted, gray | "Decision MENTIONS PostgreSQL" |
| CONSTRAINT | solid, orange | "Decision has CONSTRAINT 1M rows" |
| SOLVED_BY | solid, green | "Timeout SOLVED_BY connection-pooling" |
| TRADEOFF | dashed, purple | "Choice has TRADEOFF complexity" |

## Implementation Phases

### Phase V1: CLI Visualization (2 days)

- Create `ork-viz.mjs` CLI tool
- Implement `profile`, `decisions`, `usage` commands
- ASCII table output, JSON/CSV export
- Wire into hooks distribution

### Phase V2: HTML Report Generator (3 days)

- Create `generate-profile-report.mjs`
- Embed Chart.js for bar/line charts
- Embed D3.js for force-directed graph
- Single-file output (no external dependencies)
- Support user/team/global views

### Phase V3: Dashboard Skill (5 days)

- Create `decision-capture-dashboard` skill
- React + Vite + Recharts + TanStack Query
- Local server mode (`ork-viz dashboard serve`)
- Static export for sharing

### Phase V4: Integration (2 days)

- Add visualization links to session-end output
- Hook into memory sync for cloud graph visualization
- Add to `/ork:memory history` skill output

## Relation to Issue #245

This visualization system DEPENDS ON Issue #245:
- P0: Cross-project profiles → Enables global aggregation views
- P1: Hook integration → Provides events data to visualize
- P2: Graph queue processor → Populates knowledge graph entities
- P3: Profile injection → Shows context at session start

## File Structure

```
src/
├── hooks/
│   └── bin/
│       ├── ork-viz.mjs            # CLI visualization tool
│       └── generate-profile-report.mjs  # HTML report generator
├── skills/
│   └── decision-capture-dashboard/  # Full React dashboard (V3)
│       ├── SKILL.md
│       └── src/
│           ├── index.html
│           ├── main.tsx
│           └── components/
│               ├── ProfileCard.tsx
│               ├── UsageCharts.tsx
│               ├── DecisionTimeline.tsx
│               └── KnowledgeGraph.tsx
```

## Success Criteria

- [ ] `ork-viz profile` shows user summary in terminal
- [ ] `ork-viz export --format html` generates readable report
- [ ] HTML report loads without external network requests
- [ ] Knowledge graph shows CHOSE/CHOSE_OVER relations
- [ ] Timeline shows decisions chronologically
- [ ] CSV exports importable to Excel/Google Sheets
- [ ] Team view aggregates multiple user profiles
