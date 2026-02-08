# OrchestKit Architecture Diagrams

Complete ASCII architecture visualizations for the OrchestKit platform, showcasing the multi-agent learning integration system.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORCHESTKIT PLATFORM                               │
│         Intelligent Learning Integration with Multi-Agent Analysis          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    React 19 SPA (Vite)                               │   │
│  │                      Port: 5173                                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Components:                                                         │   │
│  │  • HomePage (URL submission)                                         │   │
│  │  • AnalysisProgressCard (SSE real-time updates)                      │   │
│  │  • ArtifactViewer (results display)                                  │   │
│  │  • AgentStatusGrid (8 agent monitoring)                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                          HTTPS + SSE
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                          APPLICATION LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Backend                                   │   │
│  │                      Port: 8500                                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Core Services:                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Analysis    │  │   Artifact   │  │   Search     │              │   │
│  │  │  Service     │  │   Service    │  │   Service    │              │   │
│  │  │              │  │              │  │ (PGVector +  │              │   │
│  │  │              │  │              │  │   BM25)      │              │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │   │
│  │         │                 │                 │                       │   │
│  │         └─────────────────┼─────────────────┘                       │   │
│  │                           │                                         │   │
│  │  ┌────────────────────────▼──────────────────────────┐              │   │
│  │  │         LangGraph Orchestration Engine            │              │   │
│  │  │  ┌────────────────────────────────────────────┐   │              │   │
│  │  │  │       Supervisor Agent (Coordinator)       │   │              │   │
│  │  │  └──────────────────┬─────────────────────────┘   │              │   │
│  │  │                     │                             │              │   │
│  │  │         ┌───────────┼───────────┐                 │              │   │
│  │  │         │           │           │                 │              │   │
│  │  │  ┌──────▼─────┐ ┌──▼──────┐ ┌──▼─────────┐       │              │   │
│  │  │  │  Content   │ │Analysis │ │  Quality   │       │              │   │
│  │  │  │  Fetcher   │ │Pipeline │ │   Gate     │       │              │   │
│  │  │  └────────────┘ └────┬────┘ └────────────┘       │              │   │
│  │  │                      │                            │              │   │
│  │  │       ┌──────────────┼──────────────┐             │              │   │
│  │  │       │              │              │             │              │   │
│  │  │  8 Worker Agents (Parallel Execution):            │              │   │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │              │   │
│  │  │  │Tech          │ │Security      │ │Impl.     │  │              │   │
│  │  │  │Comparator    │ │Auditor       │ │Planner   │  │              │   │
│  │  │  └──────────────┘ └──────────────┘ └──────────┘  │              │   │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │              │   │
│  │  │  │Tutorial      │ │Conceptual    │ │Code      │  │              │   │
│  │  │  │Optimizer     │ │Explainer     │ │Reviewer  │  │              │   │
│  │  │  └──────────────┘ └──────────────┘ └──────────┘  │              │   │
│  │  │  ┌──────────────┐ ┌──────────────┐               │              │   │
│  │  │  │Learning Path │ │Socratic      │               │              │   │
│  │  │  │Designer      │ │Tutor         │               │              │   │
│  │  │  └──────────────┘ └──────────────┘               │              │   │
│  │  └───────────────────────────────────────────────────┘              │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────┐               │   │
│  │  │          Event Broadcasting (SSE)                │               │   │
│  │  │  • Buffered events (deque, maxlen=100)           │               │   │
│  │  │  • Per-channel subscriptions                     │               │   │
│  │  │  • Progress updates (0-100%)                     │               │   │
│  │  │  • Agent status changes                          │               │   │
│  │  └──────────────────────────────────────────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────────────┐
│                            DATA LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌───────────────┐  ┌─────────────────────┐    │
│  │   PostgreSQL + PGVector│  │  Redis Cache  │  │   Langfuse          │    │
│  │      Port: 5437       │  │  Port: 6379   │  │ (Observability)     │    │
│  ├───────────────────────┤  ├───────────────┤  └─────────────────────┘    │
│  │ Tables:               │  │ Caches:       │                              │
│  │ • users               │  │ • Semantic    │                              │
│  │ • analyses            │  │   cache       │                              │
│  │ • artifacts           │  │ • API results │                              │
│  │ • chunks              │  │ • Session     │                              │
│  │   (HNSW index)        │  │   data        │                              │
│  │ • agent_executions    │  └───────────────┘                              │
│  └───────────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## LangGraph Multi-Agent Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LANGGRAPH ANALYSIS WORKFLOW                               │
│                  Supervisor-Worker Pattern (8 Agents)                        │
└─────────────────────────────────────────────────────────────────────────────┘

                           ┌──────────────────┐
                           │  START (URL)     │
                           └────────┬─────────┘
                                    │
                           ┌────────▼─────────┐
                           │ Content Fetcher  │
                           │  Node            │
                           │ • Scrape URL     │
                           │ • Extract text   │
                           │ • Validate       │
                           └────────┬─────────┘
                                    │
                           ┌────────▼─────────┐
                           │  Supervisor      │
                           │  Coordinator     │
                           │ • Task planning  │
                           │ • Agent routing  │
                           │ • Dependency mgmt│
                           └────────┬─────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
      ┌─────────▼────────┐ ┌────────▼────────┐ ┌───────▼──────────┐
      │  Tech Comparator │ │Security Auditor │ │  Impl. Planner   │
      │  Worker Agent    │ │ Worker Agent    │ │  Worker Agent    │
      └─────────┬────────┘ └────────┬────────┘ └───────┬──────────┘
                │                   │                   │
      ┌─────────▼────────┐ ┌────────▼────────┐ ┌───────▼──────────┐
      │Tutorial Optimizer│ │Conceptual       │ │ Code Reviewer    │
      │  Worker Agent    │ │Explainer        │ │  Worker Agent    │
      └─────────┬────────┘ │ Worker Agent    │ └───────┬──────────┘
                │          └────────┬────────┘         │
      ┌─────────▼────────┐ ┌────────▼────────┐         │
      │Learning Path     │ │  Socratic Tutor │         │
      │Designer          │ │  Worker Agent   │         │
      │  Worker Agent    │ └────────┬────────┘         │
      └─────────┬────────┘          │                  │
                │                   │                  │
                └───────────────────┼──────────────────┘
                                    │
                           ┌────────▼─────────┐
                           │  Aggregator      │
                           │  Node            │
                           │ • Merge findings │
                           │ • Deduplicate    │
                           │ • Score quality  │
                           └────────┬─────────┘
                                    │
                           ┌────────▼─────────┐
                           │  Quality Gate    │
                           │  Node            │
                           │ • Depth check    │
                           │ • Completeness   │
                           │ • G-Eval scoring │
                           └────────┬─────────┘
                                    │
                            ┌───────┴────────┐
                            │  Pass?         │
                            └───┬────────┬───┘
                             No │        │ Yes
                    ┌───────────┘        └───────────┐
                    │                                │
           ┌────────▼─────────┐           ┌──────────▼────────┐
           │  Retry (max 2x)  │           │ Compress Findings │
           └────────┬─────────┘           │     Node          │
                    │                     └──────────┬────────┘
                    └────────┐                       │
                             │              ┌────────▼────────┐
                             │              │  Save Artifact  │
                             │              │     Node        │
                             │              └────────┬────────┘
                             │                       │
                             └───────────────────────┘
                                                     │
                                            ┌────────▼────────┐
                                            │      END        │
                                            │  (Artifact ID)  │
                                            └─────────────────┘


Event Broadcasting (SSE):
┌─────────────────────────────────────────────────────────────┐
│ Progress Events Published at Each Node:                     │
│  • node_start: { node: "Tech Comparator", timestamp: ... }  │
│  • progress: { percentage: 25, message: "Analyzing..." }    │
│  • node_complete: { node: "Tech Comparator", duration: 5s } │
│  • error: { node: "Security Auditor", error: "..." }        │
│  • complete: { artifact_id: 123, quality_score: 8.5 }       │
└─────────────────────────────────────────────────────────────┘
```

## Agent Execution Detail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   WORKER AGENT EXECUTION PATTERN                             │
│                 (Example: Tech Comparator Agent)                             │
└─────────────────────────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────┐
        │  Input from Supervisor                   │
        │  • Content (text/code)                   │
        │  • Task description                      │
        │  • Context from previous agents          │
        └────────────┬─────────────────────────────┘
                     │
        ┌────────────▼─────────────────────────────┐
        │  1. Prompt Construction                  │
        │  • Load system prompt                    │
        │  • Inject content                        │
        │  • Add few-shot examples                 │
        └────────────┬─────────────────────────────┘
                     │
        ┌────────────▼─────────────────────────────┐
        │  2. LLM Invocation (with caching)        │
        │  ┌────────────────────────────────────┐  │
        │  │ Cache Check (Redis Semantic)      │  │
        │  │ • Hash prompt                      │  │
        │  │ • Check similarity (cosine > 0.95) │  │
        │  └─────────┬──────────────────────────┘  │
        │            │                              │
        │     ┌──────┴──────┐                       │
        │  Cache│          │Miss                    │
        │   Hit │          │                        │
        │  ┌────▼──────┐ ┌─▼────────────────────┐  │
        │  │  Return   │ │  Call LLM (Gemini)   │  │
        │  │  Cached   │ │  • Temperature: 0.7   │  │
        │  │  Result   │ │  • Max tokens: 2048   │  │
        │  └────┬──────┘ │  • Stream: false      │  │
        │       │        └─┬────────────────────┘  │
        │       │          │                        │
        │       └──────────┘                        │
        └────────────┬─────────────────────────────┘
                     │
        ┌────────────▼─────────────────────────────┐
        │  3. Response Parsing                     │
        │  • Extract structured data               │
        │  • Validate against schema               │
        │  • Handle Gemini dict format             │
        └────────────┬─────────────────────────────┘
                     │
        ┌────────────▼─────────────────────────────┐
        │  4. Embedding Generation                 │
        │  • Chunk findings (500-2000 chars)       │
        │  • Generate embeddings (Gemini)          │
        │  • Store in PGVector                     │
        └────────────┬─────────────────────────────┘
                     │
        ┌────────────▼─────────────────────────────┐
        │  5. Observability (Langfuse)             │
        │  • Log trace                             │
        │  • Record tokens used                    │
        │  • Track latency                         │
        │  • Log quality score                     │
        └────────────┬─────────────────────────────┘
                     │
        ┌────────────▼─────────────────────────────┐
        │  Output to Supervisor                    │
        │  • Findings (structured)                 │
        │  • Metadata (tokens, duration)           │
        │  • Status (success/failure)              │
        └──────────────────────────────────────────┘
```

## Request Flow - Complete Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              COMPLETE REQUEST FLOW (URL → Artifact)                          │
└─────────────────────────────────────────────────────────────────────────────┘

User         Frontend          API Gateway       LangGraph       PostgreSQL
 │               │                  │                │               │
 │  1. Submit URL│                  │                │               │
 ├──────────────►│                  │                │               │
 │               │  2. POST         │                │               │
 │               │    /analyses     │                │               │
 │               ├─────────────────►│                │               │
 │               │                  │  3. Validate   │               │
 │               │                  │     & Create   │               │
 │               │                  ├───────────────►│               │
 │               │                  │                │  4. INSERT    │
 │               │                  │                │     analysis  │
 │               │                  │                ├──────────────►│
 │               │                  │                │               │
 │               │                  │                │  5. Return ID │
 │               │                  │                │◄──────────────┤
 │               │  6. 201 Created  │                │               │
 │               │  { id: 123 }     │                │               │
 │               │◄─────────────────┤                │               │
 │  7. Show      │                  │                │               │
 │     progress  │                  │                │               │
 │◄──────────────┤                  │                │               │
 │               │                  │                │               │
 │  8. Connect   │                  │                │               │
 │     to SSE    │                  │                │               │
 ├──────────────►│  9. GET          │                │               │
 │               │    /analyses/123/│                │               │
 │               │    stream        │                │               │
 │               ├─────────────────►│                │               │
 │               │                  │ 10. Subscribe  │               │
 │               │                  │     to events  │               │
 │  ╔═══════════╪══════════════════╪════════════════╪═══════════════╪═════╗
 │  ║           │  SSE Stream Open │                │               │     ║
 │  ║           │                  │                │               │     ║
 │  ║           │                  │ 11. Start      │               │     ║
 │  ║           │                  │     workflow   │               │     ║
 │  ║           │                  ├───────────────►│               │     ║
 │  ║           │                  │                │               │     ║
 │  ║           │                  │  Node: Content Fetcher          │     ║
 │  ║ ┌───────────────────────────────────────────┐ │               │     ║
 │◄─║─┤ data: {"event":"node_start","node":"..."}│ │               │     ║
 │  ║ └───────────────────────────────────────────┘ │               │     ║
 │  ║           │                  │                │               │     ║
 │  ║           │                  │  Node: Supervisor               │     ║
 │  ║ ┌───────────────────────────────────────────┐ │               │     ║
 │◄─║─┤ data: {"progress":10,"message":"..."}    │ │               │     ║
 │  ║ └───────────────────────────────────────────┘ │               │     ║
 │  ║           │                  │                │               │     ║
 │  ║           │                  │  Parallel Agent Execution:      │     ║
 │  ║           │                  │  ┌─────────────┐               │     ║
 │  ║           │                  │  │Tech Comp    │               │     ║
 │  ║           │                  │  │Security Aud │               │     ║
 │  ║           │                  │  │Impl. Plan   │               │     ║
 │  ║           │                  │  │... (8 total)│               │     ║
 │  ║           │                  │  └─────────────┘               │     ║
 │  ║           │                  │                │               │     ║
 │  ║ ┌───────────────────────────────────────────┐ │               │     ║
 │◄─║─┤ data: {"progress":25,"agent":"Tech..."}  │ │               │     ║
 │  ║ └───────────────────────────────────────────┘ │               │     ║
 │  ║           │                  │                │               │     ║
 │  ║ ┌───────────────────────────────────────────┐ │               │     ║
 │◄─║─┤ data: {"progress":50,"agent":"Sec..."}   │ │               │     ║
 │  ║ └───────────────────────────────────────────┘ │               │     ║
 │  ║           │                  │                │               │     ║
 │  ║           │                  │  Node: Aggregator               │     ║
 │  ║ ┌───────────────────────────────────────────┐ │               │     ║
 │◄─║─┤ data: {"progress":75,"message":"..."}    │ │               │     ║
 │  ║ └───────────────────────────────────────────┘ │               │     ║
 │  ║           │                  │                │               │     ║
 │  ║           │                  │  Node: Quality Gate             │     ║
 │  ║           │                  │  (G-Eval scoring)               │     ║
 │  ║           │                  │                │               │     ║
 │  ║           │                  │  Node: Compress Findings        │     ║
 │  ║           │                  │                │               │     ║
 │  ║           │                  │  Node: Save Artifact            │     ║
 │  ║           │                  │                │ 12. INSERT    │     ║
 │  ║           │                  │                │     artifact  │     ║
 │  ║           │                  │                ├──────────────►│     ║
 │  ║           │                  │                │               │     ║
 │  ║           │                  │                │ 13. Return ID │     ║
 │  ║           │                  │                │◄──────────────┤     ║
 │  ║           │                  │                │               │     ║
 │  ║ ┌───────────────────────────────────────────────────────────┐│     ║
 │◄─║─┤ data: {"progress":100,"status":"complete","artifact_id":..}│     ║
 │  ║ └───────────────────────────────────────────────────────────┘│     ║
 │  ║           │                  │                │               │     ║
 │  ╚═══════════╪══════════════════╪════════════════╪═══════════════╪═════╝
 │  14. Close   │                  │                │               │
 │      SSE     │                  │                │               │
 ├──────────────►│                  │                │               │
 │               │                  │                │               │
 │  15. Navigate │                  │                │               │
 │      to       │                  │                │               │
 │      artifact │                  │                │               │
 ├──────────────►│                  │                │               │
 │               │  16. GET         │                │               │
 │               │    /artifacts/456│                │               │
 │               ├─────────────────►│                │               │
 │               │                  │                │  17. SELECT   │
 │               │                  │                │      artifact │
 │               │                  │                ├──────────────►│
 │               │                  │                │               │
 │               │                  │                │  18. Return   │
 │               │                  │                │      data     │
 │               │                  │                │◄──────────────┤
 │               │  19. 200 OK      │                │               │
 │               │  { artifact }    │                │               │
 │               │◄─────────────────┤                │               │
 │  20. Display  │                  │                │               │
 │      results  │                  │                │               │
 │◄──────────────┤                  │                │               │
 │               │                  │                │               │
```

## Database Schema (OrchestKit)

```
┌──────────────────────────────────────────────────────────────────┐
│                    ORCHESTKIT DATABASE SCHEMA                     │
│                      PostgreSQL + PGVector                        │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────┐              ┌─────────────────────┐
│       users         │              │     analyses        │
├─────────────────────┤              ├─────────────────────┤
│ id (PK)       SERIAL│              │ id (PK)       SERIAL│
│ email        VARCHAR│              │ user_id (FK)    INT │──┐
│ password_hash TEXT  │              │ url             TEXT│  │
│ is_active   BOOLEAN │              │ status        ENUM  │  │
│ created_at TIMESTAMP│              │ progress         INT│  │
│ updated_at TIMESTAMP│              │ error_msg       TEXT│  │
└───────┬─────────────┘              │ created_at TIMESTAMP│  │
        │                            │ completed_at    TIME│  │
        │ 1                          │ metadata        JSON│  │
        │                            └──────────┬──────────┘  │
        │                                       │             │
        │                                       │ 1           │
        │                                       │             │
        │ *                                     │             │
        └───────────────────────────────────────┘             │
                                                              │
┌─────────────────────┐                                       │
│     artifacts       │                                       │
├─────────────────────┤                                       │
│ id (PK)       SERIAL│                                       │
│ analysis_id (FK) INT│───────────────────────────────────────┘
│ content          TEXT│
│ quality_score DECIMAL│
│ metadata         JSON│  # Includes agent findings
│ created_at  TIMESTAMP│
└──────────┬──────────┘
           │
           │ 1
           │
           │ *
┌──────────▼──────────┐
│       chunks        │
├─────────────────────┤
│ id (PK)       SERIAL│
│ artifact_id (FK) INT│
│ content          TEXT│
│ content_tsvector    │  # Pre-computed for BM25
│ embedding    VECTOR │  # 768 dims (Gemini)
│ section_title   TEXT│
│ document_path   TEXT│
│ metadata        JSON│
│ created_at TIMESTAMP│
│                     │
│ INDEXES:            │
│ • HNSW (embedding)  │  # Vector similarity
│ • GIN (tsvector)    │  # Full-text search
│ • BTREE (artifact)  │  # Foreign key
└─────────────────────┘

┌─────────────────────┐
│  agent_executions   │
├─────────────────────┤
│ id (PK)       SERIAL│
│ analysis_id (FK) INT│
│ agent_name    VARCHAR│
│ status          ENUM│  # running, completed, failed
│ input_tokens     INT│
│ output_tokens    INT│
│ duration_ms      INT│
│ error_msg       TEXT│
│ metadata        JSON│
│ started_at TIMESTAMP│
│ completed_at    TIME│
└─────────────────────┘
```

## Hybrid Search Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│               HYBRID SEARCH (PGVector + BM25 RRF)                    │
│          Reciprocal Rank Fusion for Best Results                    │
└─────────────────────────────────────────────────────────────────────┘

User Query: "How to implement RAG with PGVector?"
     │
     └─────────────────────┬─────────────────────┐
                           │                     │
                  ┌────────▼────────┐   ┌────────▼────────┐
                  │  Semantic       │   │  Keyword (BM25) │
                  │  Search         │   │  Search         │
                  ├─────────────────┤   ├─────────────────┤
                  │ 1. Embed query  │   │ 1. Parse query  │
                  │ 2. Vector sim   │   │ 2. tsvector     │
                  │    (cosine)     │   │    match        │
                  │ 3. HNSW index   │   │ 3. GIN index    │
                  │ 4. Fetch top_k  │   │ 4. Fetch top_k  │
                  │    × multiplier │   │    × multiplier │
                  │    (3x = 30)    │   │    (3x = 30)    │
                  └────────┬────────┘   └────────┬────────┘
                           │                     │
                           │  Results (scored)   │
                           │                     │
                  ┌────────▼─────────────────────▼────────┐
                  │  Reciprocal Rank Fusion (RRF)         │
                  ├────────────────────────────────────────┤
                  │  For each result:                     │
                  │    score = Σ(1 / (k + rank))          │
                  │      k = 60 (RRF constant)            │
                  │                                       │
                  │  Merge & deduplicate by chunk_id      │
                  │  Sort by combined score               │
                  └────────┬───────────────────────────────┘
                           │
                  ┌────────▼───────────────────────────────┐
                  │  Metadata Boosting                     │
                  ├────────────────────────────────────────┤
                  │  • Section title match: ×1.5           │
                  │  • Document path match: ×1.15          │
                  │  • Technical query + code: ×1.2        │
                  │  • Recency (if time-sensitive): ×1.1   │
                  └────────┬───────────────────────────────┘
                           │
                  ┌────────▼───────────────────────────────┐
                  │  Return Top K (default 10)             │
                  │  Sorted by final boosted score         │
                  └────────────────────────────────────────┘

Example Results:
┌────┬──────────────────────────┬───────────┬──────────┬────────────┐
│Rank│       Chunk Title        │  Semantic │ Keyword  │ Final Score│
│    │                          │   Score   │  Score   │  (boosted) │
├────┼──────────────────────────┼───────────┼──────────┼────────────┤
│  1 │ PGVector RAG Setup       │   0.95    │  0.88    │    1.92    │
│  2 │ Hybrid Search with RRF   │   0.89    │  0.92    │    1.85    │
│  3 │ Embedding Generation     │   0.91    │  0.75    │    1.68    │
│  4 │ Vector Index Tuning      │   0.82    │  0.79    │    1.55    │
│  5 │ RAG Prompting Strategies │   0.78    │  0.81    │    1.52    │
└────┴──────────────────────────┴───────────┴──────────┴────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION DEPLOYMENT                           │
│                    Docker Compose (Local/Staging)                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          HOST MACHINE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │               Docker Network (bridge)                       │    │
│  │                                                             │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │  Frontend Container                                   │  │    │
│  │  │  ┌──────────────────────────────────────────────┐    │  │    │
│  │  │  │  Nginx + React Build                         │    │  │    │
│  │  │  │  Port: 5173 → Host                          │    │  │    │
│  │  │  └──────────────────────────────────────────────┘    │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  │                           │                                 │    │
│  │                           │ HTTP                            │    │
│  │                           │                                 │    │
│  │  ┌────────────────────────▼─────────────────────────────┐  │    │
│  │  │  Backend Container                                    │  │    │
│  │  │  ┌──────────────────────────────────────────────┐    │  │    │
│  │  │  │  FastAPI + LangGraph                         │    │  │    │
│  │  │  │  Port: 8500 → Host                          │    │  │    │
│  │  │  │  Env:                                        │    │  │    │
│  │  │  │  • DATABASE_URL                              │    │  │    │
│  │  │  │  • REDIS_URL                                 │    │  │    │
│  │  │  │  • GEMINI_API_KEY                            │    │  │    │
│  │  │  └──────────────────────────────────────────────┘    │  │    │
│  │  └──────────────────────┬───────────────┬───────────────┘  │    │
│  │                         │               │                  │    │
│  │                         │ SQL           │ Redis            │    │
│  │                         │               │                  │    │
│  │  ┌──────────────────────▼──────┐  ┌─────▼──────────────┐  │    │
│  │  │  PostgreSQL Container        │  │ Redis Container    │  │    │
│  │  │  ┌────────────────────────┐  │  │ ┌────────────────┐ │  │    │
│  │  │  │  PostgreSQL 15         │  │  │ │  Redis 7       │ │  │    │
│  │  │  │  + PGVector extension  │  │  │ │  Port: 6379    │ │  │    │
│  │  │  │  Port: 5437 → Host     │  │  │ │  Persistence:  │ │  │    │
│  │  │  │  Volume: pgdata        │  │  │ │  • AOF enabled │ │  │    │
│  │  │  └────────────────────────┘  │  │ └────────────────┘ │  │    │
│  │  └─────────────────────────────┘  └────────────────────┘  │    │
│  │                                                             │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │  Langfuse Container (Optional)                        │  │    │
│  │  │  ┌──────────────────────────────────────────────┐    │  │    │
│  │  │  │  Langfuse Observability                      │    │  │    │
│  │  │  │  Port: 3000                                  │    │  │    │
│  │  │  └──────────────────────────────────────────────┘    │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  │                                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Volumes:                                                            │
│  • ./backend:/app/backend (dev only)                                │
│  • ./frontend:/app/frontend (dev only)                              │
│  • pgdata:/var/lib/postgresql/data (persistent)                     │
│  • redis-data:/data (persistent)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Agent Status Grid (Frontend Component)

```
┌─────────────────────────────────────────────────────────────────────┐
│              AGENT STATUS GRID (Real-time via SSE)                   │
│                 AnalysisProgressCard Component                       │
└─────────────────────────────────────────────────────────────────────┘

╔═════════════════════════════════════════════════════════════════════╗
║  Analysis Progress              Status: Running        Progress: 45%║
║  https://example.com/article                                   [×]  ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ┌────────────────────────────────────────────────────────────┐    ║
║  │ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  45% │    ║
║  └────────────────────────────────────────────────────────────┘    ║
║                                                                      ║
║  Agent Status:                                                       ║
║                                                                      ║
║  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ║
║  │ Tech Comparator  │  │ Security Auditor │  │ Impl. Planner    │  ║
║  │                  │  │                  │  │                  │  ║
║  │      [✓]         │  │      [✓]         │  │      [▶]         │  ║
║  │   Completed      │  │   Completed      │  │    Running       │  ║
║  │   2.3s           │  │   3.1s           │  │   1.2s elapsed   │  ║
║  └──────────────────┘  └──────────────────┘  └──────────────────┘  ║
║                                                                      ║
║  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ║
║  │ Tutorial Opt.    │  │ Conceptual Exp.  │  │ Code Reviewer    │  ║
║  │                  │  │                  │  │                  │  ║
║  │      [○]         │  │      [○]         │  │      [○]         │  ║
║  │    Pending       │  │    Pending       │  │    Pending       │  ║
║  │                  │  │                  │  │                  │  ║
║  └──────────────────┘  └──────────────────┘  └──────────────────┘  ║
║                                                                      ║
║  ┌──────────────────┐  ┌──────────────────┐                         ║
║  │ Learning Path    │  │ Socratic Tutor   │                         ║
║  │                  │  │                  │                         ║
║  │      [○]         │  │      [○]         │                         ║
║  │    Pending       │  │    Pending       │                         ║
║  │                  │  │                  │                         ║
║  └──────────────────┘  └──────────────────┘                         ║
║                                                                      ║
║  Legend:                                                             ║
║  [✓] Completed  [▶] Running  [○] Pending  [✗] Failed                ║
║                                                                      ║
║  [ Cancel Analysis ]                                                 ║
╚═════════════════════════════════════════════════════════════════════╝
```

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│            MULTI-LEVEL CACHING (70-95% Cost Reduction)               │
└─────────────────────────────────────────────────────────────────────┘

Request: "Analyze https://example.com/article"
    │
    └──────────────────┬──────────────────────────┐
                       │                          │
              ┌────────▼────────┐        ┌────────▼────────┐
              │  L1: In-Memory  │        │ L2: Redis       │
              │  Cache (LRU)    │        │  Semantic Cache │
              ├─────────────────┤        ├─────────────────┤
              │ • Hot prompts   │        │ • Hash prompt   │
              │ • Recent queries│        │ • Cosine sim    │
              │ • TTL: 5 min    │        │   > 0.95 = hit  │
              │ • Max: 100 items│        │ • TTL: 1 hour   │
              └────────┬────────┘        └────────┬────────┘
                   Hit │                      Hit │
                       └──────────────┬───────────┘
                                      │
                                Miss  │
                              ┌───────▼────────┐
                              │ L3: PostgreSQL │
                              │  Result Cache  │
                              ├────────────────┤
                              │ • Full analysis│
                              │   results      │
                              │ • URL-based    │
                              │ • TTL: 7 days  │
                              └────────┬───────┘
                                   Hit │
                                       │
                                  Miss │
                              ┌────────▼────────┐
                              │  Execute LLM    │
                              │  (Gemini API)   │
                              ├─────────────────┤
                              │ • Full cost     │
                              │ • Store in all  │
                              │   cache levels  │
                              └─────────────────┘

Cache Hit Rates (Production):
┌─────────────┬──────────┬───────────────┬──────────────┐
│ Cache Level │ Hit Rate │ Avg Latency   │ Cost Savings │
├─────────────┼──────────┼───────────────┼──────────────┤
│ L1 Memory   │   25%    │    < 1ms      │     100%     │
│ L2 Redis    │   45%    │    5-10ms     │     100%     │
│ L3 Postgres │   15%    │    50-100ms   │     100%     │
│ LLM API     │   15%    │   2000-5000ms │      0%      │
├─────────────┼──────────┼───────────────┼──────────────┤
│ Overall     │   85%    │    ~200ms     │     85%      │
└─────────────┴──────────┴───────────────┴──────────────┘
```

---

**Diagram Conventions:**
- `┌─┐ └─┘` Single-line boxes for components
- `╔═╗ ╚═╝` Double-line boxes for emphasis/grouping
- `→ ⇒` Arrows for data flow
- `[✓] [✗] [○] [▶]` Status indicators
- `████░░░░` Progress bars (filled/empty blocks)
