# Mem0 Graph Visualization Reference

Complete guide to Mem0 graph visualization for OrchestKit plugin structure, including setup, usage, best practices, and troubleshooting.

## Overview

This system provides colorized graph visualization of the OrchestKit plugin structure stored in Mem0. Since Mem0 does not natively support multi-color node visualization, we use external tools (Plotly, NetworkX) to create custom visualizations.

## Research Findings (January 2026)

**Mem0 does NOT natively support multi-color node visualization in its built-in UI.** However, Mem0's Graph Memory API provides all necessary data (entity types, metadata, relationships) to build custom multi-color visualizations using external tools.

### What Mem0 Provides
- Entity extraction with types (person, organization, project, etc.)
- Relationship extraction with relation types
- Metadata storage (arbitrary key/value pairs)
- Graph-aware search (`search()` and `get_all()` with `enable_graph=True`)
- Custom prompts for entity extraction
- Filtering and thresholds

### What Mem0 Does NOT Provide
- Built-in multi-color node visualization
- Custom styling based on entity types
- Color mapping in the native UI
- Edge styling based on relation types

## Best Practices (2026)

### Color Palette Design
1. **Limit Palette Size**: Use ≤ 7-10 distinct categories for categorical coloring
2. **Color Discriminability**: Large color differences are crucial when links connect nodes
3. **Neutral Edges**: Use neutral or gray links to avoid visual interference with node colors
4. **Accessibility**: Use colorblind-safe palettes (ColorBrewer, OKLab-based)
5. **Edge Styling**: Edge color should typically recede (gray or light)

### Implementation Approach
1. Retrieve data from Mem0 with `enable_graph=True`
2. Map entity types to colors using metadata
3. Use external visualization tools (Plotly, D3.js, NetworkX, etc.)

## System Architecture

### Custom Categories

18 custom project-level categories defined in Mem0:
- `agents` - All 34 specialized AI agent personas
- `backend-skills` - Backend development patterns
- `frontend-skills` - Frontend development patterns
- `ai-llm-skills` - AI and LLM patterns
- `testing-skills` - Testing patterns
- `security-skills` - Security patterns
- `devops-skills` - DevOps patterns
- `git-github-skills` - Git/GitHub operations
- `workflow-skills` - Workflow patterns
- `quality-skills` - Quality gates and reviews
- `context-skills` - Context management
- `event-driven-skills` - Event-driven architecture
- `database-skills` - Database patterns
- `accessibility-skills` - Accessibility patterns
- `mcp-skills` - MCP patterns
- `technologies` - Core technologies
- `architecture-decisions` - Architecture decisions
- `relationships` - Entity relationships

**Setup**:
```bash
python3 skills/mem0-memory/scripts/setup/setup-categories.py
```

### Enhanced Metadata Structure

All memories include:
- `entity_type`: "Agent", "Skill", "Technology", "Category", "Architecture"
- `color_group`: "agent", "skill", "technology", "category", "architecture"
- `category`: Category slug (e.g., "backend-skills", "agents")
- `plugin_component`: true (flag for plugin structure memories)
- `name`: Entity name
- Additional fields: `skills`, `implements`, `extends`, etc.

### Color Scheme

Following 2026 best practices:
- **Agents** (Blue #3B82F6): All 34 specialized AI agent personas
- **Skills** (Green #10B981): All 161 skills
- **Technologies** (Orange #F59E0B): Core technologies
- **Categories** (Purple #8B5CF6): Skill categories
- **Architecture** (Red #EF4444): Architecture decisions
- **Unknown** (Gray #9CA3AF): Unclassified entities

### Edge Styling

Different relation types get different edge styles:
- `uses`: Solid line, width 2
- `implements`: Dashed line, width 2
- `extends`: Dotted line, width 1.5
- `recommends`: Solid line, width 3
- `belongs_to`: Solid line, width 1

## Quick Start

### Complete Setup (One-Time)

```bash
# Run master setup script
skills/mem0-memory/scripts/setup/setup-complete-visualization.sh
```

This will:
1. Check and install dependencies
2. Set up custom categories
3. Update existing memories
4. Create comprehensive memories (categories, technologies, agents, skills)
5. Create relationships
6. Generate initial visualization

### Manual Setup

```bash
# 1. Install visualization dependencies
skills/mem0-memory/scripts/visualization/setup-visualization-deps.sh

# 2. Set up custom categories
python3 skills/mem0-memory/scripts/setup/setup-categories.py

# 3. Update existing memories
python3 skills/mem0-memory/scripts/validation/update-memories-metadata.py

# 4. Create comprehensive memories
python3 skills/mem0-memory/scripts/create/create-category-memories.py
python3 skills/mem0-memory/scripts/create/create-technology-memories.py
python3 skills/mem0-memory/scripts/create/create-all-agent-memories.py
python3 skills/mem0-memory/scripts/create/create-all-skill-memories.py

# 5. Create relationships
python3 skills/mem0-memory/scripts/create/create-deep-relationships.py

# 6. Generate visualization
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py --format plotly
```

## Visualization Tool

### Location
`skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py`

### Usage

```bash
# Interactive Plotly HTML (recommended)
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py \
  --user-id "orchestkit:all-agents" \
  --format plotly \
  --output mem0-graph.html

# Static NetworkX image
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py \
  --format networkx \
  --output mem0-graph.png

# JSON export (for custom visualizations)
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py \
  --format json \
  --output mem0-graph.json

# Mermaid diagram (text-based, version-controllable)
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py \
  --format mermaid \
  --output mem0-graph.mmd

# GraphML export (for Cytoscape, Gephi)
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py \
  --format graphml \
  --output mem0-graph.graphml

# CSV export (nodes.csv, edges.csv)
python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py \
  --format csv \
  --output mem0-graph.csv
```

### Output Location
All exports go to `outputs/` directory in project root.

### Interactive Features (Plotly)
- Click legend items to filter by entity type
- Hover over nodes for details
- Mouse wheel to zoom
- Pan to navigate
- Search box (basic implementation)

## Relationship Structure

### 1-Hop Relationships (Direct)
- **Agent → Skill** (uses): `backend-system-architect` → uses → `fastapi-advanced`
- **Skill → Technology** (implements): `fastapi-advanced` → implements → `FastAPI`
- **Technology → Technology** (extends/uses): `pgvector` → extends → `PostgreSQL`

### 2-Hop Relationships
- **Agent → Skill → Technology**: `backend-system-architect` → uses → `fastapi-advanced` → implements → `FastAPI`

### 3-Hop Relationships
- **Agent → Skill → Technology → Technology**: `database-engineer` → uses → `pgvector-search` → implements → `pgvector` → extends → `PostgreSQL`

### 4-Hop Chains (Multi-Hop)
Complete technology stack chains connecting agents through skills to technologies and dependencies.

## Querying Relationships

### Search with Graph Enabled
```bash
python3 skills/mem0-memory/scripts/crud/search-memories.py \
  --query "backend-system-architect uses fastapi-advanced" \
  --user-id "orchestkit:all-agents" \
  --enable-graph
```

### Get Related Memories (Multi-Hop Traversal)
```bash
# Get memory ID first
MEMORY_ID=$(python3 skills/mem0-memory/scripts/crud/search-memories.py \
  --query "backend-system-architect" \
  --user-id "orchestkit:all-agents" \
  --limit 1 | jq -r '.results[0].id')

# Traverse relationships
python3 skills/mem0-memory/scripts/graph/get-related-memories.py \
  --memory-id "$MEMORY_ID" \
  --depth 3 \
  --user-id "orchestkit:all-agents"
```

## Scripts Reference

All scripts are located in `skills/mem0-memory/scripts/`:

### Setup Scripts
- `setup-visualization-deps.sh` - Install plotly, networkx, matplotlib, kaleido
- `setup-categories.py` - Define custom Mem0 categories
- `setup-complete-visualization.sh` - Master setup script (runs all steps)

### Memory Creation Scripts
- `create-category-memories.py` - Create memories for all 18 categories
- `create-technology-memories.py` - Create memories for 24+ technologies
- `create-all-agent-memories.py` - Create memories for all 34 agents
- `create-all-skill-memories.py` - Create memories for all 161 skills
- `create-deep-relationships.py` - Create comprehensive relationships

### Maintenance Scripts
- `update-memories-metadata.py` - Update existing memories with enhanced metadata
- `refresh-visualization.sh` - Update memories, regenerate visualization, export all formats
- `verify-visualization-setup.sh` - Check dependencies, Mem0 connection, test exports

### Visualization Scripts
- `visualize-mem0-graph.py` - Main visualization tool (supports multiple formats)

## Troubleshooting

### Categories Still Show "technology" / "professional_details"

1. **Check if categories were set**:
   ```bash
   python3 skills/mem0-memory/scripts/setup/setup-categories.py
   ```

2. **Update existing memories** to trigger re-categorization:
   ```bash
   python3 skills/mem0-memory/scripts/validation/update-memories-metadata.py
   ```

3. **Wait 2-5 minutes** for Mem0 to process and re-categorize

### Visualization Shows "Unknown" Entity Types

1. **Update existing memories** with enhanced metadata:
   ```bash
   python3 skills/mem0-memory/scripts/validation/update-memories-metadata.py
   ```

2. **Wait for Mem0 processing** (2-5 minutes)

3. **Regenerate visualization**:
   ```bash
   python3 skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py --format plotly
   ```

### No Relationships in Visualization

1. **Check if graph is enabled** when creating memories (use `--enable-graph`)
2. **Wait for Mem0 processing** - relationships are extracted asynchronously (2-5 minutes)
3. **Verify relationships exist**:
   ```bash
   python3 skills/mem0-memory/scripts/crud/search-memories.py \
     --query "backend-system-architect" \
     --user-id "orchestkit:all-agents" \
     --enable-graph
   ```

### Dependencies Not Installing

1. **Try virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install plotly networkx matplotlib kaleido
   ```

2. **Or use --user flag**:
   ```bash
   pip3 install --user plotly networkx matplotlib kaleido
   ```

### Mem0 API Errors

1. **Check API key** is set in environment or config
2. **Verify rate limits** - batch processing may be needed for large datasets
3. **Check Mem0 plan** - custom categories may require Pro/Enterprise plan

## Performance Tips

### For Large Graphs
- Use `--limit` parameter to sample nodes
- Export to JSON first, then filter before visualization
- Use NetworkX for static images (faster than Plotly for large graphs)
- Consider pagination for graphs with 1000+ nodes

### Optimization
- Cache graph data locally between exports
- Use batch processing for memory creation
- Wait between API calls to respect rate limits

## Maintenance

### Regular Refresh
```bash
# Update memories and regenerate visualization
skills/mem0-memory/scripts/visualization/refresh-visualization.sh
```

### Adding New Entities
1. Create entity memory with proper metadata (`entity_type`, `color_group`, `category`)
2. Create relationship memories linking to existing entities
3. Wait 2-5 minutes for Mem0 processing
4. Regenerate visualization

## References

- [Mem0 Graph Memory Overview](https://docs.mem0.ai/open-source/graph_memory/overview)
- [Node-Link Diagram Color Discriminability Research](https://www.sciencedirect.com/science/article/pii/S2468502X25000713)
- [Memgraph Lab Styling Guide](https://memgraph.com/blog/how-to-style-your-graphs-in-memgraph-lab)
- [Mem0 API Reference](https://docs.mem0.ai/api-reference/memory/add-memories)

## Files Location

All scripts: `skills/mem0-memory/scripts/`
All documentation: `skills/mem0-memory/references/`
All outputs: `outputs/` (project root)
