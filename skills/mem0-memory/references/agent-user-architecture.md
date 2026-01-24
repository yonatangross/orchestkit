# Agent-as-User Architecture for Mem0

## Overview

Each OrchestKit agent should be a separate `user_id` in mem0, creating isolated memory spaces per agent. This enables:

1. **Agent-specific knowledge graphs** - Each agent's memories form their own graph
2. **Better querying** - "What does backend-system-architect know?" queries a specific user_id
3. **Isolated learning** - Agents don't pollute each other's memory space
4. **Clearer visualization** - Agent-specific graphs show what each agent knows

## Current Architecture

```
All memories → user_id: "orchestkit-plugin-structure"
├── Agent memories (backend-system-architect, frontend-ui-developer, etc.)
├── Skill memories
├── Technology memories
└── Category memories
```

**Problem:** All agents share the same memory space, making it hard to:
- Query agent-specific knowledge
- Visualize per-agent graphs
- Isolate agent learning

## Proposed Architecture

```
Each agent → Separate user_id
├── user_id: "agent:backend-system-architect"
│   ├── Agent metadata memory
│   ├── Skills this agent uses
│   ├── Decisions this agent made
│   └── Patterns this agent learned
│
├── user_id: "agent:frontend-ui-developer"
│   ├── Agent metadata memory
│   ├── Skills this agent uses
│   └── Frontend-specific decisions
│
└── Shared memories → user_id: "orchestkit:shared"
    ├── Skill definitions (shared across agents)
    ├── Technology definitions
    └── Category definitions
```

## Implementation Plan

### 1. Update Memory Creation Scripts

**File:** `skills/mem0-memory/scripts/create/create-all-agent-memories.py`

```python
# OLD
USER_ID = "orchestkit-plugin-structure"

# NEW
def get_agent_user_id(agent_name: str) -> str:
    """Generate user_id for agent-specific memories."""
    return f"agent:{agent_name}"

def get_shared_user_id() -> str:
    """Generate user_id for shared memories (skills, tech, categories)."""
    return "orchestkit:shared"
```

### 2. Update Hook for Agent Context

**File:** `hooks/src/skill/decision-processor.ts`

```bash
# Detect if we're in an agent context
if [[ -n "${CLAUDE_AGENT_ID:-}" ]]; then
    # Use agent-specific user_id
    AGENT_USER_ID="agent:${CLAUDE_AGENT_ID}"
    DECISIONS_USER_ID=$(mem0_user_id "$AGENT_USER_ID")
else
    # Fallback to project scope
    DECISIONS_USER_ID=$(mem0_user_id "$MEM0_SCOPE_DECISIONS")
fi
```

### 3. Update Visualization Scripts

**File:** `skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py`

```python
def export_multi_agent_graph(agent_names: List[str] = None) -> Dict[str, Any]:
    """Export graph data for multiple agents."""
    if agent_names is None:
        # Get all agents from mem0
        agent_names = get_all_agent_user_ids()
    
    all_nodes = []
    all_edges = []
    
    for agent_name in agent_names:
        user_id = f"agent:{agent_name}"
        graph_data = export_graph_data(user_id)
        all_nodes.extend(graph_data['nodes'])
        all_edges.extend(graph_data['edges'])
    
    return {
        "nodes": all_nodes,
        "edges": all_edges
    }
```

### 4. User ID Naming Convention

```
agent:{agent-name}          # Agent-specific memories
orchestkit:shared          # Shared definitions (skills, tech, categories)
orchestkit:decisions       # Global decisions (if needed)
```

## Migration Strategy

### Phase 1: Dual-Write (Backward Compatible)

1. Keep writing to `orchestkit-plugin-structure` for existing memories
2. Start writing new agent memories to `agent:{agent-name}`
3. Update visualization to read from both

### Phase 2: Migration Script

```python
# Migrate existing memories to agent-specific user_ids
def migrate_agent_memories():
    # Read all memories from old user_id
    old_memories = client.search(
        query="agent specialized",
        filters={"user_id": "orchestkit-plugin-structure", "metadata.entity_type": "Agent"}
    )
    
    for memory in old_memories['results']:
        agent_name = memory['metadata'].get('agent_name') or memory['metadata'].get('name')
        if agent_name:
            new_user_id = f"agent:{agent_name}"
            # Create new memory with agent user_id
            client.add(
                messages=[{"role": "user", "content": memory['memory']}],
                user_id=new_user_id,
                metadata=memory['metadata'],
                enable_graph=True
            )
```

### Phase 3: Cleanup

1. Archive old `orchestkit-plugin-structure` memories
2. Update all scripts to use new user_id pattern
3. Update documentation

## Benefits

### 1. Agent-Specific Queries

```python
# Query what backend-system-architect knows
memories = client.search(
    query="authentication patterns",
    filters={"user_id": "agent:backend-system-architect"}
)
```

### 2. Agent-Specific Visualizations

```bash
# Visualize backend-system-architect's knowledge graph
python visualize-mem0-graph.py --user-id "agent:backend-system-architect"
```

### 3. Cross-Agent Analysis

```python
# Compare what different agents know
backend_memories = get_agent_memories("backend-system-architect")
frontend_memories = get_agent_memories("frontend-ui-developer")

# Find shared knowledge
shared_skills = set(backend_memories['skills']) & set(frontend_memories['skills'])
```

### 4. Better Graph Structure

Each agent's graph shows:
- Which skills they use
- What decisions they've made
- What patterns they've learned
- Their specific knowledge domain

## Example: Backend System Architect Graph

```
user_id: "agent:backend-system-architect"
├── Node: backend-system-architect (Agent, Blue)
│   ├── Edge: uses → auth-patterns (Skill, Green)
│   ├── Edge: uses → api-versioning (Skill, Green)
│   ├── Edge: uses → streaming-api-patterns (Skill, Green)
│   └── Edge: belongs_to → Backend Skills (Category, Purple)
│
└── Node: Decision: "Use cursor pagination" (Architecture, Red)
    └── Edge: implements → api-versioning
```

## Implementation Checklist

- [ ] Update `create-all-agent-memories.py` to use `agent:{name}` user_id
- [ ] Update `decision-processor.ts` hook to detect agent context
- [ ] Update visualization scripts to support multi-agent graphs
- [ ] Create migration script for existing memories
- [ ] Update documentation with new user_id patterns
- [ ] Test agent-specific queries and visualizations
- [ ] Update CI/CD workflows if needed

## Related Files

- `skills/mem0-memory/scripts/create/create-all-agent-memories.py`
- `hooks/src/skill/decision-processor.ts`
- `skills/mem0-memory/scripts/visualization/visualize-mem0-graph.py`
- `skills/mem0-memory/SKILL.md`
