---
title: Analytics Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Data Integrity (data) -- CRITICAL -- 1 rule

Privacy and data safety patterns for analytics collection.

- `data-privacy.md` -- Hash project IDs, never log PII, local-only data

## 2. Cost & Tokens (cost) -- HIGH -- 1 rule

Accurate token cost estimation with cache-aware pricing.

- `cost-calculation.md` -- Separate pricing per token type, cache savings formula

## 3. Performance (large-file) -- HIGH -- 1 rule

Handle large JSONL files without memory issues.

- `large-file-streaming.md` -- Streaming jq for >50MB files, rotation-aware queries

## 4. Data Visualization (visualization) -- HIGH -- 2 rules

Dashboard layouts and Recharts chart components for data-driven UIs.

- `visualization-recharts.md` -- Recharts 3.x charts, ResponsiveContainer, custom tooltips, accessibility
- `visualization-dashboards.md` -- Dashboard grids, stat cards, widget registry, real-time SSE updates
