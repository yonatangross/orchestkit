/**
 * Memory Context Retrieval - Auto-loads memories at session start (Graph-First Architecture)
 * Hook: SessionStart
 * CC 2.1.7 Compliant - Works across any repository
 * CC 2.1.9 Compatible - Uses additionalContext for context injection
 *
 * Graph-First Architecture (v2.1):
 * - Knowledge graph (mcp__memory__*) is PRIMARY - always available, zero-config
 * - Mem0 cloud (mcp__mem0__*) is OPTIONAL enhancement for semantic search
 *
 * Version: 2.1.0 - Graph-first architecture
 * Part of Memory Fabric v2.1
 */

import { existsSync, readFileSync, mkdirSync, renameSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface PendingSyncFile {
  memories?: unknown[];
  scope?: string;
  project_id?: string;
}

interface Memory {
  text: string;
  metadata?: {
    has_blockers?: boolean;
    has_next_steps?: boolean;
  };
}

/**
 * Get project ID for user_id hint
 */
function getProjectId(projectDir: string): string {
  const parts = projectDir.split('/');
  const basename = parts[parts.length - 1] || 'unknown';
  return basename.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Check if mem0 is available
 */
function isMem0Available(): boolean {
  return !!process.env.MEM0_API_KEY;
}

/**
 * Check if pending sync file has valid JSON content
 */
function hasValidPendingSync(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    // Check if it has meaningful content
    if (!parsed || Object.keys(parsed).length === 0) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Archive pending sync file
 */
function archivePendingSync(filePath: string, projectDir: string): void {
  const processedDir = `${projectDir}/.claude/logs/mem0-processed`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  try {
    mkdirSync(processedDir, { recursive: true });

    const basename = filePath.split('/').pop() || 'pending-sync';
    const archiveName = basename.replace('.json', `.processed-${timestamp}.json`);
    const archivePath = `${processedDir}/${archiveName}`;

    renameSync(filePath, archivePath);
    logHook('mem0-context-retrieval', `Archived pending sync to ${archivePath}`);
  } catch (err) {
    logHook('mem0-context-retrieval', `Warning: Could not archive ${filePath}: ${err}`);
  }
}

/**
 * Check if memory-fabric skill exists
 */
function hasMemoryFabricSkill(): boolean {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_PROJECT_DIR || '.';
  return existsSync(`${pluginRoot}/skills/memory-fabric/SKILL.md`);
}

/**
 * Memory context retrieval hook
 */
export function mem0ContextRetrieval(input: HookInput): HookResult {
  logHook('mem0-context-retrieval', 'Mem0 context retrieval starting');

  const projectDir = input.project_dir || getProjectDir();
  const projectId = getProjectId(projectDir);

  // Pending sync file locations
  const pendingSyncFile = `${projectDir}/.mem0-pending-sync.json`;
  const pendingSyncGlobal = `${process.env.HOME}/.claude/.mem0-pending-sync.json`;

  // Determine which pending sync file to check
  let pendingFile: string | null = null;

  if (hasValidPendingSync(pendingSyncFile)) {
    pendingFile = pendingSyncFile;
    logHook('mem0-context-retrieval', `Found pending sync in project: ${pendingSyncFile}`);
  } else if (hasValidPendingSync(pendingSyncGlobal)) {
    // Check if global file is for this project
    try {
      const content: PendingSyncFile = JSON.parse(readFileSync(pendingSyncGlobal, 'utf-8'));
      if (content.project_id === projectId) {
        pendingFile = pendingSyncGlobal;
        logHook('mem0-context-retrieval', 'Found pending sync in global location for this project');
      } else {
        logHook('mem0-context-retrieval', `Global pending sync exists but for different project: ${content.project_id}`);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Archive pending sync if found
  if (pendingFile) {
    logHook('mem0-context-retrieval', 'Found pending sync, archiving for processing');
    archivePendingSync(pendingFile, projectDir);
    logHook('mem0-context-retrieval', 'Pending sync archived - will be processed on next memory operation');
  }

  // Log memory availability status
  if (isMem0Available()) {
    logHook('mem0-context-retrieval', 'Graph + mem0 available for this session');
  } else {
    logHook('mem0-context-retrieval', 'Graph available (mem0 not configured) for this session');
  }

  // Note: SessionStart hooks must use simple success output (no hookSpecificOutput.additionalContext)
  return outputSilentSuccess();
}
