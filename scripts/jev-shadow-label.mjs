#!/usr/bin/env node
/** Offline weak outcomes. Never fetches, executes tools, or changes runtime logs. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { readRows } from './jev-shadow-report.mjs';
import { labelDecision } from './lib/jev-weak-labels.mjs';
import { transcriptEvents } from './lib/jev-transcript-events.mjs';

const identifier = (v) => typeof v === 'string' && v.length > 0 ? v : null;

function records(file) {
  const absolute = resolve(file);
  return readFileSync(absolute, 'utf8').split('\n').flatMap((line, index) => {
    if (!line.trim()) return [];
    const source = `${absolute}:${index + 1}`;
    let row;
    try { row = JSON.parse(line); } catch { throw new Error(`Invalid JSON at ${source}`); }
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Invalid event at ${source}`);
    return [{ row, source }];
  });
}

export function makeLabels(rows, events, executorMap = {}) {
  return rows.map((row) => {
    const session = row.sessionId ?? row.source.match(/\/sessions\/([a-f0-9-]{36})\//)?.[1] ?? null;
    const producer = row.producer ?? (row.source.includes('/hq-ext-yonatan-hq/') ? 'hq-ext' : row.source.includes('/ork-alpha-orchestkit/') ? 'ork' : null);
    // Mapping is explicit and versioned by the operator, never inferred across plugins.
    const executor = row.jevExecutor ?? identifier(executorMap[producer]?.[row.jev]);
    const decision = { source: row.source, session_id: session, prompt_id: row.promptId, jev_executor: executor };
    if (row.seam !== 'route') return { ...decision, decision_sha256: row.decisionHash, kind: 'weak', outcome: 'unknown', signal: 'unsupported_seam', signals: [], evidence: [], policy_version: '1' };
    return { ...labelDecision(decision, events), decision_sha256: row.decisionHash, producer, jev_executor: executor,
      executor_map_sha256: row.jevExecutor || !executor ? null : createHash('sha256').update(JSON.stringify(executorMap)).digest('hex') };
  });
}

export function main(args) {
  const logs = [], events = [], transcripts = [];
  let executorMap = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--events', '--transcript', '--executor-map'].includes(arg)) {
      const file = args[++i];
      if (!file || file.startsWith('--')) throw new Error(`Missing file for ${arg}`);
      if (arg === '--events') events.push(...records(file).map(({ row, source }) => ({ ...row, evidence: source })));
      if (arg === '--transcript') transcripts.push(...records(file));
      if (arg === '--executor-map') {
        executorMap = JSON.parse(readFileSync(file, 'utf8'));
        if (!executorMap || typeof executorMap !== 'object' || Array.isArray(executorMap)) throw new Error('Invalid executor map');
        for (const values of Object.values(executorMap)) {
          if (!values || typeof values !== 'object' || Array.isArray(values) || Object.values(values).some((v) => !identifier(v))) throw new Error('Invalid executor map');
        }
      }
    } else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else logs.push(arg);
  }
  if (!logs.length) throw new Error('Usage: node scripts/jev-shadow-label.mjs [--events EVENTS.jsonl] [--transcript CLAUDE.jsonl] [--executor-map MAP.json] LOG...');
  const input = readRows(logs);
  if (input.malformed) throw new Error(`Refusing partial labeling: ${input.malformed} malformed log rows`);
  const executors = new Set([...Object.values(executorMap).flatMap(Object.values), ...input.rows.map((r) => r.jevExecutor).filter(Boolean)]);
  events.push(...transcriptEvents(transcripts, { executors }));
  for (const label of makeLabels(input.rows, events, executorMap)) console.log(JSON.stringify(label));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
