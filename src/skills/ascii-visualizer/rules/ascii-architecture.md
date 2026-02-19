---
title: ASCII Architecture Visualization Patterns
impact: MEDIUM
impactDescription: "Structured architecture diagrams communicate system design clearly without external tools"
tags: ascii, architecture, system-design, components, flow, comparison
---

## ASCII Architecture Visualization Patterns

**Incorrect — flat text descriptions:**
```
The system has a frontend that talks to a backend API which uses
a database and a cache layer. There's also a message queue for
async processing.
```

**Correct — layered architecture diagram:**
```
┌─────────────────────────────────────────────────────┐
│                    Load Balancer                      │
└──────────┬──────────────────────────┬────────────────┘
           │                          │
┌──────────v──────────┐  ┌───────────v────────────┐
│   API Gateway       │  │   API Gateway          │
│   (instance 1)      │  │   (instance 2)         │
└──────────┬──────────┘  └───────────┬────────────┘
           │                          │
           └──────────┬───────────────┘
                      │
        ┌─────────────┼────────────────┐
        │             │                │
┌───────v──────┐ ┌────v─────┐ ┌───────v──────┐
│  PostgreSQL  │ │  Redis   │ │  RabbitMQ    │
│  (primary)   │ │  (cache) │ │  (queue)     │
└──────────────┘ └──────────┘ └──────────────┘
```

### Blast Radius Visualization

```
                Ring 3: Tests (8 files)
           +-------------------------------+
           |    Ring 2: Transitive (5)      |
           |   +------------------------+   |
           |   |  Ring 1: Direct (3)     |   |
           |   |   +--------------+      |   |
           |   |   | CHANGED FILE |      |   |
           |   |   +--------------+      |   |
           |   +------------------------+   |
           +-------------------------------+

Direct dependents:   auth.py, routes.py, middleware.py
Transitive:          app.py, config.py, utils.py, cli.py, server.py
```

### Reversibility Timeline

```
REVERSIBILITY TIMELINE
Phase 1  [================]  FULLY REVERSIBLE    (add column, nullable)
Phase 2  [================]  FULLY REVERSIBLE    (new endpoint, additive)
Phase 3  [============....]  PARTIALLY           (backfill data)
              --- POINT OF NO RETURN ---
Phase 4  [........????????]  IRREVERSIBLE        (drop old column)
Phase 5  [================]  FULLY REVERSIBLE    (frontend toggle)
```

### Comparison Tables

```
CROSS-LAYER CONSISTENCY
Backend Endpoint          Frontend Consumer     Status
POST /invoices            createInvoice()       PLANNED
GET  /invoices/:id        useInvoice(id)        PLANNED
GET  /invoices            InvoiceList.tsx        MISSING  !!
```

### Key Patterns

| Pattern | Use Case |
|---------|----------|
| Layered boxes | System architecture, deployment topology |
| Concentric rings | Blast radius, impact analysis |
| Timeline bars | Reversibility, migration phases |
| Swimlanes | Execution order, parallel work streams |
| Annotated trees | File change manifests, directory structures |
| Comparison tables | Cross-layer consistency, before/after |
