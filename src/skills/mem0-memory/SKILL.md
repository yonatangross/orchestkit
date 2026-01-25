---
name: mem0-memory
description: Long-term semantic memory across sessions using Mem0. Use when you need to remember, recall, or forget information across sessions, or when referencing what we discussed last time or in a previous session.
tags: [memory, mem0, persistence, context]
context: fork
version: 1.0.0
author: OrchestKit
user-invocable: false
allowedTools: [Bash, Read, mcp__mem0__add_memory, mcp__mem0__search_memories, mcp__mem0__get_memories, mcp__mem0__delete_memory]
---

# Mem0 Memory Management

Persist and retrieve semantic memories across Claude sessions.

## Memory Scopes

Organize memories by scope for efficient retrieval:


| Scope                | Purpose                           | Examples                                    |
| -------------------- | --------------------------------- | ------------------------------------------- |
| `project-decisions`  | Architecture and design decisions | "Use PostgreSQL with pgvector for RAG"      |
| `project-patterns`   | Code patterns and conventions     | "Components use kebab-case filenames"       |
| `project-continuity` | Session handoff context           | "Working on auth refactor, PR #123 pending" |

## Project Isolation

Memories are isolated by project name extracted from `CLAUDE_PROJECT_DIR`:

- Project name: `basename($CLAUDE_PROJECT_DIR)` (sanitized to lowercase, dashes)
- Format: `{project-name}-{scope}`

**Edge Case:** If two different repositories have the same directory name, they will share the same `user_id` scope. To avoid this:

1. Use unique directory names for each project
2. Or use `MEM0_ORG_ID` environment variable for additional namespace

**Example:**
- `/Users/alice/my-app` → `my-app-decisions` ✅
- `/Users/bob/my-app` → `my-app-decisions` ⚠️ (collision if same mem0.ai project)
- With `MEM0_ORG_ID=acme`: `/Users/alice/my-app` → `acme-my-app-decisions` ✅

## Memory Categories

Memories are automatically categorized based on content. Available categories:

| Category | Keywords | Use Case |
|----------|----------|----------|
| `pagination` | pagination, cursor, offset | API pagination patterns |
| `security` | security, vulnerability, OWASP | Security patterns and vulnerabilities |
| `authentication` | auth, JWT, OAuth, token | Authentication patterns |
| `testing` | test, pytest, jest, coverage | Testing strategies |
| `deployment` | deploy, CI/CD, Docker, Kubernetes | Deployment patterns |
| `observability` | monitoring, logging, tracing, metrics | Observability patterns |
| `performance` | performance, cache, optimize | Performance optimization |
| `ai-ml` | LLM, RAG, embedding, LangChain | AI/ML patterns |
| `data-pipeline` | ETL, streaming, batch processing | Data pipeline patterns |
| `database` | database, SQL, PostgreSQL, schema | Database patterns |
| `api` | API, endpoint, REST, GraphQL | API design patterns |
| `frontend` | React, component, UI, CSS | Frontend patterns |
| `architecture` | architecture, design, system | Architecture patterns |
| `pattern` | pattern, convention, style | General patterns |
| `blocker` | blocked, issue, bug | Blockers and issues |
| `constraint` | must, cannot, required | Constraints |
| `decision` | chose, decided, selected | Decisions (default) |

## Cross-Tool Memory

Memories include `source_tool` metadata to support cross-tool memory sharing:

- `source_tool: "orchestkit-claude"` - Memories from Claude Code
- `source_tool: "orchestkit-cursor"` - Memories from Cursor (future)

Query memories by tool:
```bash
# Query Claude Code memories
filters={"AND": [{"metadata.source_tool": "orchestkit-claude"}]}

# Query all memories (any tool)
filters={"AND": [{"user_id": "my-project-decisions"}]}
```

## Setup

**Install mem0 Python SDK:**

```bash
# Install the mem0ai package and dependencies
pip install mem0ai python-dotenv

# Or install from requirements file
pip install -r skills/mem0-memory/scripts/requirements.txt
```

**Optional - Install mem0-skill-lib package (recommended for development):**

```bash
# Install as editable package for proper type checking
pip install -e skills/mem0-memory/scripts/
```

**Note:** Scripts work in both modes:
- **Standalone mode** (default): Scripts dynamically add `lib/` to sys.path. Type checkers require `# type: ignore` comments for these dynamic imports.
- **Installed mode**: If `mem0-skill-lib` is installed, scripts import from the installed package without type ignore comments.

**Set environment variables:**

**Option 1: Using `.env` file (Recommended)**

Create a `.env` file in your project root:

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API key
MEM0_API_KEY=sk-your-api-key-here
MEM0_ORG_ID=org_...      # Optional (for organization-level scoping)
MEM0_PROJECT_ID=proj_... # Optional (Pro feature)
MEM0_WEBHOOK_URL=https://your-domain.com/webhook/mem0  # Optional
```

The scripts automatically load from `.env` if it exists.

**Option 2: Shell environment variables**

```bash
export MEM0_API_KEY="sk-..."
export MEM0_ORG_ID="org_..."      # Optional (for organization-level scoping)
export MEM0_PROJECT_ID="proj_..." # Optional (Pro feature)
```

**Verify installation:**

```bash
python3 -c "from mem0 import MemoryClient; print('✓ mem0ai installed successfully')"
```

## Core Operations

### Adding Memories

Execute the script via Bash tool:

```bash
!bash skills/mem0-memory/scripts/crud/add-memory.py \
  --text "Decided to use FastAPI over Flask for async support" \
  --user-id "project-decisions" \
  --metadata '{"scope":"project-decisions","category":"backend","date":"2026-01-12"}' \
  --enable-graph
```

**Best practices for adding:**

- Be specific and actionable
- Include rationale ("because...")
- Add scope and category metadata
- Timestamp important decisions

### Searching Memories

```bash
!bash skills/mem0-memory/scripts/crud/search-memories.py \
  --query "authentication approach" \
  --user-id "project-decisions" \
  --limit 5 \
  --enable-graph
```

**Search tips:**

- Use natural language queries
- Search by topic, not exact phrases
- Combine with scope filters when available
- Enable graph (`--enable-graph`) to get relationship information in results

**Graph Relationships in Search Results:**

When `--enable-graph` is enabled, search results include:
- `relations` array with relationship information
- `related_via` field showing how results are connected
- `relationship_summary` with relation types found

### Graph Relationship Queries

**Get Related Memories:**

Query memories related to a given memory via graph traversal:

```bash
!bash skills/mem0-memory/scripts/graph/get-related-memories.py \
  --memory-id "mem_abc123" \
  --depth 2 \
  --relation-type "recommends"
```

**Traverse Graph:**

Multi-hop graph traversal for complex relationship queries:

```bash
!bash skills/mem0-memory/scripts/graph/traverse-graph.py \
  --memory-id "mem_abc123" \
  --depth 2 \
  --relation-type "recommends"
```

**Example Use Cases:**

1. **Multi-hop queries:**
   ```
   "What did database-engineer recommend about pagination?"
   → Traverses: database-engineer → recommends → cursor-pagination
   → Returns related memories with relationship context
   ```

2. **Context expansion:**
   ```
   Find a memory about "authentication"
   → Get related memories via graph (depth 2)
   → Discover related decisions, patterns, and recommendations
   ```

3. **Relationship filtering:**
   ```
   --relation-type "recommends"  # Only follow "recommends" relationships
   --relation-type "uses"         # Only follow "uses" relationships
   ```

### Listing Memories

```bash
!bash skills/mem0-memory/scripts/crud/get-memories.py \
  --user-id "project-orchestkit" \
  --filters '{"limit":100}'
```

### Getting Single Memory

```bash
!bash skills/mem0-memory/scripts/crud/get-memory.py \
  --memory-id "mem_abc123"
```

### Updating Memories

```bash
!bash skills/mem0-memory/scripts/crud/update-memory.py \
  --memory-id "mem_abc123" \
  --text "Updated decision text" \
  --metadata '{"updated":true}'
```

### Deleting Memories

```bash
!bash skills/mem0-memory/scripts/crud/delete-memory.py \
  --memory-id "mem_abc123"
```

**When to delete:**

- Outdated decisions that were reversed
- Incorrect information
- Duplicate or redundant entries

## What to Remember

**Good candidates:**

- Architecture decisions with rationale
- API contracts and interfaces
- Naming conventions adopted
- Technical debt acknowledged
- Blockers and their resolutions
- User preferences and style

**Avoid storing:**

- Temporary debugging context
- Large code blocks (use Git)
- Secrets or credentials
- Highly volatile information

## Memory Patterns

### Decision Memory

```
"Decision: Use cursor-based pagination for all list endpoints.
Rationale: Better performance for large datasets, consistent UX.
Date: 2026-01-12. Scope: API design."
```

### Pattern Memory

```
"Pattern: All React components export default function.
Convention: Use named exports only for utilities.
Applies to: frontend/src/components/**"
```

### Continuity Memory

```
"Session handoff: Completed hybrid search implementation.
Next steps: Add metadata boosting, write integration tests.
PR #456 ready for review. Blocked on: DB migration approval."
```

## Advanced Operations (Pro Features)

### Batch Operations

**Batch update up to 1000 memories:**

```bash
!bash skills/mem0-memory/scripts/batch/batch-update.py \
  --memories '[{"memory_id":"mem_123","text":"updated"},{"memory_id":"mem_456","metadata":{"updated":true}}]'
```

**Batch delete:**

```bash
!bash skills/mem0-memory/scripts/batch/batch-delete.py \
  --memory-ids '["mem_123","mem_456","mem_789"]'
```

### Memory History (Audit Trail)

```bash
!bash skills/mem0-memory/scripts/utils/memory-history.py \
  --memory-id "mem_abc123"
```

### Exports (Data Portability)

**Create export:**

```bash
!bash skills/mem0-memory/scripts/export/export-memories.py \
  --filters '{"user_id":"project-decisions"}' \
  --schema '{"format":"json"}'
```

**Retrieve export:**

```bash
!bash skills/mem0-memory/scripts/export/get-export.py \
  --user-id "project-decisions"
```

### Analytics

**Get memory statistics:**

```bash
!bash skills/mem0-memory/scripts/utils/memory-summary.py \
  --filters '{"user_id":"project-decisions"}'
```

**List all users:**

```bash
!bash skills/mem0-memory/scripts/utils/get-users.py
```

### Webhooks (Automation)

```bash
!bash skills/mem0-memory/scripts/webhooks/create-webhook.py \
  --url "https://example.com/webhook" \
  --name "Memory Webhook" \
  --event-types '["memory.created","memory.updated"]'
```

## Integration with OrchestKit

Use memories to maintain context across plugin sessions:

```bash
# At session start - recall project context
!bash skills/mem0-memory/scripts/crud/search-memories.py \
  --query "current sprint priorities" \
  --user-id "project-continuity"

# During work - persist decisions
!bash skills/mem0-memory/scripts/crud/add-memory.py \
  --text "Implemented feature using approach because reason" \
  --user-id "project-decisions" \
  --metadata '{"scope":"project-decisions"}'

# At session end - save continuity
!bash skills/mem0-memory/scripts/crud/add-memory.py \
  --text "Session end: summary. Next: next_steps" \
  --user-id "project-continuity" \
  --metadata '{"scope":"project-continuity"}'
```

## Scripts Available

All scripts are located in `skills/mem0-memory/scripts/`:

**Core Scripts:**

- `add-memory.py` - Store new memory
- `search-memories.py` - Semantic search
- `get-memories.py` - List all memories (with filters)
- `get-memory.py` - Get single memory by ID
- `update-memory.py` - Update memory content/metadata
- `delete-memory.py` - Remove memory

**Advanced Scripts (Pro Features):**

- `batch-update.py` - Bulk update up to 1000 memories
- `batch-delete.py` - Bulk delete multiple memories
- `memory-history.py` - Get audit trail for a memory
- `export-memories.py` - Create structured export
- `get-export.py` - Retrieve export data
- `memory-summary.py` - Get statistics/analytics
- `get-events.py` - Track async operations
- `get-users.py` - List all users (analytics)
- `create-webhook.py` - Setup webhooks for automation

**Note:** MCP integration is deprecated. Use scripts instead for better control, versioning, and access to all 30+ API methods.

## Related Skills

- `semantic-caching` - Semantic caching patterns that complement long-term memory
- `embeddings` - Embedding strategies used by Mem0 for semantic search
- `langgraph-checkpoints` - State persistence patterns for workflow continuity
- `context-compression` - Compress context when memory retrieval adds too many tokens

## Key Decisions


| Decision        | Choice                                                  | Rationale                                        |
| --------------- | ------------------------------------------------------- | ------------------------------------------------ |
| Memory scope    | project-decisions, project-patterns, project-continuity | Clear separation of memory types                 |
| Storage format  | Natural language with metadata                          | Semantic search works best with descriptive text |
| MCP integration | Mem0 MCP server                                         | Native Claude Desktop integration                |
| What to avoid   | Secrets, large code blocks, volatile info               | Keep memories clean and safe                     |


## Capability Details

### memory-add

**Keywords:** add memory, remember, store, persist, save context
**Solves:**

- How do I save information for later sessions?
- Persist a decision or pattern
- Store project context across sessions

### memory-search

**Keywords:** search memory, recall, find, retrieve, what did we
**Solves:**

- How do I find previous decisions?
- Recall context from past sessions
- Search for specific patterns or conventions

### memory-list

**Keywords:** list memories, show all, get memories, view stored
**Solves:**

- How do I see all stored memories?
- List project decisions
- Review stored patterns

### memory-delete

**Keywords:** delete memory, forget, remove, clear
**Solves:**

- How do I remove outdated memories?
- Delete incorrect information
- Clean up duplicate entries

