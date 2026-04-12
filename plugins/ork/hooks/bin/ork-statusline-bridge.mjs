#!/usr/bin/env node
/**
 * OrchestKit StatusLine Bridge
 *
 * Minimal statusline command that extracts context_window percentage
 * from CC's stdin JSON and writes it to a temp file for the Session
 * Quality Governor hook to read.
 *
 * If the user has claude-hud or another statusline configured, this
 * script is superseded — the governor reads the same temp file
 * regardless of which statusline writes it.
 *
 * Input:  CC statusline JSON on stdin (model, context_window, etc.)
 * Output: Empty string to stdout (invisible statusline)
 * Side effect: Writes /tmp/ork-ctx-pct-{session_id}.txt
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString().trim();
  if (!raw) {
    process.stdout.write('');
    return;
  }

  try {
    const data = JSON.parse(raw);

    // Extract context percentage
    const ctxPct = data.context_window?.percentage
      ?? data.context_window?.used_percentage
      ?? null;

    // Extract session ID
    const sessionId = data.session_id
      ?? process.env.CLAUDE_SESSION_ID
      ?? null;

    if (ctxPct !== null && sessionId) {
      const safeId = sessionId.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = join(tmpdir(), `ork-ctx-pct-${safeId}.txt`);
      writeFileSync(filePath, String(Math.round(ctxPct)));
    }
  } catch {
    // Graceful — statusline should never crash
  }

  // Output empty string — this is a data bridge, not a visual statusline
  // Users who want a visual statusline should use claude-hud
  process.stdout.write('');
}

main();
