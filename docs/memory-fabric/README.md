# Memory Fabric

**Persistent, cross-session memory orchestration for Claude Code.**

Graph-first architecture that gives AI agents long-term memory across sessions, projects, and teams -- without cold starts.

| Component | Count |
|-----------|-------|
| Core Skills | 5 (`memory-fabric`, `recall`, `remember`, `mem0-memory`, `mem0-sync`) |
| TypeScript Hooks | 14+ across all lifecycle events |
| Python Scripts | 39 for mem0 cloud operations |
| Entity Types | 6 (`Agent`, `Technology`, `Pattern`, `Decision`, `Project`, `AntiPattern`) |
| Relation Types | 9 (`USES`, `RECOMMENDS`, `REQUIRES`, `ENABLES`, `PREFERS`, `CHOSE_OVER`, `USED_FOR`, `DEPENDS_ON`, `BLOCKED_BY`) |
| Memory Categories | 17 with priority-based auto-detection |

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [How It Works](#how-it-works)
- [The Retrieval Pipeline](#the-retrieval-pipeline)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Manual Commands](#manual-commands)
- [Data Flow](#data-flow)
- [Hook Integration](#hook-integration)
- [Advanced Topics](#advanced-topics)
- [Memory Fabric vs Traditional Approaches](#memory-fabric-vs-traditional-approaches)

---

## Architecture Overview

Memory Fabric uses a **Graph-First Architecture (v2.1)** where the Local Knowledge Graph is the PRIMARY storage layer. It is free, requires zero configuration, and works offline. Mem0 Cloud is an OPTIONAL enhancement that adds semantic vector search when configured.

```
                    +----------------------------------+
                    |         Hook Engine (automatic)   |
                    |  SessionStart / PostToolUse /     |
                    |  Stop / SubagentStart-Stop        |
                    +-----+----------+----------+------+
                          |          |          |
              +-----------v----------v----------v-------+
              |          Memory Fabric Layer             |
                   |                                   |
                   |  +------------+  +-------------+  |
                   |  |   Query    |  |   Query     |  |
                   |  |   Parser   |  |   Executor  |  |
                   |  +-----+------+  +------+------+  |
                   |        |                |         |
                   |        v                v         |
                   |  +-------------------------------+|
                   |  |    Parallel Query Dispatch     ||
                   |  +--------+----------------+-----+|
                   |           |                |      |
              |  +--------v------+  +------v---------+ |
              |  |  mcp__memory  |  | Python SDK     | |
              |  |  (Local Graph)|  | (Mem0 Cloud)   | |
              |  |   PRIMARY     |  | OPTIONAL       | |
              |  +--------+------+  +------+---------+ |
                   |           |                |      |
                   |  +--------v----------------v----+ |
                   |  |     Result Normalizer        | |
                   |  +-------------+----------------+ |
                   |                |                   |
                   |  +-------------v----------------+ |
                   |  |  Deduplication (Jaccard >85%) | |
                   |  +-------------+----------------+ |
                   |                |                   |
                   |  +-------------v----------------+ |
                   |  |  Cross-Reference Booster     | |
                   |  +-------------+----------------+ |
                   |                |                   |
                   |  +-------------v----------------+ |
                   |  |  Score & Rank                | |
                   |  |  (recency + relevance +      | |
                   |  |   authority)                  | |
                   |  +-------------+----------------+ |
                   |                |                   |
                   +----------------+-------------------+
                                    |
                                    v
                          Formatted Output
                   [GRAPH] [MEM0] [CROSS-REF] tags
```

### The Two Storage Tiers

| Tier | Technology | Access Method | Cost | Setup |
|------|-----------|--------------|------|-------|
| **Primary** | Local Knowledge Graph | MCP tools (`mcp__memory__*`) via `@anthropic/memory-mcp-server` | Free | Zero-config |
| **Optional** | Mem0 Cloud | Python SDK scripts (`mem0.MemoryClient`) via skill scripts | Requires API key | `MEM0_API_KEY` env var |

The graph is always authoritative. When both tiers are active, the memory bridge performs one-way sync from Mem0 to Graph (never the reverse), ensuring the graph remains the source of truth.

**Why Python SDK instead of MCP?** The Mem0 Python SDK provides direct access to 30+ API methods including graph traversal, batch operations, export, and visualization -- capabilities not exposed through MCP. The skills invoke these scripts via Bash for full control and versioning.

---

## How It Works

Memory Fabric operates across three integrated layers.

### Layer 1: Local Knowledge Graph (PRIMARY)

The knowledge graph stores structured entities and their relationships using MCP tools provided by `@anthropic/memory-mcp-server`.

**MCP Tools:**

| Tool | Purpose |
|------|---------|
| `mcp__memory__create_entities` | Create typed entities with observations |
| `mcp__memory__create_relations` | Define relationships between entities |
| `mcp__memory__add_observations` | Append observations to existing entities |
| `mcp__memory__search_nodes` | Search entities by name, type, or observation text |
| `mcp__memory__open_nodes` | Retrieve specific entities by name |

**Entity Types:**

| Type | Description | Examples |
|------|-------------|---------|
| `Agent` | OrchestKit agent personas | `database-engineer`, `backend-system-architect` |
| `Technology` | Tools, frameworks, databases | `PostgreSQL`, `pgvector`, `FastAPI` |
| `Pattern` | Design and code patterns | `cursor-pagination`, `connection-pooling` |
| `Decision` | Architectural choices | `chose-postgres-over-mongo` |
| `Project` | Project-level context | Current project name |
| `AntiPattern` | Failed patterns to avoid | `offset-pagination-at-scale` |

**Relation Types:**

| Relation | Meaning | Example |
|----------|---------|---------|
| `USES` | X uses Y | `backend-system-architect USES FastAPI` |
| `RECOMMENDS` | X recommends Y | `database-engineer RECOMMENDS pgvector` |
| `REQUIRES` | X requires Y | `pgvector REQUIRES PostgreSQL` |
| `ENABLES` | X enables Y | `pgvector ENABLES RAG` |
| `PREFERS` | X prefers Y | `team PREFERS cursor-pagination` |
| `CHOSE_OVER` | X was chosen over Y | `PostgreSQL CHOSE_OVER MongoDB` |
| `USED_FOR` | X is used for Y | `pgvector USED_FOR vector-search` |
| `DEPENDS_ON` | X depends on Y | `search-api DEPENDS_ON pgvector` |
| `BLOCKED_BY` | X is blocked by Y | `deployment BLOCKED_BY migration-approval` |

### Layer 2: Mem0 Cloud (OPTIONAL)

When `MEM0_API_KEY` is configured, Mem0 adds semantic vector search with embedding-based retrieval. This enables fuzzy matching and natural language queries that go beyond exact entity names.

**Access method:** Python SDK scripts (`from mem0 import MemoryClient`) invoked via Bash from the `mem0-memory` skill. Not an MCP server -- the SDK provides direct access to 30+ API methods.

**Capabilities when active:**

- Semantic vector search with embedding-based retrieval
- Graph-enabled search via the `--enable-graph` flag
- Multi-hop traversal with DFS and cycle detection
- Project-scoped isolation using structured user IDs:
  - `{project-name}-decisions` for architectural decisions
  - `{project-name}-patterns` for code patterns
  - `{project-name}-continuity` for session handoffs
- Cross-project sharing via `global:best-practices` scope

**39 Python scripts** in `src/skills/mem0-memory/scripts/` handle all mem0 operations:

| Category | Scripts | Examples |
|----------|---------|---------|
| CRUD | `add-memory.py`, `search-memories.py`, `get-memories.py`, `delete-memory.py` | Core read/write |
| Graph | `traverse-graph.py`, `get-related-memories.py` | Multi-hop queries |
| Batch | `batch-update.py`, `batch-delete.py` | Bulk operations |
| Export | `export-memories.py` | Data portability |
| Visualization | `visualize-mem0-graph.py` | Graph rendering |

### Layer 3: Hook Engine (The Core)

The hook engine is what makes Memory Fabric **fully automatic**. Unlike systems that rely on manual commands, Memory Fabric's 152 TypeScript hooks fire across all Claude Code lifecycle events -- extracting patterns, syncing storage, and loading context without any user intervention. The hooks are the primary interface; manual commands exist as an escape hatch, not the main workflow.

**Memory-related hooks include:**

- `pretool/mcp/memory-fabric-init` -- Initializes fabric on first memory tool use (runs once)
- `pretool/mcp/memory-validator` -- Validates graph operations before execution
- `prompt/memory-context` -- Injects relevant memory context into prompts
- `posttool/unified-dispatcher` -- Runs pattern extraction, memory bridge, and analytics in parallel
- `stop/auto-remember-continuity` -- Auto-saves session context at session end
- `stop/mem0-pre-compaction-sync` -- Syncs decisions to cloud before context compaction
- `lifecycle/session-context-loader` -- Loads decisions, blockers, and entities at session start
- `lifecycle/pattern-sync-push` -- Pushes learned patterns at session end
- `subagent-start/agent-memory-inject` -- Injects agent-specific memories into subagents
- `setup/mem0-backup-setup`, `setup/mem0-cleanup`, `setup/mem0-analytics-dashboard` -- Infrastructure hooks

---

## The Retrieval Pipeline

When memory is accessed -- whether automatically by hooks at session start, by the `prompt/memory-context` hook during a session, or manually via `/recall` -- the retrieval pipeline follows six steps.

### Step 1: Parse Query

Extract search intent and entity hints from natural language.

```
Input: "What pagination approach did database-engineer recommend?"

Parsed:
  query: "pagination approach recommend"
  entity_hints: ["database-engineer", "pagination"]
  intent: "decision" or "pattern"
```

### Step 2: Parallel Search

Both storage tiers are queried simultaneously to minimize latency.

```
Graph:  mcp__memory__search_nodes({ query: "pagination database-engineer" })
Mem0:   python3 skills/mem0-memory/scripts/crud/search-memories.py \
          --query "pagination approach" --enable-graph
        (only if MEM0_API_KEY configured; auto-invoked by hooks or manual via --mem0 flag)
```

### Step 3: Normalize Results

Transform both sources to a common format:

```json
{
  "id": "source:original_id",
  "text": "content text",
  "source": "mem0 | graph",
  "timestamp": "ISO8601 | null",
  "relevance": 0.0-1.0,
  "entities": ["entity1", "entity2"],
  "metadata": {}
}
```

Graph entities use `1.0` relevance for exact matches and `0.8` for partial matches. Mem0 scores are normalized from their 0-100 scale to 0.0-1.0.

### Step 4: Deduplicate

When two results exceed 85% text similarity (Jaccard coefficient), they are merged:

```python
def similarity(text_a, text_b):
    tokens_a = normalize(text_a)  # lowercase, remove punctuation, tokenize
    tokens_b = normalize(text_b)
    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    return intersection / union if union > 0 else 0

if similarity(result_a.text, result_b.text) > 0.85:
    merged = merge_results(result_a, result_b)
```

**Merge strategy:**
1. Keep text from the higher-relevance result
2. Combine entity lists from both
3. Preserve metadata from both with `source_*` prefix
4. Set `cross_validated: true`

### Step 5: Cross-Reference Boost

When a Mem0 result mentions an entity that also exists in the graph, relevance is boosted by 1.2x and the graph relationships are attached to the result metadata.

```python
for mem0_result in mem0_results:
    for entity in graph_entities:
        if entity.name.lower() in mem0_result.text.lower():
            mem0_result.relevance *= 1.2  # MEMORY_FABRIC_BOOST_FACTOR
            mem0_result.graph_relations = entity.relations
            mem0_result.cross_referenced = True
```

### Step 6: Score and Rank

The final ranking formula combines three weighted factors:

```
score = (recency x 0.3) + (relevance x 0.5) + (authority x 0.2)
```

| Factor | Weight | Calculation |
|--------|--------|-------------|
| **Recency** | 0.3 | Linear decay over 30 days with 0.1 floor: `max(0.1, 1.0 - (age_days / 30))` |
| **Relevance** | 0.5 | Semantic match quality from the search engine (0.0-1.0) |
| **Authority** | 0.2 | Source credibility weighting (see below) |

**Authority weights:**

| Source | Weight | Rationale |
|--------|--------|-----------|
| Cross-validated (in both graph and Mem0) | 1.3x | Validated across systems, highest confidence |
| Graph-native | 1.1x | Structured, explicit relationships |
| Mem0-only | 1.0x | Baseline semantic match |

### Context-Aware Result Limits

Result counts adjust automatically based on context window pressure:

| Context Usage | Default Limit | Behavior |
|---------------|---------------|----------|
| 0-70% | 10 results | Full results with details |
| 70-85% | 5 results | Reduced, summarized results |
| >85% | 3 results | Minimal results with "more available" hint |

---

## Quick Start

### Minimal Setup (Graph Only -- Free)

Add the knowledge graph MCP server to your Claude Code configuration:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@anthropic/memory-mcp-server"]
    }
  }
}
```

That is it. No API keys, no cloud accounts, no configuration files. The graph is available immediately.

### What Happens Automatically

Once installed, hooks handle everything:

- **Session start:** `session-context-loader` reads the compaction manifest from your last session, loads previous decisions, blockers, and entities into context
- **Every prompt:** `prompt/memory-context` detects keywords like "implement", "create", "pattern" and injects relevant memories
- **Every tool use:** `posttool/unified-dispatcher` extracts patterns from git commits, PR merges, test results, and build output in the background
- **Subagent spawn:** `agent-memory-inject` loads agent-specific decision history into each subagent
- **Session end:** `auto-remember-continuity` stores session summary, `context-compressor` writes a compaction manifest for the next session, `mem0-pre-compaction-sync` syncs pending items to cloud

**You don't run commands. The hooks do the work.**

### Manual Commands (Escape Hatch)

For explicit storage or retrieval outside the automatic flow:

```
/remember Chose PostgreSQL over MongoDB for ACID requirements and team familiarity
/recall database decision
/remember --success Cursor-based pagination scales well for large datasets
/remember --failed Offset pagination caused timeouts on tables with 1M+ rows
```

### Enable Cloud Enhancement (Optional)

To add semantic vector search via Mem0's Python SDK:

1. Get an API key from [mem0.ai](https://mem0.ai)
2. Install the SDK:

```bash
pip install mem0ai python-dotenv
```

3. Set the environment variable:

```bash
export MEM0_API_KEY="sk-..."
```

That is all. The hooks and skills automatically detect `MEM0_API_KEY` and activate cloud features. No MCP server needed for Mem0 -- the skills invoke Python SDK scripts directly via Bash.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MEM0_API_KEY` | No | -- | Enables Mem0 cloud features |
| `MEM0_ORG_ID` | No | -- | Organization namespace for multi-tenant isolation |
| `MEM0_PROJECT_ID` | No | -- | Mem0 Pro project scoping |
| `MEMORY_FABRIC_DEDUP_THRESHOLD` | No | `0.85` | Jaccard similarity threshold for merging duplicate results |
| `MEMORY_FABRIC_BOOST_FACTOR` | No | `1.2` | Cross-reference relevance multiplier |
| `MEMORY_FABRIC_MAX_RESULTS` | No | `20` | Maximum results returned per source |
| `MEM0_BACKUP_SCHEDULE` | No | `weekly` | Backup frequency (requires `MEM0_API_KEY`) |
| `MEM0_BACKUP_RETENTION` | No | `30` | Backup retention in days |
| `MEM0_MAX_BACKUPS` | No | `5` | Maximum backup count before rotation |

### MCP Server Configuration

**Required -- Knowledge Graph:**

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@anthropic/memory-mcp-server"]
    }
  }
}
```

**Mem0 Cloud** does not require an MCP server. It is accessed via Python SDK scripts (`mem0.MemoryClient`) invoked by skills through Bash. Set `MEM0_API_KEY` as an environment variable and install `pip install mem0ai` -- the hooks and skills auto-detect it.

### Project Isolation

Memories are scoped by project name derived from `CLAUDE_PROJECT_DIR`:

- Project name: `basename($CLAUDE_PROJECT_DIR)`, sanitized to lowercase with dashes
- User ID format: `{project-name}-{scope}`

**Example scopes:**
- `/Users/alice/my-app` produces `my-app-decisions`, `my-app-patterns`, `my-app-continuity`
- Cross-project: `orchestkit-global-best-practices`

**Collision warning:** Two repositories with the same directory name will share scopes. Use `MEM0_ORG_ID` for additional namespace isolation.

---

## Manual Commands

Most memory operations are automatic via hooks. These commands provide manual control when needed.

### /remember -- Store Decisions and Patterns

```
/remember <text>
/remember --category <category> <text>
/remember --success <text>               # Mark as successful pattern
/remember --failed <text>                # Mark as anti-pattern
/remember --mem0 <text>                  # Write to BOTH graph AND Mem0 cloud
/remember --agent <agent-id> <text>      # Store in agent-specific scope
/remember --global <text>                # Store as cross-project best practice
```

**Examples:**

```
/remember Chose cursor-based pagination for all list endpoints due to scalability

/remember --success --category database database-engineer uses pgvector for RAG applications

/remember --failed Offset pagination caused timeouts on tables with 1M+ rows

/remember --mem0 --global --success Always validate user input at API boundaries

/remember --agent backend-system-architect Use connection pooling with min=5, max=20
```

**Category auto-detection** uses keyword matching when no `--category` flag is provided:

| Keywords | Auto-detected Category |
|----------|----------------------|
| chose, decided, selected | `decision` |
| architecture, design, system | `architecture` |
| pattern, convention, style | `pattern` |
| blocked, issue, bug, workaround | `blocker` |
| must, cannot, required, constraint | `constraint` |
| pagination, cursor, offset, page | `pagination` |
| database, sql, postgres, query | `database` |
| auth, jwt, oauth, token, session | `authentication` |
| api, endpoint, rest, graphql | `api` |
| react, component, frontend, ui | `frontend` |
| performance, slow, fast, cache | `performance` |
| test, pytest, jest, coverage | `testing` |
| deploy, CI/CD, Docker, Kubernetes | `deployment` |
| monitoring, logging, tracing, metrics | `observability` |
| LLM, RAG, embedding, LangChain | `ai-ml` |
| ETL, streaming, batch processing | `data-pipeline` |
| security, vulnerability, OWASP | `security` |

### /recall -- Search Past Decisions

```
/recall <search query>
/recall --category <category> <query>
/recall --limit <n> <query>
/recall --mem0 <query>                   # Search BOTH graph AND Mem0 cloud
/recall --agent <agent-id> <query>       # Filter by agent scope
/recall --global <query>                 # Search cross-project best practices
```

**Examples:**

```
/recall database                         # Search graph for "database"

/recall --category architecture API      # Filter to architecture category

/recall --mem0 authentication approach   # Search both graph and cloud

/recall --agent backend-system-architect "API patterns"

/recall --global --category pagination   # Cross-project pagination patterns
```

**Output format uses source tags:**

```
[GRAPH]     Results from the knowledge graph
[MEM0]      Results from Mem0 cloud
[CROSS-REF] Results validated across both systems
```

### /mem0-sync -- Force Cloud Sync

```
/mem0-sync                               # Sync pending decisions to cloud
```

Syncs four categories of data: session summaries, pending decisions, agent patterns, and generalizable best practices. Requires `MEM0_API_KEY`.

### /load-context -- Reload Session Context

```
/load-context                            # Manually reload decisions, blockers, entities
```

Typically runs automatically at session start via the `session-context-loader` hook. Use this command to refresh context mid-session after significant changes.

---

## Data Flow

### Write Path (Automatic)

Most writes are triggered by hooks, not user commands. The `posttool/unified-dispatcher` extracts patterns from every tool use, and `stop/auto-remember-continuity` stores session context at session end.

```
Hook / Skill Trigger
  |
  v
Pattern Extraction (regex + keyword detection)
  "database-engineer uses pgvector" --> Agent, Technology entities
  git commit "feat: add cursor pagination" --> Pattern entity
  |
  v
Auto-detect Category
  Keywords: "database", "pgvector" --> category: "database"
  |
  v
Extract Entities
  "database-engineer" --> Agent
  "pgvector"          --> Technology
  "cursor-pagination" --> Pattern
  |
  v
Extract Relations (pattern matching)
  "uses"        --> USES
  "recommends"  --> RECOMMENDS
  "requires"    --> REQUIRES
  |
  v
[PRIMARY] Graph Storage (always)
  mcp__memory__create_entities(...)
  mcp__memory__create_relations(...)
  |
  v (if MEM0_API_KEY set)
[OPTIONAL] Mem0 Cloud (via Python SDK)
  python3 add-memory.py --text "..." --enable-graph
```

Manual writes via `/remember` follow the same pipeline but are user-initiated.

### Read Path (Automatic)

Most reads are triggered by hooks -- `session-context-loader` at session start and `prompt/memory-context` on each user prompt. Manual reads via `/recall` follow the same pipeline.

```
Hook / Skill Trigger
  |
  v
Parse Query (entity hints + intent detection)
  |
  +---------------------+------------------------+
  |                                               |
  v                                               v
[PARALLEL] Graph Search                [PARALLEL] Mem0 Search
mcp__memory__search_nodes              python3 search-memories.py --enable-graph
  |                                    (only if MEM0_API_KEY set)
  +---------------------+------------------------+
                        |
                        v
                  Normalize Results
                  (common schema)
                        |
                        v
                  Deduplicate
                  (Jaccard similarity > 0.85)
                        |
                        v
                  Cross-Reference Boost
                  (Mem0 mentions graph entity --> 1.2x)
                        |
                        v
                  Score & Rank
                  score = (recency x 0.3) + (relevance x 0.5) + (authority x 0.2)
                        |
                        v
                  Inject into Context
                  (automatic) or Format Output (manual)
```

---

## Hook Integration

Memory Fabric is powered by OrchestKit's hook engine: 152 TypeScript hooks compiled into 11 split bundles, with 31 hooks executing asynchronously via Claude Code's native `async: true` support.

### How Hooks Populate the Fabric

Hooks fire automatically at every stage of a Claude Code session. The memory-relevant hooks work together to extract, store, and retrieve knowledge without user intervention.

#### Session Start

The `lifecycle/session-context-loader` hook runs at the beginning of every session. It performs two key tasks:

1. **Compaction manifest recovery** -- Reads `compaction-manifest.json` from the previous session and sets environment variables for continuity:
   - `ORCHESTKIT_LAST_SESSION` -- Previous session ID
   - `ORCHESTKIT_LAST_DECISIONS` -- Previous session's key decisions (JSON)

2. **Context loading** (tiered by context pressure):
   - At 0-70% context usage: full entity load (decisions, patterns, blockers, relationships)
   - At 70-85%: reduced set, critical decisions and active blockers only
   - At >85%: minimal critical blockers only

Additional context loaded: session state, identity, knowledge index, current status docs, and agent-specific configuration.

The `subagent-start/agent-memory-inject` hook injects agent-specific memories when subagents are spawned, giving each agent access to its own decision history.

#### During Session

The `posttool/unified-dispatcher` is the central async hook that runs after every tool use. It consolidates approximately 14 hooks into a single dispatcher, using `Promise.allSettled()` to execute them in parallel:

- **Pattern extractor** -- Extracts patterns from git commits, PR merges, test results, and build results
- **Memory bridge** -- One-way sync from Mem0 to Graph (graph remains authoritative)
- **Analytics hooks** -- Session metrics, audit logging, calibration tracking, code style learning, naming convention learning, skill usage optimization, and real-time sync

The `prompt/memory-context` hook runs on each user prompt, injecting relevant memory context to inform the response.

#### Session End

Multiple hooks coordinate at session end in sequence:

1. **`stop/auto-remember-continuity`** -- Prompts storage of session context into the knowledge graph:
   - Session continuity entity (`Session` type with observations: what was done, next steps)
   - Important decisions (`Decision` type with rationale)
   - Patterns learned (via `/remember --success` or `/remember --failed`)
   - Adds `--mem0` flag hint when cloud sync is available

2. **`stop/mem0-pre-compaction-sync`** -- Syncs pending items to Mem0 cloud before context compaction:
   - Counts unsynced decisions from `decision-log.json` vs `decision-sync-state.json`
   - Counts pending patterns from `agent-patterns.jsonl` (where `pending_sync === true`)
   - Extracts blockers and next steps from session state
   - Spawns a detached Python subprocess to call `add-memory.py` with `--enable-graph`
   - Marks synced patterns as `pending_sync: false` to prevent duplicate syncs

3. **`stop/context-compressor`** -- Archives and compresses the session for the next session:
   - Writes **compaction manifest** (`compaction-manifest.json`) containing:
     - `sessionId`, `compactedAt` timestamp
     - `keyDecisions` (last 5), `filesTouched` (last 20)
     - `blockers`, `nextSteps`
   - Archives current session to `archive/sessions/${sessionId}.json`
   - Compresses old decisions (>10 active) to `archive/decisions/YYYY-MM.json`

4. **`stop/auto-save-context`** -- Updates session state with Context Protocol 2.0 schema:
   - Writes to `.claude/context/session/state.json`
   - Updates `last_activity` timestamp
   - Preserves `current_task`, `next_steps`, `blockers`
   - Schema: `context://session/v1` with `position: 'END'`, `token_budget: 500`

5. **`lifecycle/pattern-sync-push`** -- Pushes learned patterns to the graph for future sessions

### Entity Extraction Patterns

The pattern extractor uses regex-based detection to identify entities from tool output:

| Pattern Target | Regex Strategy | Example Matches |
|---------------|---------------|-----------------|
| Technology | Known tech keywords + capitalized terms | `PostgreSQL`, `pgvector`, `FastAPI`, `React` |
| Pattern | Hyphenated compound nouns | `cursor-pagination`, `connection-pooling` |
| Decision | "decided", "chose", "will use" triggers | Architectural choices |
| Agent | OrchestKit agent name format | `database-engineer`, `backend-system-architect` |
| Architecture | System design terms | `CQRS`, `event-sourcing`, `microservices` |
| Database | DB-specific keywords | `PostgreSQL`, `pgvector`, `HNSW` |
| Security | Security domain terms | `OWASP`, `JWT`, `OAuth` |

### Unified Dispatchers

Six unified dispatchers consolidate approximately 30 individual hooks to reduce noise and improve performance:

| Dispatcher | Event | Hooks Consolidated | Execution |
|-----------|-------|-------------------|-----------|
| `posttool/unified-dispatcher` | PostToolUse | ~14 hooks | Async, 60s timeout |
| `lifecycle/unified-dispatcher` | SessionStart | Startup hooks | Async, 60s timeout |
| `stop/unified-dispatcher` | Stop | Stop-phase hooks | Async, 60s timeout |
| `subagent-stop/unified-dispatcher` | SubagentStop | Subagent cleanup | Async, 60s timeout |
| `notification/unified-dispatcher` | Notification | Notification hooks | Async, 30s timeout |
| `setup/unified-dispatcher` | Setup | One-time init hooks | Async, 60s timeout |

On success, dispatchers are silent. On failure, they report which hooks failed (for example: "PostToolUse: 2/14 hooks failed (pattern-extractor, audit-logger)").

---

## Advanced Topics

### Graph Traversal

Memory Fabric supports multi-hop graph traversal for complex relationship queries using the Mem0 graph scripts.

**Single-hop query:**

```bash
python3 skills/mem0-memory/scripts/graph/get-related-memories.py \
  --memory-id "mem_abc123" \
  --depth 1 \
  --relation-type "recommends"
```

**Multi-hop traversal (DFS with cycle detection):**

```bash
python3 skills/mem0-memory/scripts/graph/traverse-graph.py \
  --memory-id "mem_abc123" \
  --depth 2 \
  --relation-type "recommends"
```

**Example traversal:**

```
Query: "What did database-engineer recommend about pagination?"

Step 1: Search for "database-engineer pagination"
        --> Find: "database-engineer recommends cursor-pagination"

Step 2: Traverse depth 2
        --> database-engineer --RECOMMENDS--> cursor-pagination
        --> cursor-pagination --PREFERRED_OVER--> offset-pagination

Step 3: Return unified results with full relationship context
```

### Deduplication Engine

The deduplication engine prevents redundant results when the same information exists in both storage tiers.

**Algorithm:**
1. Normalize text: lowercase, remove punctuation, tokenize into word sets
2. Compute Jaccard similarity: `|A intersect B| / |A union B|`
3. If similarity exceeds `MEMORY_FABRIC_DEDUP_THRESHOLD` (default 0.85), merge results
4. The higher-relevance result's text is preserved
5. Metadata and entity lists are combined from both sources
6. The merged result is marked `cross_validated: true`, granting it the 1.3x authority boost

### Context-Aware Loading

Memory Fabric dynamically adjusts its behavior based on how much of the context window has been consumed.

**Session Start Loading:**

| Context Pressure | What Gets Loaded |
|-----------------|------------------|
| 0-70% | Full entity load: all decisions, patterns, blockers, relationships |
| 70-85% | Reduced set: critical decisions and active blockers only |
| >85% | Minimal: only blockers tagged as critical |

**Search Result Limits:**

The `context-budget-monitor` PostToolUse hook tracks context usage continuously. When a `/recall` query returns results, the count is automatically capped based on current pressure to avoid consuming excessive context.

### Compaction Manifest

The compaction manifest is the bridge between sessions. Written by `stop/context-compressor` at session end, it provides a structured seed for the next session.

**Location:** `.claude/context/session/compaction-manifest.json`

**Schema:**

```json
{
  "sessionId": "abc-123",
  "compactedAt": "2026-01-27T14:30:00Z",
  "keyDecisions": [
    "Chose cursor-based pagination for scalability",
    "Using pgvector for RAG search"
  ],
  "filesTouched": [
    "src/api/routes/search.py",
    "src/db/models/embedding.py"
  ],
  "blockers": ["Migration approval pending for production"],
  "nextSteps": ["Add integration tests for search endpoint"]
}
```

**Limits:** Last 5 decisions, last 20 files modified. This keeps the manifest small enough for the session-context-loader to parse without impacting startup latency.

**Archival:** After writing the manifest, the compressor also archives the full session to `archive/sessions/${sessionId}.json` and rotates decisions older than 10 active entries to `archive/decisions/YYYY-MM.json`.

### Backup and Retention (Mem0 Cloud)

When Mem0 cloud is configured, the `setup/mem0-backup-setup` hook (runs once per plugin load) writes a backup configuration:

**Location:** `.claude/mem0-backup-config.json`

```json
{
  "schedule": "weekly",
  "retention_days": 30,
  "enabled": true,
  "max_backups": 5,
  "rotation_strategy": "count",
  "backup_naming": "timestamp"
}
```

| Setting | Default | Env Variable | Description |
|---------|---------|-------------|-------------|
| `schedule` | `weekly` | `MEM0_BACKUP_SCHEDULE` | Backup frequency |
| `retention_days` | `30` | `MEM0_BACKUP_RETENTION` | Days before expiry |
| `max_backups` | `5` | `MEM0_MAX_BACKUPS` | Max backups kept |
| `rotation_strategy` | `count` | -- | Fixed count rotation |
| `backup_naming` | `timestamp` | -- | ISO 8601 naming for sortability |

### Memory Bridge (Mem0 to Graph Sync)

The memory bridge runs as part of the `posttool/unified-dispatcher` and performs one-way synchronization from Mem0 Cloud to the Local Knowledge Graph.

**Why one-way?** The graph is authoritative. Mem0 may contain semantically similar but not identical content. The bridge extracts structured entities from Mem0 results and creates corresponding graph entities and relations, ensuring the graph always has the most complete picture.

**What gets synced:**
- Technology entities mentioned in Mem0 memories
- Relationship patterns detected in Mem0 text
- Decision outcomes and pattern classifications

### Session Lifecycle

A complete session lifecycle with Memory Fabric:

```
1. SESSION START
   |-- lifecycle/session-context-loader
   |     Reads compaction-manifest.json from previous session
   |     Sets ORCHESTKIT_LAST_SESSION, ORCHESTKIT_LAST_DECISIONS env vars
   |     Loads identity, knowledge index, session state, current status
   |     Loads decisions, blockers, entities (tiered by context pressure)
   |-- lifecycle/unified-dispatcher (async)
   |     Runs startup hooks in background
   |-- /load-context (if manual reload needed)

2. DURING SESSION
   |-- prompt/memory-context
   |     Injects relevant memory context per prompt
   |-- posttool/unified-dispatcher (async, per tool call)
   |     Pattern extraction from git/test/build output
   |     Memory bridge (Mem0 --> Graph)
   |     Analytics and metrics in background
   |-- /remember (manual storage)
   |-- /recall (manual retrieval)

3. SESSION END
   |-- stop/auto-remember-continuity
   |     Prompts graph storage: Session entity, Decision entities, Patterns
   |-- stop/mem0-pre-compaction-sync
   |     Counts unsynced decisions + pending patterns
   |     Spawns detached Python process for cloud sync
   |     Marks patterns as synced (pending_sync: false)
   |-- stop/context-compressor
   |     Writes compaction-manifest.json (next session seed)
   |       --> keyDecisions (last 5), filesTouched (last 20)
   |       --> blockers, nextSteps
   |     Archives session to archive/sessions/${sessionId}.json
   |     Compresses old decisions to archive/decisions/YYYY-MM.json
   |-- stop/auto-save-context
   |     Updates state.json with Context Protocol 2.0 schema
   |     Preserves current_task, next_steps, blockers
   |-- lifecycle/pattern-sync-push
   |     Pushes learned patterns to graph

4. NEXT SESSION
   |-- session-context-loader reads compaction-manifest.json
   |     Cycle repeats with full continuity
```

---

## Memory Fabric vs Traditional Approaches

| Aspect | Traditional (No Memory) | Manual Context Files | Memory Fabric |
|--------|------------------------|---------------------|---------------|
| **Cold starts** | Every session starts from zero | Partial -- relies on user-maintained files | Eliminated -- auto-loads relevant context |
| **Decision persistence** | Lost when session ends | Manual copy-paste to files | Automatic -- hooks extract and store |
| **Pattern learning** | Re-discovers same patterns | Static documentation | Dynamic -- learns from tool output |
| **Cross-session continuity** | None | Fragile, depends on user discipline | Built-in -- auto-remember-continuity hook |
| **Relationship queries** | Not possible | Grep through flat text | Native graph traversal |
| **Anti-pattern tracking** | Repeats mistakes | Manual "lessons learned" docs | `--failed` flag creates AntiPattern entities |
| **Multi-agent memory** | Each agent isolated | Shared files, no scoping | Agent-scoped with injection at spawn |
| **Setup required** | None | Create and maintain files | One MCP server entry (zero-config) |
| **Cost** | Free | Free | Graph: Free. Mem0: Optional paid tier |

### Key Advantages

**No cold starts.** The `session-context-loader` hook reads the compaction manifest and loads previous decisions, blockers, and entities before you type anything. The agent starts with full project context.

**Fully automatic.** You don't run commands. The `posttool/unified-dispatcher` watches every tool use -- git commits, PR merges, test results, build output -- and extracts patterns into the knowledge graph in the background via `async: true` hooks. The `context-compressor` writes a manifest at session end. The `session-context-loader` reads it at the next session start. The cycle is self-sustaining.

**Structured relationships.** Unlike flat-text memory, the knowledge graph stores typed relationships (`USES`, `RECOMMENDS`, `REQUIRES`, `BLOCKED_BY`). The `memory-bridge` hook extracts entities from Mem0 content and creates corresponding graph nodes automatically.

**Graceful degradation.** If Mem0 Cloud is unavailable, the graph continues to function independently. Context-aware loading adjusts result counts based on context window pressure. The system never fails completely -- it degrades to fewer, higher-priority results.

**Cross-project learning.** The `global:best-practices` scope and hooks like `mem0-pre-compaction-sync` enable patterns learned in one project to automatically inform decisions in another.

---

## Related Documentation

| Resource | Location | Description |
|----------|----------|-------------|
| Memory Fabric Skill | `src/skills/memory-fabric/SKILL.md` | Core orchestration skill definition |
| Entity Extraction Reference | `src/skills/memory-fabric/references/entity-extraction.md` | Detailed extraction patterns and algorithms |
| Query Merging Reference | `src/skills/memory-fabric/references/query-merging.md` | Deduplication and ranking algorithm details |
| Recall Skill | `src/skills/recall/SKILL.md` | User-facing search command definition |
| Remember Skill | `src/skills/remember/SKILL.md` | User-facing storage command definition |
| Mem0 Memory Skill | `src/skills/mem0-memory/SKILL.md` | Cloud memory operations and Python scripts |
| Mem0 Sync Skill | `src/skills/mem0-sync/SKILL.md` | Auto-sync protocol and session persistence |
| Context Compression Skill | `src/skills/context-compression/SKILL.md` | Anchored summarization and compression strategies |
| Load Context Skill | `src/skills/load-context/SKILL.md` | Session-start context loading with pressure tiers |
| Context Compressor Hook | `src/hooks/src/stop/context-compressor.ts` | Compaction manifest writer and session archiver |
| Session Context Loader Hook | `src/hooks/src/lifecycle/session-context-loader.ts` | Manifest reader and env var setter (Context Protocol 2.0) |
| Pre-Compaction Sync Hook | `src/hooks/src/stop/mem0-pre-compaction-sync.ts` | Idempotent cloud sync with pending item tracking |
| Hooks Configuration | `src/hooks/hooks.json` | Complete hook definitions with matchers and async flags |
