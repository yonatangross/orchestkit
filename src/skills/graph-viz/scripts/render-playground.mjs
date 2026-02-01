#!/usr/bin/env node

/**
 * render-playground.mjs - Interactive Knowledge Graph Playground
 *
 * Reads decisions, queue, and flow data to build a full interactive
 * SPA with Graph, Decisions, Entities, and Stats tabs.
 *
 * Usage:
 *   node scripts/render-playground.mjs [--session <id>]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ENTITY_TYPES,
  makeNodeId,
  inferEntityType,
  normalizeEntity,
  normalizeRelation,
  classifyEdge,
  buildEntityNodeIdMap,
  getProjectDir,
  readJsonl,
  openInBrowser,
} from './graph-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { session: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--session') args.session = argv[++i];
  }
  return args;
}

// ---------------------------------------------------------------------------
// Flow reading
// ---------------------------------------------------------------------------

function readFlows(memoryDir) {
  const flowsDir = join(memoryDir, 'flows');
  if (!existsSync(flowsDir)) return [];
  const flows = [];
  for (const file of readdirSync(flowsDir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(join(flowsDir, file), 'utf-8'));
      flows.push(data);
    } catch { /* skip corrupt */ }
  }
  return flows;
}

// ---------------------------------------------------------------------------
// Build PlaygroundData
// ---------------------------------------------------------------------------

function buildPlaygroundData(records, queueRecords, flows) {
  const entityMap = new Map();
  const rawEdges = [];

  for (const rec of records) {
    const sessionId = rec.metadata?.session_id || 'unknown';

    if (Array.isArray(rec.entities)) {
      for (const raw of rec.entities) {
        const entity = normalizeEntity(raw);
        mergeEntity(entityMap, entity, sessionId, rec.id);
      }
    }

    if (rec.content?.alternatives && Array.isArray(rec.content.alternatives)) {
      for (const alt of rec.content.alternatives) {
        mergeEntity(entityMap, {
          name: alt,
          entityType: inferEntityType(alt),
          observations: ['Rejected alternative'],
        }, sessionId, rec.id);
      }

      if (rec.entities?.length > 0) {
        const chosen = normalizeEntity(rec.entities[0]).name;
        for (const alt of rec.content.alternatives) {
          const exists = rec.relations?.some(r => r.from === chosen && r.to === alt && r.relationType === 'CHOSE_OVER');
          if (!exists) {
            rawEdges.push({ from: chosen, to: alt, relationType: 'CHOSE_OVER', sessionId });
          }
        }
      }
    }

    if (Array.isArray(rec.relations)) {
      for (const rel of rec.relations) {
        const norm = normalizeRelation(rel);
        rawEdges.push({ ...norm, sessionId });
      }
    }
  }

  // Count connections per entity
  for (const edge of rawEdges) {
    const fromEnt = entityMap.get(edge.from);
    const toEnt = entityMap.get(edge.to);
    if (fromEnt) fromEnt.connectionCount++;
    if (toEnt) toEnt.connectionCount++;
  }

  // Pre-compute entity name -> node ID map
  const entityNodeIds = buildEntityNodeIdMap(entityMap);

  // Build nodes array
  const nodes = [];
  for (const [name, ent] of entityMap) {
    const entityType = ent.entityType || 'Pattern';
    nodes.push({
      id: makeNodeId(entityType, name),
      name,
      entityType,
      color: (ENTITY_TYPES[entityType] || ENTITY_TYPES.Pattern).color,
      observations: ent.observations,
      sessionIds: [...ent.sessionIds],
      sourceRecordIds: [...ent.sourceRecordIds],
      connectionCount: ent.connectionCount,
    });
  }

  // Build edges array (deduplicated)
  const edgeSet = new Set();
  const edges = [];
  for (const edge of rawEdges) {
    const fromType = entityMap.get(edge.from)?.entityType || inferEntityType(edge.from);
    const toType = entityMap.get(edge.to)?.entityType || inferEntityType(edge.to);
    const fromId = makeNodeId(fromType, edge.from);
    const toId = makeNodeId(toType, edge.to);
    if (fromId === toId) continue;
    const key = `${fromId}-${edge.relationType}-${toId}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push({
      from: fromId,
      to: toId,
      relationType: edge.relationType,
      edgeCategory: classifyEdge(edge.relationType),
      sessionId: edge.sessionId,
    });
  }

  // Build session index
  const sessions = buildSessionIndex(records, flows);

  // Build stats
  const entityCountsByType = {};
  for (const n of nodes) {
    entityCountsByType[n.entityType] = (entityCountsByType[n.entityType] || 0) + 1;
  }
  const relationCountsByType = {};
  for (const e of edges) {
    relationCountsByType[e.relationType] = (relationCountsByType[e.relationType] || 0) + 1;
  }
  const decisionCountsByCategory = {};
  for (const r of records) {
    const cat = r.metadata?.category || 'general';
    decisionCountsByCategory[cat] = (decisionCountsByCategory[cat] || 0) + 1;
  }

  const timestamps = records
    .map(r => r.metadata?.timestamp)
    .filter(Boolean)
    .sort();

  const stats = {
    totalEntities: nodes.length,
    totalRelations: edges.length,
    totalDecisions: records.length,
    totalSessions: sessions.length,
    queueDepth: queueRecords.length,
    entityCountsByType,
    relationCountsByType,
    decisionCountsByCategory,
    timeSpan: {
      from: timestamps[0] || '',
      to: timestamps[timestamps.length - 1] || '',
    },
  };

  return {
    nodes,
    edges,
    decisions: records,
    sessions,
    stats,
    entityNodeIds,
    generatedAt: new Date().toISOString(),
  };
}

function mergeEntity(map, entity, sessionId, recordId) {
  const existing = map.get(entity.name);
  if (existing) {
    const obsSet = new Set([...existing.observations, ...entity.observations]);
    existing.observations = [...obsSet];
    existing.sessionIds.add(sessionId);
    if (recordId) existing.sourceRecordIds.add(recordId);
  } else {
    map.set(entity.name, {
      ...entity,
      sessionIds: new Set([sessionId]),
      sourceRecordIds: new Set(recordId ? [recordId] : []),
      connectionCount: 0,
    });
  }
}

function buildSessionIndex(records, flows) {
  const sessionMap = new Map();

  for (const rec of records) {
    const sid = rec.metadata?.session_id;
    if (!sid) continue;
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, {
        id: sid,
        startedAt: rec.metadata.timestamp || '',
        decisionCount: 0,
        entityNames: new Set(),
      });
    }
    const s = sessionMap.get(sid);
    s.decisionCount++;
    if (rec.metadata.timestamp && (!s.startedAt || rec.metadata.timestamp < s.startedAt)) {
      s.startedAt = rec.metadata.timestamp;
    }
    if (Array.isArray(rec.entities)) {
      for (const e of rec.entities) {
        const name = typeof e === 'string' ? e : e.name;
        if (name) s.entityNames.add(name);
      }
    }
  }

  for (const flow of flows) {
    const sid = flow.session_id;
    if (!sid) continue;
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, {
        id: sid,
        startedAt: flow.started_at || '',
        decisionCount: 0,
        entityNames: new Set(),
      });
    }
    const s = sessionMap.get(sid);
    if (flow.started_at && (!s.startedAt || flow.started_at < s.startedAt)) {
      s.startedAt = flow.started_at;
    }
  }

  return [...sessionMap.entries()].map(([id, s]) => {
    const date = s.startedAt ? new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown';
    return {
      id,
      label: `${id.slice(0, 8)} \u2014 ${date} (${s.decisionCount} decisions)`,
      startedAt: s.startedAt,
      decisionCount: s.decisionCount,
      entityCount: s.entityNames.size,
    };
  }).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  parseArgs(process.argv); // validates CLI flags
  const projectDir = getProjectDir();
  const memoryDir = join(projectDir, '.claude', 'memory');
  const decisionsPath = join(memoryDir, 'decisions.jsonl');
  const queuePath = join(memoryDir, 'graph-queue.jsonl');
  const outputPath = join(memoryDir, 'playground.html');
  const templatePath = join(__dirname, 'playground-template.html');

  const records = readJsonl(decisionsPath);
  const queueRecords = readJsonl(queuePath);
  const flows = readFlows(memoryDir);

  if (records.length === 0) {
    console.log('No memories stored yet. Use `/ork:remember` to start building your knowledge graph.');
    process.exit(0);
  }

  const data = buildPlaygroundData(records, queueRecords, flows);

  console.log(`Playground data built:`);
  console.log(`  - ${data.nodes.length} entities`);
  console.log(`  - ${data.edges.length} relations`);
  console.log(`  - ${data.decisions.length} decisions`);
  console.log(`  - ${data.sessions.length} sessions`);
  console.log(`  - ${data.stats.queueDepth} queued operations`);

  if (!existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
  }
  let html = readFileSync(templatePath, 'utf-8');

  // Inline vis-network for offline use
  const visNetworkPath = join(__dirname, 'vis-network.min.js');
  if (existsSync(visNetworkPath)) {
    const visNetworkCode = readFileSync(visNetworkPath, 'utf-8');
    html = html.replace(
      /<script src="https:\/\/unpkg\.com\/vis-network@[^"]+"><\/script>/,
      `<script>/* vis-network 9.1.9 - inlined for offline use */\n${visNetworkCode}</script>`
    );
    console.log('  - vis-network inlined for offline use');
  } else {
    console.warn('  - vis-network.min.js not found, using CDN fallback');
  }

  // Inject data as JSON
  const jsonBlob = JSON.stringify(data);
  html = html.replace('{{PLAYGROUND_DATA}}', jsonBlob.replace(/</g, '\\u003c').replace(/>/g, '\\u003e'));

  if (!existsSync(dirname(outputPath))) {
    mkdirSync(dirname(outputPath), { recursive: true });
  }
  writeFileSync(outputPath, html, 'utf-8');
  console.log(`\nPlayground written to ${outputPath}`);

  openInBrowser(outputPath);
}

// ---------------------------------------------------------------------------
// Entry point guard + exports for testability
// ---------------------------------------------------------------------------

const isMainModule = resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] || '');
if (isMainModule) main();

export { main, buildPlaygroundData, buildSessionIndex, parseArgs };
