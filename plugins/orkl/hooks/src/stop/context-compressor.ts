/**
 * Context Compressor - Session End Hook
 * CC 2.1.7 Compliant
 * Compresses and archives context at end of session
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

// Configuration
const MAX_ACTIVE_DECISIONS = 10;

interface SessionState {
  session_id?: string;
  [key: string]: unknown;
}

interface DecisionsFile {
  decisions: unknown[];
  [key: string]: unknown;
}

/**
 * Archive current session
 */
function archiveSession(contextDir: string): void {
  const sessionFile = `${contextDir}/session/state.json`;
  if (!existsSync(sessionFile)) {
    logHook('context-compressor', 'No session state to archive');
    return;
  }

  try {
    const content = readFileSync(sessionFile, 'utf-8');
    const session: SessionState = JSON.parse(content);

    const sessionId = session.session_id || `session-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const archiveDir = `${contextDir}/archive/sessions`;
    mkdirSync(archiveDir, { recursive: true });

    const archiveFile = `${archiveDir}/${sessionId}.json`;
    const archived = {
      ...session,
      ended: new Date().toISOString(),
      archived: true,
    };

    writeFileSync(archiveFile, JSON.stringify(archived, null, 2));
    logHook('context-compressor', `Archived session to ${archiveFile}`);

    // Reset session state
    const resetState = {
      $schema: 'context://session/v1',
      _meta: { position: 'END', token_budget: 500, auto_load: 'always' },
      session_id: null,
      started: null,
      current_task: null,
      files_touched: [],
      decisions_this_session: [],
      blockers: [],
      next_steps: [],
      scratchpad: { notes: [] },
    };

    writeFileSync(sessionFile, JSON.stringify(resetState, null, 2));
    logHook('context-compressor', 'Reset session state');
  } catch (error) {
    logHook('context-compressor', `Error archiving session: ${error}`);
  }
}

/**
 * Compress old decisions
 */
function compressOldDecisions(contextDir: string): void {
  const decisionsFile = `${contextDir}/knowledge/decisions/active.json`;
  if (!existsSync(decisionsFile)) {
    return;
  }

  try {
    const content = readFileSync(decisionsFile, 'utf-8');
    const data: DecisionsFile = JSON.parse(content);
    const decisions = data.decisions || [];

    if (decisions.length <= MAX_ACTIVE_DECISIONS) {
      return;
    }

    const archiveDir = `${contextDir}/archive/decisions`;
    mkdirSync(archiveDir, { recursive: true });

    const now = new Date();
    const archiveFile = `${archiveDir}/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.json`;

    // Archive old decisions
    const toArchive = decisions.slice(0, -MAX_ACTIVE_DECISIONS);
    writeFileSync(archiveFile, JSON.stringify(toArchive, null, 2));

    // Keep only recent decisions
    data.decisions = decisions.slice(-MAX_ACTIVE_DECISIONS);
    writeFileSync(decisionsFile, JSON.stringify(data, null, 2));

    logHook('context-compressor', `Archived ${toArchive.length} old decisions`);
  } catch (error) {
    logHook('context-compressor', `Error compressing decisions: ${error}`);
  }
}

/**
 * Write compaction manifest for session resume (CC 2.1.20)
 * Provides structured context for session-context-loader to pick up
 */
function writeCompactionManifest(contextDir: string): void {
  const sessionFile = `${contextDir}/session/state.json`;
  if (!existsSync(sessionFile)) {
    return;
  }

  try {
    const content = readFileSync(sessionFile, 'utf-8');
    const session = JSON.parse(content);

    const manifest = {
      sessionId: session.session_id || 'unknown',
      compactedAt: new Date().toISOString(),
      keyDecisions: (session.decisions_this_session || []).slice(-5),
      filesTouched: (session.files_touched || []).slice(-20),
      blockers: session.blockers || [],
      nextSteps: session.next_steps || [],
    };

    const manifestDir = `${contextDir}/session`;
    mkdirSync(manifestDir, { recursive: true });
    writeFileSync(`${manifestDir}/compaction-manifest.json`, JSON.stringify(manifest, null, 2));
    logHook('context-compressor', `Wrote compaction manifest for session ${manifest.sessionId}`);
  } catch (error) {
    logHook('context-compressor', `Error writing compaction manifest: ${error}`);
  }
}

/**
 * Main context compression function
 */
export function contextCompressor(input: HookInput): HookResult {
  logHook('context-compressor', 'Starting end-of-session compression...');

  const projectDir = input.project_dir || getProjectDir();
  const contextDir = `${projectDir}/context`;

  writeCompactionManifest(contextDir);
  archiveSession(contextDir);
  compressOldDecisions(contextDir);

  logHook('context-compressor', 'End-of-session compression complete');
  return outputSilentSuccess();
}
