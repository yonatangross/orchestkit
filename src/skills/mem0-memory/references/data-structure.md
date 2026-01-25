# Mem0 Data Structure Reference

Complete reference for entity types, categories, relationships, metadata schema, and example queries for OrchestKit plugin structure in Mem0.

## Entity Types

### Agent
- **Description**: Specialized AI agent personas (34 total)
- **Color**: Blue (#3B82F6)
- **Category**: `agents`
- **Metadata Fields**:
  - `entity_type: "Agent"`
  - `color_group: "agent"`
  - `category: "agents"`
  - `name: <agent-name>`
  - `agent_name: <agent-id>`
  - `skills: [<skill-list>]`
  - `model: <sonnet|opus|haiku>` (optional)
  - `description: <agent-description>` (optional)

**Examples**: `backend-system-architect`, `frontend-ui-developer`, `database-engineer`, `llm-integrator`

### Skill
- **Description**: Reusable knowledge modules (161 total)
- **Color**: Green (#10B981)
- **Category**: `backend-skills`, `frontend-skills`, `ai-llm-skills`, etc.
- **Metadata Fields**:
  - `entity_type: "Skill"`
  - `color_group: "skill"`
  - `category: <category-slug>`
  - `name: <skill-name>`
  - `skill_name: <skill-id>`
  - `implements: <technology>` (optional)
  - `tags: [<tag-list>]` (optional)
  - `description: <skill-description>` (optional)

**Examples**: `fastapi-advanced`, `react-server-components-framework`, `langgraph-state`, `rag-retrieval`

### Technology
- **Description**: Core technologies and frameworks (24+ total)
- **Color**: Orange (#F59E0B)
- **Category**: `technologies`
- **Metadata Fields**:
  - `entity_type: "Technology"`
  - `color_group: "technology"`
  - `category: "technologies"`
  - `name: <technology-name>`
  - `version: <version>` (optional)
  - `tech_category: <Backend Framework|Frontend Framework|Language|etc.>` (optional)

**Examples**: `FastAPI`, `React 19`, `LangGraph`, `PostgreSQL`, `TypeScript`, `Python`

### Category
- **Description**: Skill/entity categories (18 total)
- **Color**: Purple (#8B5CF6)
- **Category**: `<category-slug>` (self-referential)
- **Metadata Fields**:
  - `entity_type: "Category"`
  - `color_group: "category"`
  - `category: <category-slug>`
  - `name: <Category Name>`
  - `category_slug: <category-slug>`

**Examples**: `agents`, `backend-skills`, `frontend-skills`, `ai-llm-skills`

### Architecture
- **Description**: Architecture decisions and plugin root
- **Color**: Red (#EF4444)
- **Category**: `architecture-decisions`
- **Metadata Fields**:
  - `entity_type: "Architecture"`
  - `color_group: "architecture"`
  - `category: "architecture-decisions"`
  - `name: <decision-name>`
  - `version: <version>` (for plugin root)

**Examples**: `OrchestKit Plugin`, `Graph-First Memory Architecture`, `Progressive Loading Protocol`

## Categories

### Skill Categories
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

### Entity Categories
- `agents` - All 35 agents
- `technologies` - All technologies
- `architecture-decisions` - Architecture decisions
- `relationships` - Relationship memories

## Relationship Types

### Primary Relationships
- `uses` - Agent uses skill, Technology uses language
- `implements` - Skill implements technology
- `extends` - Technology extends another technology
- `belongs_to` - Entity belongs to category
- `recommends` - Agent/skill recommends pattern

### Secondary Relationships
- `shares_skill` - Agents share common skills
- `collaborates_with` - Agents work together
- `contains` - Category contains entities
- `depends_on` - Technology depends on another

## Metadata Schema

### Common Fields (All Entities)
```json
{
  "type": "<agent|skill|technology|category|architecture|relationship>",
  "entity_type": "<Agent|Skill|Technology|Category|Architecture>",
  "color_group": "<agent|skill|technology|category|architecture>",
  "category": "<category-slug>",
  "plugin_component": true,
  "name": "<entity-name>"
}
```

### Agent-Specific Fields
```json
{
  "agent_name": "<agent-id>",
  "skills": ["<skill-1>", "<skill-2>", ...],
  "model": "<sonnet|opus|haiku>",
  "description": "<agent-description>"
}
```

### Skill-Specific Fields
```json
{
  "skill_name": "<skill-id>",
  "implements": "<technology-name>",
  "technology": "<technology-name>",
  "tags": ["<tag-1>", "<tag-2>", ...],
  "description": "<skill-description>"
}
```

### Technology-Specific Fields
```json
{
  "version": "<version>",
  "tech_category": "<Backend Framework|Frontend Framework|Language|...>"
}
```

### Relationship-Specific Fields
```json
{
  "from": "<source-entity>",
  "to": "<target-entity>",
  "relation": "<uses|implements|extends|belongs_to|...>",
  "hop": <1|2|3|4>,
  "chain": "<agent→skill→technology→language>" (for multi-hop)
}
```

## Example Queries

### Search by Entity Type
```python
result = client.search(
    query="agent specialized AI persona",
    filters={
        "user_id": "orchestkit:all-agents",
        "metadata.entity_type": "Agent"
    },
    enable_graph=True
)
```

### Search by Category
```python
result = client.search(
    query="backend development patterns",
    filters={
        "user_id": "orchestkit:all-agents",
        "metadata.category": "backend-skills"
    },
    enable_graph=True
)
```

### Find Skills for Technology
```python
result = client.search(
    query="skill implements FastAPI",
    filters={
        "user_id": "orchestkit:all-agents",
        "metadata.implements": "FastAPI"
    },
    enable_graph=True
)
```

### Find Agents Using Skill
```python
result = client.search(
    query="agent uses fastapi-advanced",
    filters={
        "user_id": "orchestkit:all-agents",
        "metadata.skill": "fastapi-advanced"
    },
    enable_graph=True
)
```

## Relationship Traversal Examples

### 1-Hop: Agent → Skills
```bash
# Get agent memory
AGENT_ID=$(python3 skills/mem0-memory/scripts/crud/search-memories.py \
  --query "backend-system-architect" \
  --user-id "orchestkit:all-agents" \
  --limit 1 | jq -r '.results[0].id')

# Get related skills (1 hop)
python3 skills/mem0-memory/scripts/graph/get-related-memories.py \
  --memory-id "$AGENT_ID" \
  --depth 1 \
  --relation-type "uses"
```

### 2-Hop: Agent → Skill → Technology
```bash
# Traverse 2 hops
python3 skills/mem0-memory/scripts/graph/get-related-memories.py \
  --memory-id "$AGENT_ID" \
  --depth 2
```

### 3-Hop: Full Stack Chain
```bash
# Get complete technology stack
python3 skills/mem0-memory/scripts/graph/traverse-graph.py \
  --memory-id "$AGENT_ID" \
  --depth 3
```

## Data Creation Workflow

### 1. Create Entity Memories
- Categories → Technologies → Agents → Skills
- Each with proper `entity_type`, `color_group`, `category`

### 2. Create Relationship Memories
- Agent → Skill (uses)
- Skill → Technology (implements)
- Technology → Technology (extends/uses)
- Entity → Category (belongs_to)

### 3. Create Multi-Hop Chains
- Explicit 4-hop chains for key workflows
- Enables deep relationship traversal

### 4. Wait for Processing
- Mem0 processes relationships asynchronously
- Wait 2-5 minutes after creation
- Relationships appear in search with `--enable-graph`

## Validation

### Check Metadata Completeness
```python
# All memories should have:
required_fields = ["entity_type", "color_group", "category", "plugin_component", "name"]
```

### Verify Entity Types
```python
valid_entity_types = ["Agent", "Skill", "Technology", "Category", "Architecture"]
```

### Validate Category Slugs
```python
valid_categories = [
    "agents", "backend-skills", "frontend-skills", "ai-llm-skills",
    "testing-skills", "security-skills", "devops-skills", "git-github-skills",
    "workflow-skills", "quality-skills", "context-skills", "event-driven-skills",
    "database-skills", "accessibility-skills", "mcp-skills",
    "technologies", "architecture-decisions", "relationships"
]
```

## Best Practices

### Creating New Memories
1. Always include `entity_type`, `color_group`, `category`, `plugin_component: true`
2. Use descriptive `name` field
3. Include relationship metadata (`from`, `to`, `relation`) for relationships
4. Enable graph: `enable_graph=True`

### Querying
1. Always use `enable_graph=True` for relationship queries
2. Filter by `user_id: "orchestkit:all-agents"` to scope to plugin
3. Use metadata filters for precise queries
4. Wait 2-5 minutes after creating memories before querying relationships

### Visualization
1. Update metadata before generating visualization
2. Use `--limit` for large graphs to avoid performance issues
3. Export to JSON first, then visualize filtered subset
4. Use Plotly for interactive exploration, NetworkX for static images
