#!/usr/bin/env node
// ============================================================================
// Task-Usage Compliance Reader  (the consumer for task-nudge-outcomes.jsonl)
// ============================================================================
// WHAT IT READS
//   .claude/logs/task-nudge-outcomes.jsonl — written by
//   stop/task-completion-check (#3232), at most 2 lines per session:
//   the first Stop after qualifying 3+ step work, and the false→true
//   conversion if the operator opens a task list later. The LAST line per
//   session_id is that session's verdict.
//
// WHY IT EXISTS
//   The 2026-08-01 theater audit's own standard: telemetry without a reader
//   is proto-theater — a number nobody can see cannot ratchet anything.
//   This file shipped six hours after the writer did, so the measurement
//   never gets to age into scenery. CLAUDE.md's "Use TaskCreate for 3+ step
//   work" finally has a denominator AND a one-command way to look at it.
//
// USAGE
//   node scripts/task-compliance.mjs             # human summary
//   node scripts/task-compliance.mjs --json      # {sessions, complied, rate}
//   node scripts/task-compliance.mjs --days 7    # window (default 30)
// ============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const logPath = join(projectRoot, '.claude', 'logs', 'task-nudge-outcomes.jsonl');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const daysIdx = args.indexOf('--days');
const windowDays = daysIdx >= 0 ? Number(args[daysIdx + 1]) || 30 : 30;
const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

if (!existsSync(logPath)) {
  if (asJson) {
    console.log(JSON.stringify({ sessions: 0, complied: 0, rate: null, note: 'no telemetry yet' }));
  } else {
    console.log('task-compliance: no telemetry yet (.claude/logs/task-nudge-outcomes.jsonl absent).');
    console.log('The Stop hook writes it after the first session with qualifying 3+ step work.');
  }
  process.exit(0);
}

// Last line per session wins — the conversion record supersedes the first.
const bySession = new Map();
for (const line of readFileSync(logPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue; // a torn concurrent write is not this reader's problem to fail on
  }
  if (row.event !== 'session_task_usage' || !row.session_id) continue;
  const ts = Date.parse(row.timestamp);
  if (Number.isFinite(ts) && ts < cutoff) continue;
  bySession.set(row.session_id, row);
}

const sessions = [...bySession.values()];
const complied = sessions.filter((r) => r.tasks_used === true).length;
const rate = sessions.length ? Math.round((complied / sessions.length) * 100) : null;
const qualifying = sessions.reduce((a, r) => a + (Number(r.qualifying_prompts) || 0), 0);

if (asJson) {
  console.log(JSON.stringify({ windowDays, sessions: sessions.length, complied, rate, qualifying_prompts: qualifying }));
  process.exit(0);
}

console.log('Task-usage compliance (CLAUDE.md: "Use TaskCreate for 3+ step work")');
console.log(`  window                        : last ${windowDays} days`);
console.log(`  sessions with qualifying work : ${sessions.length}`);
console.log(`  of which used tasks           : ${complied}`);
console.log(`  compliance                    : ${rate === null ? 'n/a (no qualifying sessions yet)' : rate + '%'}`);
console.log(`  qualifying prompts observed   : ${qualifying}`);
if (rate !== null && rate < 50) {
  console.log('  note: below half — the nudge is advisory by design; if this number');
  console.log('  stays low across weeks, that is data for a stronger mechanism, not prose.');
}
