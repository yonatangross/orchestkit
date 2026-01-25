# Mem0 Graph Visualization Guide

## Quick Start

Generate all graphs and open dashboard:

```bash
./skills/mem0-memory/scripts/visualization/quick-visualize.sh
```

Or use the Python script directly:

```bash
python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py
```

## What Gets Generated

The visualization system creates multiple graph views:

### 1. Full Graph
**File:** `outputs/mem0-full-graph.html`
- Shows all agents, skills, technologies, and categories
- Complete memory graph with all relationships
- Best for: Overview of entire memory structure

### 2. Shared Knowledge Graph
**File:** `outputs/mem0-shared-knowledge.html`
- Shows only shared knowledge (skills, tech, categories)
- Excludes agent-specific memories
- Best for: Understanding shared resources

### 3. Agent-Specific Graphs
**Files:** `outputs/mem0-agent-{agent-name}.html`
- One graph per agent showing their specific memories
- Filtered by `metadata.agent_name`
- Best for: Understanding individual agent knowledge

### 4. Category-Specific Graphs
**Files:** `outputs/mem0-category-{category}.html`
- Graphs filtered by category (backend-skills, frontend-skills, etc.)
- Best for: Understanding category relationships

### 5. Dashboard
**File:** `outputs/mem0-graph-dashboard.html`
- Interactive dashboard showing all graphs
- Tabs for filtering by type
- Best for: Exploring all visualizations in one place

## Command Options

### Generate All Graphs
```bash
python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py
```

### Specific Agents Only
```bash
python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py \
  --agents backend-system-architect frontend-ui-developer
```

### Specific Categories Only
```bash
python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py \
  --categories backend-skills frontend-skills
```

### Limit Memory Count
```bash
python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py \
  --limit 50
```

### Skip Certain Views
```bash
# Skip shared knowledge graphs
python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py \
  --skip-shared

# Skip agent-specific graphs
python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py \
  --skip-agents
```

### Different Formats
```bash
# Mermaid diagrams (text-based, version-controllable)
python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py \
  --format mermaid

# JSON data (for programmatic use)
python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py \
  --format json
```

## Individual Graph Generation

Generate a single graph with specific filters:

```bash
# Agent-specific
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py \
  --agent-filter "backend-system-architect" \
  --output backend-agent-graph.html

# Shared knowledge only
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py \
  --no-shared \
  --output shared-only-graph.html

# Full graph
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py \
  --show-shared \
  --output full-graph.html
```

## Graph Formats

### Plotly (Default)
- Interactive HTML visualizations
- Zoom, pan, hover for details
- Best for: Exploration and presentation

### Mermaid
- Text-based diagrams
- Version-controllable
- Best for: Documentation and Git

### JSON
- Raw graph data
- Programmatic access
- Best for: Custom processing

### NetworkX (PNG)
- Static image files
- Best for: Reports and presentations

## Viewing Graphs

### Open Dashboard
```bash
# macOS
open outputs/mem0-graph-dashboard.html

# Linux
xdg-open outputs/mem0-graph-dashboard.html

# Or just open in browser
```

### View Individual Graphs
All graphs are saved in `outputs/` directory:
- `mem0-full-graph.html` - Complete graph
- `mem0-shared-knowledge.html` - Shared knowledge
- `mem0-agent-{name}.html` - Agent-specific
- `mem0-category-{name}.html` - Category-specific

## Troubleshooting

### No Graphs Generated
- Check `MEM0_API_KEY` is set
- Verify mem0 connection: `python3 -c "from mem0 import MemoryClient; print('OK')"`
- Check user_id matches: should be `orchestkit:all-agents`

### Empty Graphs
- Verify memories exist: `python3 skills/mem0-memory/scripts/crud/search-memories.py --query "test"`
- Check filters aren't too restrictive
- Try without `--limit` to see all memories

### Slow Generation
- Use `--limit` to reduce memory count
- Use `--sample 0.5` for large graphs
- Skip unnecessary views with `--skip-shared` or `--skip-agents`

## Integration with CI/CD

Generate graphs in CI:

```yaml
# .github/workflows/generate-graphs.yml
- name: Generate Memory Graphs
  run: |
    export MEM0_API_KEY=${{ secrets.MEM0_API_KEY }}
    python3 skills/mem0-memory/scripts/visualization/generate-all-graphs.py \
      --format mermaid \
      --limit 100
    # Upload artifacts
    # Upload outputs/*.mmd
```

## Best Practices

1. **Regular Updates**: Regenerate graphs after adding new memories
2. **Version Control**: Commit Mermaid diagrams (text-based)
3. **Documentation**: Link graphs from README or docs
4. **Performance**: Use `--limit` for large memory sets
5. **Filtering**: Use agent/category filters for focused views

## Related Files

- `visualize-mem0-graph.py` - Core visualization script
- `generate-all-graphs.py` - Batch graph generator
- `quick-visualize.sh` - Quick start script
- `verify-architecture.py` - Architecture verification
