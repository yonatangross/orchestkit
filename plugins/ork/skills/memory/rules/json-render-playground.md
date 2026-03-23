---
title: json-render Playground Output
impact: MEDIUM
impactDescription: Generate playground output as json-render specs for multi-surface rendering
tags: [json-render, playground, multi-surface, interactive]
---

# json-render Playground Output

When generating the knowledge graph playground, choose between HTML mode and json-render mode based on where the output will be consumed.

## When to Use json-render Mode

- Playground needs to render inside an **MCP tool response** (Claude, Cursor, ChatGPT conversations)
- Output will be exported to **PDF or email** via `@json-render/pdf` or `@json-render/email`
- Playground data feeds a **mobile app** via React Native renderer
- You need **typed, validated output** -- catalog constraints prevent malformed dashboards
- Playground is part of an **eval pipeline** that aggregates results across surfaces

## When to Stick with HTML Mode

- **Standalone visualization** -- user opens the file in a browser, no runtime needed
- **Zero-dependency** requirement -- no npm packages, no build step
- **Interactive graph** needed -- vis-network provides drag, zoom, physics simulation that json-render does not replicate
- **Quick prototyping** -- fastest path from data to visual, single file output
- **Offline use** -- HTML with inlined vis-network works without network access

## Pattern: Playground Catalog Design

Define a catalog scoped to playground controls -- stats, tables, filters, and section containers:

```typescript
import { defineCatalog } from '@json-render/core'
import { z } from 'zod'

export const playgroundCatalog = defineCatalog({
  Card: {
    props: z.object({
      title: z.string(),
      description: z.string().optional(),
    }),
    children: true,
  },
  StatGrid: {
    props: z.object({
      items: z.array(z.object({
        label: z.string(),
        value: z.string(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
        color: z.enum(['green', 'red', 'yellow', 'blue']).optional(),
      })).max(20),
    }),
    children: false,
  },
  DataTable: {
    props: z.object({
      columns: z.array(z.object({ key: z.string(), label: z.string() })),
      rows: z.array(z.record(z.string())).max(100),
    }),
    children: false,
  },
  StatusBadge: {
    props: z.object({
      label: z.string(),
      status: z.enum(['success', 'warning', 'error', 'info', 'pending']),
    }),
    children: false,
  },
  FilterBar: {
    props: z.object({
      filters: z.array(z.object({
        key: z.string(),
        label: z.string(),
        options: z.array(z.object({
          value: z.string(),
          label: z.string(),
        })),
      })),
    }),
    children: false,
  },
})
```

## Spec Generation Flow

```
decisions.jsonl + graph-queue.jsonl
        |
        v
  buildPlaygroundData()        ← existing function, unchanged
        |
        v
  ┌─────────────────────────┐
  │  --format flag?         │
  │  html (default) → HTML  │
  │  json-render → spec     │
  └─────────────────────────┘
        |
        v (json-render path)
  Map PlaygroundData → json-render spec
    - stats → StatGrid element
    - decisions → DataTable element
    - entities → DataTable element
    - sessions → DataTable element
    - queue health → StatusBadge element
        |
        v
  Output spec as JSON (stdout or --output file)
```

**Incorrect:**
```typescript
// Hand-coding HTML for a playground that needs multi-surface output
function renderPlayground(data: PlaygroundData): string {
  return `<html>
    <div class="stats">${data.stats.totalEntities} entities</div>
    <table>${data.decisions.map(d => `<tr><td>${d.id}</td></tr>`).join('')}</table>
  </html>`
}
// Problem: only works in browsers, no type safety, no MCP integration
```

**Correct:**
```typescript
// json-render catalog + spec generation for multi-surface output
import { playgroundCatalog } from './playground-catalog'

function renderPlaygroundSpec(data: PlaygroundData): JsonRenderSpec {
  return {
    root: 'playground',
    elements: {
      playground: {
        type: 'Card',
        props: { title: 'Knowledge Graph Playground' },
        children: ['stats', 'entities', 'decisions'],
      },
      stats: {
        type: 'StatGrid',
        props: {
          items: [
            { label: 'Entities', value: String(data.stats.totalEntities), trend: 'up' },
            { label: 'Relations', value: String(data.stats.totalRelations), trend: 'flat' },
            { label: 'Decisions', value: String(data.stats.totalDecisions), trend: 'up' },
            { label: 'Sessions', value: String(data.stats.totalSessions), trend: 'flat' },
          ],
        },
      },
      entities: {
        type: 'DataTable',
        props: {
          columns: [
            { key: 'name', label: 'Entity' },
            { key: 'type', label: 'Type' },
            { key: 'connections', label: 'Connections' },
          ],
          rows: data.nodes.map(n => ({
            name: n.name,
            type: n.entityType,
            connections: String(n.connectionCount),
          })),
        },
      },
      decisions: {
        type: 'DataTable',
        props: {
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'category', label: 'Category' },
            { key: 'timestamp', label: 'Date' },
          ],
          rows: data.decisions.map(d => ({
            id: d.id?.slice(0, 8) || 'unknown',
            category: d.metadata?.category || 'general',
            timestamp: d.metadata?.timestamp || '',
          })),
        },
      },
    },
  }
}
// Works in browser, MCP, PDF, mobile -- same spec, multiple renderers
```

## Key Constraints

- Keep the spec **flat** (2-3 levels max) for progressive streaming compatibility
- Cap `DataTable` rows at 100 with `.max(100)` -- large graphs should paginate or summarize
- The `StatGrid` maps directly to `buildPlaygroundData().stats` -- reuse the same data shape
- HTML mode remains the **default** -- json-render is opt-in via `--format json-render`
