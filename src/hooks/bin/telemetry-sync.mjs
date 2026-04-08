#!/usr/bin/env node
/**
 * Telemetry Sync CLI — Replays local JSONL events to the remote batch-ingest endpoint.
 *
 * Reads rotated + active telemetry files, POSTs lines as NDJSON to
 * {ORCHESTKIT_HOOK_URL}/batch-ingest. Deletes fully-synced rotated files.
 * Never deletes the active events.jsonl (still being written to by hooks).
 *
 * Usage:
 *   node hooks/bin/telemetry-sync.mjs              # sync all
 *   node hooks/bin/telemetry-sync.mjs --dry-run    # preview without sending
 *
 * Auth: Bearer token from ORCHESTKIT_HOOK_TOKEN env var.
 * Endpoint: {ORCHESTKIT_HOOK_URL}/batch-ingest (NDJSON, 202 Accepted).
 *
 * #1260-D: Phase 4 of Telemetry Provider Architecture (M105).
 */

import { readFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BATCH_SIZE = 50;
const FETCH_TIMEOUT_MS = 10_000;
const ACTIVE_FILENAME = 'events.jsonl';

// ---------------------------------------------------------------------------
// Resolve telemetry directory
// ---------------------------------------------------------------------------

function getTelemetryDir() {
  // Prefer CLAUDE_PLUGIN_DATA (CC 2.1.78+)
  const pluginData = process.env.CLAUDE_PLUGIN_DATA;
  if (pluginData) return join(pluginData, 'telemetry');

  // Fallback: project-local
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return join(projectDir, '.claude', 'telemetry');
}

// ---------------------------------------------------------------------------
// Collect JSONL files (rotated first, active last)
// ---------------------------------------------------------------------------

function collectJsonlFiles(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter(f => f.endsWith('.jsonl'))
    .sort((a, b) => {
      // Active file sorts last (process it last, never delete it)
      if (a === ACTIVE_FILENAME) return 1;
      if (b === ACTIVE_FILENAME) return -1;
      return a.localeCompare(b);
    })
    .map(f => ({ name: f, path: join(dir, f), isActive: f === ACTIVE_FILENAME }));
}

// ---------------------------------------------------------------------------
// Parse JSONL file into lines
// ---------------------------------------------------------------------------

function parseJsonlFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => {
      try {
        JSON.parse(line); // Validate JSON
        return line;
      } catch {
        return null; // Skip invalid lines
      }
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// POST a batch of NDJSON lines
// ---------------------------------------------------------------------------

async function postBatch(url, token, lines) {
  const ndjson = lines.join('\n') + '\n';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Authorization': `Bearer ${token}`,
    },
    body: ndjson,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (response.status === 202) {
    const body = await response.json().catch(() => ({}));
    return { ok: true, accepted: body.accepted ?? lines.length, rejected: body.rejected ?? 0 };
  }

  if (response.status === 422) {
    const body = await response.json().catch(() => ({}));
    return { ok: false, accepted: body.accepted ?? 0, rejected: body.rejected ?? lines.length, errors: body.errors ?? [] };
  }

  return { ok: false, accepted: 0, rejected: lines.length, errors: [`HTTP ${response.status}`] };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const hookUrl = process.env.ORCHESTKIT_HOOK_URL;
  const hookToken = process.env.ORCHESTKIT_HOOK_TOKEN;

  if (!hookUrl || !hookToken) {
    console.log('[telemetry-sync] No ORCHESTKIT_HOOK_URL or TOKEN configured. Nothing to sync.');
    process.exit(0);
  }

  const batchUrl = `${hookUrl.replace(/\/$/, '')}/batch-ingest`;
  const telemetryDir = getTelemetryDir();
  const files = collectJsonlFiles(telemetryDir);

  if (files.length === 0) {
    console.log('[telemetry-sync] No telemetry files found.');
    process.exit(0);
  }

  let totalSent = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let filesDeleted = 0;

  for (const file of files) {
    const lines = parseJsonlFile(file.path);
    if (lines.length === 0) {
      if (!file.isActive) {
        // Empty rotated file — clean up
        if (!dryRun) unlinkSync(file.path);
        filesDeleted++;
      }
      continue;
    }

    console.log(`[telemetry-sync] ${file.name}: ${lines.length} events${dryRun ? ' (dry-run)' : ''}`);

    if (dryRun) {
      totalSent += lines.length;
      continue;
    }

    // Chunk into batches
    let fileFullySynced = true;
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const chunk = lines.slice(i, i + BATCH_SIZE);
      try {
        const result = await postBatch(batchUrl, hookToken, chunk);
        totalSent += result.accepted;
        totalSkipped += result.rejected;
        if (!result.ok) {
          fileFullySynced = false;
          console.error(`[telemetry-sync]   Batch ${Math.floor(i / BATCH_SIZE) + 1} partial: ${result.accepted} accepted, ${result.rejected} rejected`);
          if (result.errors?.length) {
            result.errors.slice(0, 3).forEach(e => console.error(`[telemetry-sync]     ${typeof e === 'string' ? e : JSON.stringify(e)}`));
          }
        }
      } catch (err) {
        fileFullySynced = false;
        totalFailed += chunk.length;
        console.error(`[telemetry-sync]   Batch failed: ${err.message}`);
      }
    }

    // Delete rotated files that were fully synced
    if (fileFullySynced && !file.isActive) {
      unlinkSync(file.path);
      filesDeleted++;
    }
  }

  console.log(`[telemetry-sync] Done: sent=${totalSent} skipped=${totalSkipped} failed=${totalFailed} deleted=${filesDeleted} files`);
}

main().catch(err => {
  console.error(`[telemetry-sync] Fatal: ${err.message}`);
  process.exit(1);
});
