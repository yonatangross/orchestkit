/**
 * graph-utils.mjs - Shared utilities for OrchestKit graph visualization scripts
 *
 * Pure library module: no main(), no side effects on import.
 * Used by render-graph.mjs and render-playground.mjs.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Entity type configuration (single source of truth)
// ---------------------------------------------------------------------------

export const ENTITY_TYPES = {
  Decision:   { prefix: 'd_',    className: 'decision',   color: '#3B82F6' },
  Preference: { prefix: 'pref_', className: 'preference', color: '#10B981' },
  Problem:    { prefix: 'prob_', className: 'problem',    color: '#EF4444' },
  Solution:   { prefix: 'sol_',  className: 'solution',   color: '#22C55E' },
  Technology: { prefix: 't_',    className: 'tech',       color: '#F59E0B' },
  Pattern:    { prefix: 'p_',    className: 'pattern',    color: '#8B5CF6' },
  Tool:       { prefix: 'tool_', className: 'tool',       color: '#06B6D4' },
  Workflow:   { prefix: 'w_',    className: 'workflow',   color: '#EC4899' },
};

// ---------------------------------------------------------------------------
// Relation classification sets
// ---------------------------------------------------------------------------

export const STRONG_RELATIONS = new Set([
  'CHOSE', 'SOLVED_BY', 'PREFERS', 'CONSTRAINT', 'USES', 'USED_FOR',
]);

export const REJECTED_RELATIONS = new Set([
  'CHOSE_OVER', 'TRADEOFF',
]);

// ---------------------------------------------------------------------------
// Keyword lists for entity type inference
// ---------------------------------------------------------------------------

export const TECH_KEYWORDS = [
  'postgresql', 'postgres', 'redis', 'mongodb', 'mysql', 'fastapi', 'react',
  'vue', 'angular', 'next', 'node', 'python', 'typescript', 'javascript',
  'kafka', 'rabbitmq', 'graphql', 'rest', 'grpc', 'esm', 'babel', 'esbuild',
  'rollup', 'webpack', 'vite', 'vitest', 'jest', 'pgvector',
];

export const TOOL_KEYWORDS = [
  'eslint', 'prettier', 'docker', 'k6', 'git', 'github', 'ci', 'cd', 'npm',
  'biome', 'playwright', 'cypress',
];

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Sanitize a name into a safe lowercase identifier.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Build a node ID from entity type and name.
 * Falls back to Pattern prefix for unknown types.
 * @param {string} entityType
 * @param {string} name
 * @returns {string}
 */
export function makeNodeId(entityType, name) {
  const cfg = ENTITY_TYPES[entityType] || ENTITY_TYPES.Pattern;
  return cfg.prefix + sanitizeId(name);
}

/**
 * Infer entity type from a name string using keyword matching.
 * @param {string} name
 * @returns {string}
 */
export function inferEntityType(name) {
  const lower = name.toLowerCase();
  if (TECH_KEYWORDS.some(k => lower.includes(k))) return 'Technology';
  if (TOOL_KEYWORDS.some(k => lower.includes(k))) return 'Tool';
  return 'Pattern';
}

/**
 * Normalize a raw entity (string or object) into a standard shape.
 * @param {string|object} raw
 * @returns {{ name: string, entityType: string, observations: string[] }}
 */
export function normalizeEntity(raw) {
  if (typeof raw === 'string') {
    return { name: raw, entityType: inferEntityType(raw), observations: [] };
  }
  return {
    name: raw.name || String(raw),
    entityType: raw.entityType || 'Pattern',
    observations: raw.observations || [],
  };
}

/**
 * Normalize a raw relation into a standard shape.
 * @param {object} rel
 * @returns {{ from: string, to: string, relationType: string }}
 */
export function normalizeRelation(rel) {
  return {
    from: rel.from,
    to: rel.to,
    relationType: rel.relationType || rel.type || 'RELATES_TO',
  };
}

/**
 * Classify an edge by its relation type.
 * @param {string} relationType
 * @returns {'strong'|'rejected'|'weak'}
 */
export function classifyEdge(relationType) {
  if (REJECTED_RELATIONS.has(relationType)) return 'rejected';
  if (STRONG_RELATIONS.has(relationType)) return 'strong';
  return 'weak';
}

/**
 * Build a lookup map from entity name to pre-computed node ID.
 * @param {Map<string, object>} entityMap - Map of name -> { entityType, ... }
 * @returns {Object<string, string>} - { name: nodeId }
 */
export function buildEntityNodeIdMap(entityMap) {
  const result = {};
  for (const [name, ent] of entityMap) {
    const entityType = ent.entityType || 'Pattern';
    result[name] = makeNodeId(entityType, name);
  }
  return result;
}

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

/**
 * Get the project directory from env or cwd.
 * @returns {string}
 */
export function getProjectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/**
 * Read a JSONL file, skipping corrupt lines.
 * @param {string} filePath
 * @returns {object[]}
 */
export function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const records = [];
  let skipped = 0;
  for (const line of lines) {
    try {
      records.push(JSON.parse(line));
    } catch {
      skipped++;
    }
  }
  if (skipped > 0) console.warn(`Skipped ${skipped} corrupt record(s)`);
  return records;
}

/**
 * Open a file in the platform's default browser.
 * @param {string} filePath
 */
export function openInBrowser(filePath) {
  try {
    const platform = process.platform;
    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
    execSync(`${cmd} "${filePath}"`, { stdio: 'ignore' });
    console.log('Opened in browser.');
  } catch {
    console.log(`Open manually: ${filePath}`);
  }
}
