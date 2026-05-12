/**
 * Plugins Drift Snapshot — SessionStart Hook
 *
 * M139 issue #1782 (C5 plugins/ drift detector).
 *
 * Captures a baseline of the build inputs (`src/hooks/hooks.json`,
 * `manifests/ork.json`) plus the current `plugins/` file count at session
 * start, so the PostToolUse companion (`check-plugins-drift`) can later
 * detect a divergent state when the user edits source without rebuilding.
 *
 * Replaces the long-standing "Always rebuild after src/ edits" memory rule
 * with an active enforcement hook. See `check-plugins-drift.ts`.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult, HookContext } from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

const HOOK_NAME = 'lifecycle/plugins-drift-snapshot';

export interface PluginsDriftSnapshot {
  at: string;
  plugins_file_count: number;
  hooks_json_hash: string;
  manifest_hash: string;
}

const HOOKS_JSON_REL = join('src', 'hooks', 'hooks.json');
const MANIFEST_REL = join('manifests', 'ork.json');
const PLUGINS_REL = 'plugins';
const SNAPSHOT_REL = join('.claude', 'state', 'plugins-snapshot.json');

/** Recursively count regular files under `dir`. Returns 0 if dir missing. */
export function countFilesRecursive(dir: string): number {
  let count = 0;
  let entries: ReadonlyArray<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as unknown as ReadonlyArray<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFilesRecursive(full);
    } else if (entry.isFile()) {
      count++;
    }
  }
  return count;
}

/** SHA-256 hex of file content; '' if missing. */
export function sha256File(filePath: string): string {
  try {
    const buf = readFileSync(filePath);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return '';
  }
}

/** Build a snapshot from a project root. Exported for tests. */
export function buildSnapshot(projectDir: string): PluginsDriftSnapshot {
  return {
    at: new Date().toISOString(),
    plugins_file_count: countFilesRecursive(join(projectDir, PLUGINS_REL)),
    hooks_json_hash: sha256File(join(projectDir, HOOKS_JSON_REL)),
    manifest_hash: sha256File(join(projectDir, MANIFEST_REL)),
  };
}

export function pluginsDriftSnapshot(
  _input: HookInput,
  ctx: HookContext = NOOP_CTX,
): HookResult {
  try {
    // Only meaningful inside the OrchestKit repo: bail if neither
    // build input exists.
    const hooksJsonPath = join(ctx.projectDir, HOOKS_JSON_REL);
    const manifestPath = join(ctx.projectDir, MANIFEST_REL);
    try {
      statSync(hooksJsonPath);
    } catch {
      try {
        statSync(manifestPath);
      } catch {
        return outputSilentSuccess();
      }
    }

    const snapshot = buildSnapshot(ctx.projectDir);
    const snapshotPath = join(ctx.projectDir, SNAPSHOT_REL);
    mkdirSync(join(ctx.projectDir, '.claude', 'state'), { recursive: true });
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

    ctx.log(
      HOOK_NAME,
      `snapshot written: ${snapshot.plugins_file_count} plugin files, ` +
        `hooks ${snapshot.hooks_json_hash.slice(0, 12)}, ` +
        `manifest ${snapshot.manifest_hash.slice(0, 12)}`,
    );
  } catch (err) {
    ctx.log(HOOK_NAME, `snapshot failed: ${(err as Error).message}`);
  }

  return outputSilentSuccess();
}
