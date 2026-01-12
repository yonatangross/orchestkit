# ASCII Diagram Templates

Comprehensive templates for creating clear, maintainable ASCII diagrams for documentation, architecture, and workflows.

## Box Drawing Characters

### Basic Box Drawing
```
┌─────────────┐
│   Simple    │
│     Box     │
└─────────────┘

╔═════════════╗
║   Double    ║
║     Box     ║
╚═════════════╝

╭─────────────╮
│   Rounded   │
│     Box     │
╰─────────────╯
```

### Arrows
```
Single: → ← ↑ ↓ ↔ ↕
Double: ⇒ ⇐ ⇑ ⇓ ⇔ ⇕
Curved: ↰ ↱ ↲ ↳
Heavy:  ➜ ➝ ➞ ➟
```

### Connectors
```
├─    Branch point (middle)
└─    Branch point (end)
┬─    T-junction (down)
┴─    T-junction (up)
┼─    Cross junction
```

## System Architecture Diagrams

### Client-Server Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                          │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │  Browser  │  │  Mobile   │  │  Desktop  │               │
│  │    App    │  │    App    │  │    App    │               │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘               │
│        │              │              │                      │
│        └──────────────┼──────────────┘                      │
│                       │                                     │
└───────────────────────┼─────────────────────────────────────┘
                        │
                     HTTPS/WSS
                        │
┌───────────────────────┼─────────────────────────────────────┐
│                       ▼      API GATEWAY                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐       │
│  │  Load Balancer (Nginx/Traefik)                   │       │
│  └────────────┬─────────────────────┬─────────────┬─┘       │
│               │                     │             │         │
│        ┌──────▼─────┐        ┌──────▼─────┐ ┌────▼────┐    │
│        │  API       │        │  API       │ │  API    │    │
│        │  Server 1  │        │  Server 2  │ │  Server │    │
│        └──────┬─────┘        └──────┬─────┘ └────┬────┘    │
└───────────────┼─────────────────────┼────────────┼─────────┘
                │                     │            │
         ┌──────┴─────────────────────┴────────────┘
         │
┌────────▼─────────────────────────────────────────────────────┐
│                     APPLICATION TIER                          │
├───────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Service A  │  │   Service B  │  │   Service C  │       │
│  │  (FastAPI)   │  │  (FastAPI)   │  │ (LangGraph)  │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
└─────────┼─────────────────┼─────────────────┼────────────────┘
          │                 │                 │
          └────────┬────────┴─────────┬───────┘
                   │                  │
┌──────────────────▼──────────────────▼────────────────────────┐
│                      DATA TIER                                │
├───────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐     │
│  │  PostgreSQL   │  │     Redis     │  │   S3/Blob    │     │
│  │  (Primary)    │  │    (Cache)    │  │   Storage    │     │
│  └───────┬───────┘  └───────────────┘  └──────────────┘     │
│          │                                                    │
│  ┌───────▼───────┐                                           │
│  │  PostgreSQL   │                                           │
│  │  (Replica)    │                                           │
│  └───────────────┘                                           │
└───────────────────────────────────────────────────────────────┘
```

### Microservices Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Kong/Traefik)                │
│         Authentication │ Rate Limiting │ Routing             │
└────────────┬────────────┴───────────────┬───────────────────┘
             │                            │
    ┌────────▼────────┐          ┌────────▼────────┐
    │  Auth Service   │          │  User Service   │
    │  ┌───────────┐  │          │  ┌───────────┐  │
    │  │  FastAPI  │  │          │  │  FastAPI  │  │
    │  └─────┬─────┘  │          │  └─────┬─────┘  │
    │        │        │          │        │        │
    │  ┌─────▼─────┐  │          │  ┌─────▼─────┐  │
    │  │  Postgres │  │          │  │  Postgres │  │
    │  └───────────┘  │          │  └───────────┘  │
    └─────────────────┘          └─────────────────┘
             │                            │
             └────────────┬───────────────┘
                          │
              ┌───────────▼───────────┐
              │   Message Bus (Redis) │
              │    PubSub/Streams     │
              └───────────┬───────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼────────┐ ┌──────▼──────┐ ┌────────▼───────┐
│  Analysis      │ │  Artifact   │ │  Notification  │
│  Service       │ │  Service    │ │  Service       │
│  ┌──────────┐  │ │  ┌───────┐  │ │  ┌──────────┐  │
│  │LangGraph │  │ │  │FastAPI│  │ │  │  Worker  │  │
│  └────┬─────┘  │ │  └───┬───┘  │ │  └────┬─────┘  │
│       │        │ │      │      │ │       │        │
│  ┌────▼─────┐  │ │  ┌───▼───┐  │ │  ┌────▼─────┐  │
│  │ PGVector │  │ │  │ Blob  │  │ │  │  Queue   │  │
│  └──────────┘  │ │  └───────┘  │ │  └──────────┘  │
└────────────────┘ └─────────────┘ └────────────────┘
```

## Data Flow Diagrams

### Request/Response Flow
```
User                Frontend             Backend              Database
 │                     │                    │                    │
 │  1. Click Submit    │                    │                    │
 ├────────────────────►│                    │                    │
 │                     │  2. POST /api/     │                    │
 │                     ├───────────────────►│                    │
 │                     │                    │  3. INSERT query   │
 │                     │                    ├───────────────────►│
 │                     │                    │                    │
 │                     │                    │  4. New record ID  │
 │                     │                    │◄───────────────────┤
 │                     │  5. 201 Created    │                    │
 │                     │◄───────────────────┤                    │
 │  6. Show success    │                    │                    │
 │◄────────────────────┤                    │                    │
 │                     │                    │                    │
```

### Async Event Flow
```
Client              API Server          Worker Queue         Worker Process
 │                      │                     │                     │
 │  1. POST /analyze    │                     │                     │
 ├─────────────────────►│                     │                     │
 │                      │  2. Enqueue job     │                     │
 │                      ├────────────────────►│                     │
 │  3. 202 Accepted     │                     │                     │
 │◄─────────────────────┤                     │                     │
 │                      │                     │  4. Dequeue job     │
 │                      │                     │────────────────────►│
 │                      │                     │                     │
 │  5. Connect SSE      │                     │                     │
 ├─────────────────────►│                     │                     │
 │                      │                     │  6. Process & emit  │
 │                      │                     │         events      │
 │  ╔═══════════════════╪═════════════════════╪═════════════════════╗
 │  ║ 7. SSE Stream     │                     │                     ║
 │  ║ ┌─────────────────────────────────────────────────────────┐  ║
 │◄─║─┤ data: {"progress": 25, "status": "processing"}          │  ║
 │  ║ └─────────────────────────────────────────────────────────┘  ║
 │  ║ ┌─────────────────────────────────────────────────────────┐  ║
 │◄─║─┤ data: {"progress": 50, "agent": "Tech Comparator"}      │  ║
 │  ║ └─────────────────────────────────────────────────────────┘  ║
 │  ║ ┌─────────────────────────────────────────────────────────┐  ║
 │◄─║─┤ data: {"progress": 100, "status": "complete"}           │  ║
 │  ║ └─────────────────────────────────────────────────────────┘  ║
 │  ╚═══════════════════╪═════════════════════╪═════════════════════╝
 │  8. Close connection │                     │                     │
 ├─────────────────────►│                     │                     │
 │                      │                     │                     │
```

## Component Diagrams

### Layered Component Structure
```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   HomePage   │  │  AnalysisPage│  │ ArtifactPage │      │
│  │  Component   │  │   Component  │  │  Component   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └────────┬─────────┴─────────┬────────┘
                   │                   │
┌──────────────────▼───────────────────▼─────────────────────┐
│                    BUSINESS LOGIC LAYER                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   useAnalysis│  │   useArtifact│  │   useSSE     │     │
│  │     Hook     │  │     Hook     │  │    Hook      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          └────────┬─────────┴─────────┬────────┘
                   │                   │
┌──────────────────▼───────────────────▼─────────────────────┐
│                      API CLIENT LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Axios      │  │   SSE Client │  │   WebSocket  │     │
│  │   Instance   │  │              │  │   Client     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          └────────┬─────────┴─────────┬────────┘
                   │                   │
                   ▼                   ▼
            Backend API          Event Streams
```

### React Component Tree
```
App
 │
 ├─ Layout
 │   ├─ Header
 │   │   ├─ Logo
 │   │   ├─ Navigation
 │   │   └─ UserMenu
 │   │
 │   ├─ Main
 │   │   └─ Routes
 │   │       ├─ HomePage
 │   │       │   ├─ UrlInputForm
 │   │       │   │   ├─ TextInput
 │   │       │   │   ├─ SelectDropdown
 │   │       │   │   └─ SubmitButton
 │   │       │   │
 │   │       │   └─ RecentAnalysesList
 │   │       │       └─ AnalysisCard (×N)
 │   │       │
 │   │       ├─ AnalysisProgressPage
 │   │       │   ├─ ProgressHeader
 │   │       │   │   ├─ StatusBadge
 │   │       │   │   └─ ProgressBar
 │   │       │   │
 │   │       │   ├─ AgentStatusGrid
 │   │       │   │   └─ AgentCard (×8)
 │   │       │   │       ├─ AgentIcon
 │   │       │   │       ├─ AgentName
 │   │       │   │       └─ StatusIndicator
 │   │       │   │
 │   │       │   └─ ActionButtons
 │   │       │       ├─ CancelButton
 │   │       │       └─ ViewArtifactButton
 │   │       │
 │   │       └─ ArtifactPage
 │   │           ├─ ArtifactHeader
 │   │           │   ├─ Title
 │   │           │   ├─ Metadata
 │   │           │   └─ Actions
 │   │           │
 │   │           ├─ TabNavigation
 │   │           │
 │   │           └─ ContentDisplay
 │   │               ├─ FindingsSection
 │   │               ├─ RecommendationsSection
 │   │               └─ MetricsSection
 │   │
 │   └─ Footer
 │       ├─ Copyright
 │       └─ Links
 │
 └─ Providers
     ├─ QueryClientProvider (React Query)
     ├─ ThemeProvider
     └─ ToastProvider
```

## Flow Charts

### Decision Flow
```
                    ┌─────────────┐
                    │    Start    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Validate   │
                    │    Input    │
                    └──────┬──────┘
                           │
                   ┌───────┴───────┐
                   │  Is Valid?    │
                   └───┬───────┬───┘
                    No │       │ Yes
           ┌───────────┘       └───────────┐
           │                                │
    ┌──────▼──────┐                  ┌──────▼──────┐
    │    Show     │                  │   Process   │
    │    Error    │                  │    Data     │
    └──────┬──────┘                  └──────┬──────┘
           │                                │
           │                         ┌──────▼──────┐
           │                         │  Save to DB │
           │                         └──────┬──────┘
           │                                │
           │                         ┌──────┴──────┐
           │                         │  Success?   │
           │                         └──┬──────┬───┘
           │                         No │      │ Yes
           │                ┌───────────┘      └───────────┐
           │                │                              │
           │         ┌──────▼──────┐              ┌────────▼────────┐
           │         │   Rollback  │              │  Show Success   │
           │         │   & Retry   │              │    Message      │
           │         └──────┬──────┘              └────────┬────────┘
           │                │                              │
           └────────────────┴──────────────────────────────┘
                            │
                     ┌──────▼──────┐
                     │     End     │
                     └─────────────┘
```

### Parallel Process Flow
```
                        ┌─────────────┐
                        │  Start Job  │
                        └──────┬──────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
         ┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
         │  Worker A   ││  Worker B   ││  Worker C   │
         │  (Parallel) ││  (Parallel) ││  (Parallel) │
         └──────┬──────┘└──────┬──────┘└──────┬──────┘
                │              │              │
                └──────────────┼──────────────┘
                               │
                        ┌──────▼──────┐
                        │  Aggregate  │
                        │   Results   │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │   Complete  │
                        └─────────────┘
```

## State Diagrams

### Application State Machine
```
┌────────────────────────────────────────────────────────────┐
│                   Analysis Lifecycle                        │
└────────────────────────────────────────────────────────────┘

  ┌──────────┐
  │   IDLE   │
  └────┬─────┘
       │ submit_url()
       │
  ┌────▼─────────┐
  │  VALIDATING  │
  └────┬─────┬───┘
       │     │ invalid
       │     └───────────┐
       │ valid           │
  ┌────▼─────────┐  ┌────▼─────┐
  │  PROCESSING  │  │  ERROR   │◄──────┐
  └────┬─────────┘  └──────────┘       │
       │                                │
       │ progress_update()              │
       │                                │
  ┌────▼─────────┐                      │
  │   RUNNING    │───────────────────────┤
  │  (0-100%)    │  failure              │
  └────┬─────┬───┘                      │
       │     │                          │
       │     │ cancel()                 │
       │     └──────────┐               │
       │                │               │
  ┌────▼─────────┐ ┌────▼─────────┐    │
  │  COMPLETED   │ │  CANCELLED   │    │
  └──────────────┘ └──────────────┘    │
                                        │
                      retry() ──────────┘
```

## Network Diagrams

### Deployment Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                  ┌──────────▼──────────┐
                  │   Cloudflare CDN    │
                  │  (SSL, DDoS, Cache) │
                  └──────────┬──────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                       DMZ (Firewall)                         │
│                             │                                │
│                  ┌──────────▼──────────┐                     │
│                  │   Load Balancer     │                     │
│                  │    (HAProxy)        │                     │
│                  └──┬───────────────┬──┘                     │
└─────────────────────┼───────────────┼─────────────────────────┘
                      │               │
        ┌─────────────┘               └─────────────┐
        │                                           │
┌───────▼────────────────────┐    ┌─────────────────▼────────┐
│  Web Tier (Public Subnet)  │    │  Web Tier (Public Subnet)│
│  ┌──────────────────────┐  │    │  ┌──────────────────────┐│
│  │  Nginx + React       │  │    │  │  Nginx + React       ││
│  │  10.0.1.10           │  │    │  │  10.0.1.11           ││
│  └──────────┬───────────┘  │    │  └──────────┬───────────┘│
└─────────────┼──────────────┘    └─────────────┼────────────┘
              │                                 │
              └────────────┬────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼───────┐  ┌───────▼──────┐
│  App Server  │  │  App Server    │  │  App Server  │
│  (Private)   │  │  (Private)     │  │  (Private)   │
│  10.0.2.10   │  │  10.0.2.11     │  │  10.0.2.12   │
└───────┬──────┘  └────────┬───────┘  └───────┬──────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼───────┐  ┌───────▼──────┐
│  PostgreSQL  │  │     Redis      │  │   Langfuse   │
│  (Primary)   │  │    (Cache)     │  │ (Observ.)    │
│  10.0.3.10   │  │  10.0.3.20     │  │ 10.0.3.30    │
└───────┬──────┘  └────────────────┘  └──────────────┘
        │
┌───────▼──────┐
│  PostgreSQL  │
│  (Replica)   │
│  10.0.3.11   │
└──────────────┘
```

## Tables

### Feature Comparison
```
┌─────────────────┬──────────┬──────────┬──────────┬──────────┐
│    Feature      │   Free   │   Pro    │  Team    │Enterprise│
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ Analyses/month  │    10    │   100    │   500    │ Unlimited│
│ Team members    │     1    │     1    │    10    │ Unlimited│
│ API access      │    ✗     │    ✓     │    ✓     │    ✓     │
│ SSO integration │    ✗     │    ✗     │    ✗     │    ✓     │
│ Custom agents   │    ✗     │    ✓     │    ✓     │    ✓     │
│ SLA guarantee   │    ✗     │    ✗     │   99.9%  │   99.99% │
│ Support         │  Email   │  Email   │  Phone   │ Dedicated│
│ Price/month     │   $0     │   $29    │   $99    │  Custom  │
└─────────────────┴──────────┴──────────┴──────────┴──────────┘
```

### API Endpoints
```
┌────────┬─────────────────────────┬─────────────┬──────────────────┐
│ Method │        Endpoint         │    Auth     │   Description    │
├────────┼─────────────────────────┼─────────────┼──────────────────┤
│  POST  │ /api/v1/analyses        │  Required   │ Create analysis  │
│  GET   │ /api/v1/analyses/:id    │  Required   │ Get analysis     │
│  GET   │ /api/v1/analyses/:id/   │  Required   │ SSE progress     │
│        │        stream           │             │   stream         │
│  DELETE│ /api/v1/analyses/:id    │  Required   │ Cancel analysis  │
│  GET   │ /api/v1/artifacts/:id   │  Required   │ Get artifact     │
│  GET   │ /api/v1/artifacts/:id/  │  Required   │ Download artifact│
│        │       download          │             │                  │
│  POST  │ /api/v1/auth/login      │  Public     │ User login       │
│  POST  │ /api/v1/auth/register   │  Public     │ User registration│
│  POST  │ /api/v1/auth/refresh    │  Public     │ Refresh token    │
└────────┴─────────────────────────┴─────────────┴──────────────────┘
```

## Timeline/Gantt

### Project Timeline
```
Sprint 1 (Weeks 1-2)
  ├─ Backend API Setup         ████████░░░░░░░░ (70% complete)
  ├─ Database Schema           ████████████████ (100% complete)
  └─ Frontend Scaffolding      ████████████░░░░ (80% complete)

Sprint 2 (Weeks 3-4)
  ├─ LangGraph Integration     ████████░░░░░░░░ (50% complete)
  ├─ SSE Implementation        ████░░░░░░░░░░░░ (30% complete)
  └─ UI Components             ██████░░░░░░░░░░ (40% complete)

Sprint 3 (Weeks 5-6)
  ├─ Agent Orchestration       ░░░░░░░░░░░░░░░░ (0% - not started)
  ├─ Testing & QA              ░░░░░░░░░░░░░░░░ (0% - not started)
  └─ Documentation             ████░░░░░░░░░░░░ (25% complete)

Legend: █ Complete  ░ Remaining
```

## Database Schema

### Entity Relationship Diagram
```
┌─────────────────────┐         ┌─────────────────────┐
│      Users          │         │     Analyses        │
├─────────────────────┤         ├─────────────────────┤
│ id (PK)             │         │ id (PK)             │
│ email               │         │ user_id (FK)        │───┐
│ password_hash       │         │ url                 │   │
│ created_at          │         │ status              │   │
│ updated_at          │         │ progress            │   │
└──────────┬──────────┘         │ created_at          │   │
           │                    │ completed_at        │   │
           │ 1                  └──────────┬──────────┘   │
           │                              │               │
           │                              │ 1             │
           │                              │               │
           │ *                            │               │
           └──────────────────────────────┘               │
                                                          │
┌─────────────────────┐                                   │
│     Artifacts       │                                   │
├─────────────────────┤                                   │
│ id (PK)             │                                   │
│ analysis_id (FK)    │───────────────────────────────────┘
│ content             │
│ quality_score       │
│ metadata            │
│ created_at          │
└──────────┬──────────┘
           │
           │ 1
           │
           │ *
┌──────────▼──────────┐
│      Chunks         │
├─────────────────────┤
│ id (PK)             │
│ artifact_id (FK)    │
│ content             │
│ embedding           │
│ metadata            │
└─────────────────────┘
```

## Best Practices

### 1. Consistency
- Use same box style throughout document (single/double/rounded)
- Align columns consistently
- Use consistent arrow types for same relationship types

### 2. Clarity
- Add labels to all connections
- Use whitespace effectively
- Group related components
- Add legends when using symbols

### 3. Readability
- Keep diagrams focused (one concept per diagram)
- Use hierarchy (indent subordinate elements)
- Limit width to ~70-80 characters
- Break complex diagrams into multiple views

### 4. Maintenance
- Document diagram purpose at top
- Add last-updated date
- Version control complex diagrams
- Use comments for complex sections

### 5. Tools
- Test rendering in target environment (GitHub, editors)
- Use monospace fonts
- Check on different screen sizes
- Export to images for presentations

## Quick Reference

### Box Corners
```
┌ ┐ └ ┘  Single line
╔ ╗ ╚ ╝  Double line
╭ ╮ ╰ ╯  Rounded
```

### Lines
```
─  Horizontal single
═  Horizontal double
│  Vertical single
║  Vertical double
```

### Junctions
```
├ ┤  T-junction single
╠ ╣  T-junction double
┬ ┴  T-junction horizontal
┼   Cross junction
```

### Symbols
```
✓ ✗  Checkmark/X
★ ☆  Star filled/empty
● ○  Circle filled/empty
■ □  Square filled/empty
▲ △  Triangle filled/empty
→ ⇒  Arrow single/double
```
