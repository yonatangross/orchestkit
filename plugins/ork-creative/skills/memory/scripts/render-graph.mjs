#!/usr/bin/env node

/**
 * render-graph.mjs - Render OrchestKit knowledge graph as interactive HTML
 *
 * Usage:
 *   node scripts/render-graph.mjs [--layout LR] [--category <cat>] [--recent N]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ENTITY_TYPES,
  makeNodeId,
  inferEntityType,
  normalizeEntity,
  normalizeRelation,
  getProjectDir,
  readJsonl,
  openInBrowser,
} from './graph-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Script-specific config
// ---------------------------------------------------------------------------

const EDGE_SYNTAX = {
  CHOSE:      '-->',
  CHOSE_OVER: '-..->',
  MENTIONS:   '-.->',
  CONSTRAINT: '-->',
  TRADEOFF:   '-..->',
  RELATES_TO: '-.->',
  SOLVED_BY:  '-->',
  PREFERS:    '-->',
};

const SUBGRAPH_LABELS = {
  Decision:   'Decisions',
  Preference: 'Preferences',
  Problem:    'Problems',
  Solution:   'Solutions',
  Technology: 'Technologies',
  Pattern:    'Patterns',
  Tool:       'Tools',
  Workflow:   'Workflows',
};

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { layout: 'TD', category: null, recent: null, limit: 50 };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--layout': args.layout = argv[++i] || 'TD'; break;
      case '--category': args.category = argv[++i]; break;
      case '--recent': args.recent = parseInt(argv[++i], 10); break;
      case '--limit': args.limit = parseInt(argv[++i], 10); break;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Mermaid helpers
// ---------------------------------------------------------------------------

function truncateLabel(label, max = 40) {
  return label.length > max ? label.slice(0, max - 1) + '\u2026' : label;
}

function escMermaid(str) {
  return str.replace(/"/g, "'").replace(/[[\]{}()#&]/g, ' ').trim();
}

function darken(hex) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * 0.7);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * 0.7);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * 0.7);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Build graph model from decisions
// ---------------------------------------------------------------------------

function buildGraphModel(records) {
  const entityMap = new Map();
  const relations = [];

  for (const rec of records) {
    const primaryType = rec.type === 'decision' ? 'Decision'
      : rec.type === 'preference' ? 'Preference'
      : rec.type === 'problem-solution' ? 'Problem'
      : rec.type === 'pattern' ? 'Pattern'
      : rec.type === 'workflow' ? 'Workflow'
      : 'Decision';

    const primaryName = rec.content?.what || rec.id || 'Unknown';
    mergeEntity(entityMap, {
      name: primaryName,
      entityType: primaryType,
      observations: rec.content?.why ? [rec.content.why] : [],
    });

    if (Array.isArray(rec.entities)) {
      for (const raw of rec.entities) {
        const entity = normalizeEntity(raw);
        mergeEntity(entityMap, entity);
      }
    }

    if (Array.isArray(rec.relations)) {
      for (const rel of rec.relations) {
        relations.push(normalizeRelation(rel));
      }
    }

    if (rec.content?.alternatives && rec.entities?.length > 0) {
      const chosen = Array.isArray(rec.entities)
        ? normalizeEntity(rec.entities[0]).name
        : primaryName;
      for (const alt of rec.content.alternatives) {
        mergeEntity(entityMap, { name: alt, entityType: inferEntityType(alt), observations: [`Rejected alternative`] });
        const exists = relations.some(r => r.from === chosen && r.to === alt && r.relationType === 'CHOSE_OVER');
        if (!exists) {
          relations.push({ from: chosen, to: alt, relationType: 'CHOSE_OVER' });
        }
      }
    }
  }

  return { entityMap, relations };
}

function mergeEntity(map, entity) {
  const existing = map.get(entity.name);
  if (existing) {
    const obsSet = new Set([...existing.observations, ...entity.observations]);
    existing.observations = [...obsSet];
  } else {
    map.set(entity.name, { ...entity });
  }
}

// ---------------------------------------------------------------------------
// Build Mermaid code
// ---------------------------------------------------------------------------

function buildMermaid(entityMap, relations, layout) {
  const lines = [`graph ${layout}`];

  for (const [, cfg] of Object.entries(ENTITY_TYPES)) {
    lines.push(`    classDef ${cfg.className} fill:${cfg.color},stroke:${darken(cfg.color)},color:#fff`);
  }
  lines.push('');

  const groups = {};
  for (const [name, ent] of entityMap) {
    const t = ent.entityType || 'Pattern';
    if (!groups[t]) groups[t] = [];
    groups[t].push({ name, ...ent });
  }

  for (const [type, label] of Object.entries(SUBGRAPH_LABELS)) {
    const items = groups[type];
    if (!items || items.length === 0) continue;
    lines.push(`    subgraph ${label}`);
    for (const ent of items) {
      const id = makeNodeId(type, ent.name);
      const className = ENTITY_TYPES[type]?.className || 'pattern';
      lines.push(`        ${id}["${escMermaid(truncateLabel(ent.name))}"]:::${className}`);
    }
    lines.push('    end');
    lines.push('');
  }

  const edgeSet = new Set();
  for (const rel of relations) {
    const fromType = findEntityType(entityMap, rel.from);
    const toType = findEntityType(entityMap, rel.to);
    const fromId = makeNodeId(fromType, rel.from);
    const toId = makeNodeId(toType, rel.to);
    if (fromId === toId) continue;
    const syntax = EDGE_SYNTAX[rel.relationType] || '-.->';
    const edgeKey = `${fromId}-${rel.relationType}-${toId}`;
    if (edgeSet.has(edgeKey)) continue;
    edgeSet.add(edgeKey);
    lines.push(`    ${fromId} ${syntax}|${rel.relationType}| ${toId}`);
  }

  return lines.join('\n');
}

function findEntityType(entityMap, name) {
  const ent = entityMap.get(name);
  if (ent) return ent.entityType || 'Pattern';
  return inferEntityType(name);
}

// ---------------------------------------------------------------------------
// Build stats HTML
// ---------------------------------------------------------------------------

function buildStatsHtml(entityMap, relations, queueDepth, records) {
  const counts = {};
  for (const [, ent] of entityMap) {
    const t = ent.entityType || 'Pattern';
    counts[t] = (counts[t] || 0) + 1;
  }

  const relCounts = {};
  for (const r of relations) {
    relCounts[r.relationType] = (relCounts[r.relationType] || 0) + 1;
  }

  const timestamps = records
    .map(r => r.metadata?.timestamp)
    .filter(Boolean)
    .sort();
  const timeSpan = timestamps.length > 0
    ? `${timestamps[0].slice(0, 10)} to ${timestamps[timestamps.length - 1].slice(0, 10)}`
    : 'N/A';

  const cards = [
    { title: 'Total Entities', value: entityMap.size, detail: Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ') },
    { title: 'Total Relations', value: relations.length, detail: Object.entries(relCounts).map(([k, v]) => `${k}: ${v}`).join(', ') },
    { title: 'Time Span', value: timeSpan, detail: `${records.length} decision records` },
    { title: 'Queue Depth', value: queueDepth, detail: 'Pending graph operations' },
  ];

  const html = `<div class="stats-panel">\n` +
    cards.map(c => `    <div class="stat-card">
      <h3>${c.title}</h3>
      <div class="value">${c.value}</div>
      <div class="detail">${c.detail}</div>
    </div>`).join('\n') +
    '\n  </div>';

  return html;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);
  const projectDir = getProjectDir();
  const memoryDir = join(projectDir, '.claude', 'memory');
  const decisionsPath = join(memoryDir, 'decisions.jsonl');
  const queuePath = join(memoryDir, 'graph-queue.jsonl');
  const outputPath = join(memoryDir, 'graph.html');
  const templatePath = join(__dirname, 'graph-template.html');

  let records = readJsonl(decisionsPath);
  const queueRecords = readJsonl(queuePath);

  if (records.length === 0) {
    console.log('No memories stored yet. Use `/ork:remember` to start building your knowledge graph.');
    process.exit(0);
  }

  if (args.category) {
    records = records.filter(r => r.metadata?.category === args.category);
    if (records.length === 0) {
      console.log(`No decisions found for category '${args.category}'.`);
      process.exit(0);
    }
  }

  if (args.recent) {
    records.sort((a, b) => (b.metadata?.timestamp || '').localeCompare(a.metadata?.timestamp || ''));
    records = records.slice(0, args.recent);
  }

  const { entityMap, relations } = buildGraphModel(records);

  let layout = args.layout;
  if (entityMap.size > args.limit) {
    const connectionCounts = new Map();
    for (const [name] of entityMap) connectionCounts.set(name, 0);
    for (const rel of relations) {
      connectionCounts.set(rel.from, (connectionCounts.get(rel.from) || 0) + 1);
      connectionCounts.set(rel.to, (connectionCounts.get(rel.to) || 0) + 1);
    }
    const sorted = [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]);
    const keep = new Set(sorted.slice(0, args.limit).map(([name]) => name));
    for (const [name] of entityMap) {
      if (!keep.has(name)) entityMap.delete(name);
    }
    layout = 'LR';
    console.log(`Showing ${args.limit} of ${connectionCounts.size} entities (most connected).`);
  }

  const mermaidCode = buildMermaid(entityMap, relations, layout);
  const statsHtml = buildStatsHtml(entityMap, relations, queueRecords.length, records);

  if (!existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
  }
  let html = readFileSync(templatePath, 'utf-8');

  const subtitle = args.category
    ? `Category: ${args.category} | ${records.length} records`
    : `${records.length} records | ${entityMap.size} entities | ${relations.length} relations`;

  html = html.replace(/\{\{TITLE\}\}/g, 'OrchestKit Knowledge Graph');
  html = html.replace(/\{\{SUBTITLE\}\}/g, subtitle);
  html = html.replace(/\{\{MERMAID_CODE\}\}/g, mermaidCode);
  html = html.replace(/\{\{STATS_HTML\}\}/g, statsHtml);

  if (!existsSync(dirname(outputPath))) {
    mkdirSync(dirname(outputPath), { recursive: true });
  }
  writeFileSync(outputPath, html, 'utf-8');
  console.log(`Graph written to ${outputPath}`);

  console.log(`\nGraph Statistics:`);
  console.log(`- Entities: ${entityMap.size}`);
  console.log(`- Relations: ${relations.length}`);
  console.log(`- Records: ${records.length}`);
  console.log(`- Queue depth: ${queueRecords.length} pending operations`);

  openInBrowser(outputPath);
}

// ---------------------------------------------------------------------------
// Entry point guard + exports for testability
// ---------------------------------------------------------------------------

const isMainModule = resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '');
if (isMainModule) main();

export { main, buildGraphModel, buildMermaid, parseArgs };
