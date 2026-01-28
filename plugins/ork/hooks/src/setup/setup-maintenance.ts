/**
 * Setup Maintenance - Periodic maintenance tasks
 * Hook: Setup (triggered by setup-check.sh or --maintenance flag)
 * CC 2.1.11 Compliant
 *
 * Tasks:
 * - Log rotation (daily)
 * - Stale lock cleanup (daily)
 * - Session archive (daily)
 * - Memory Fabric cleanup (daily)
 * - Metrics aggregation (weekly)
 * - Full health validation (weekly)
 * - Version migrations (on version change)
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  readdirSync,
  unlinkSync,
  statSync,
  chmodSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getPluginRoot, getProjectDir, outputSilentSuccess, outputWithContext } from '../lib/common.js';

const CURRENT_VERSION = '4.25.0';

const tasksCompleted: string[] = [];

/**
 * Get marker field
 */
function getMarkerField(markerFile: string, field: string): unknown {
  if (!existsSync(markerFile)) {
    return null;
  }

  try {
    const content = JSON.parse(readFileSync(markerFile, 'utf-8'));
    return content[field.replace(/^\./, '')];
  } catch {
    return null;
  }
}

/**
 * Update marker field
 */
function updateMarkerField(markerFile: string, field: string, value: unknown): void {
  if (!existsSync(markerFile)) {
    return;
  }

  try {
    const content = JSON.parse(readFileSync(markerFile, 'utf-8'));
    content[field.replace(/^\./, '')] = value;
    writeFileSync(markerFile, JSON.stringify(content, null, 2));
  } catch {
    // Ignore
  }
}

/**
 * Calculate hours since timestamp
 */
function hoursSince(timestamp: string | null): number {
  if (!timestamp) {
    return 999;
  }

  try {
    const lastEpoch = new Date(timestamp).getTime();
    const nowEpoch = Date.now();
    return (nowEpoch - lastEpoch) / (1000 * 60 * 60);
  } catch {
    return 999;
  }
}

/**
 * Task: Log rotation
 */
function taskLogRotation(pluginRoot: string): void {
  logHook('setup-maintenance', 'Task: Log rotation');

  const logDirs = [`${pluginRoot}/.claude/logs`, `${process.env.HOME || process.env.USERPROFILE || '/tmp'}/.claude/logs/ork`];

  let rotated = 0;

  for (const logDir of logDirs) {
    if (!existsSync(logDir)) {
      continue;
    }

    try {
      const files = readdirSync(logDir);
      for (const file of files) {
        if (!file.endsWith('.log')) continue;

        const filePath = `${logDir}/${file}`;
        try {
          const stats = statSync(filePath);
          if (stats.size > 204800) {
            // 200KB
            const rotatedName = `${filePath}.old.${Date.now()}`;
            renameSync(filePath, rotatedName);
            rotated++;

            // Try to gzip
            try {
              execSync(`gzip "${rotatedName}"`, { stdio: ['pipe', 'pipe', 'pipe'] });
            } catch {
              // gzip not available
            }
          }
        } catch {
          // Ignore file errors
        }
      }

      // Clean up old rotated logs (keep last 5)
      const rotatedLogs = files.filter((f) => f.includes('.log.old.')).sort().reverse();
      for (const oldLog of rotatedLogs.slice(5)) {
        try {
          unlinkSync(`${logDir}/${oldLog}`);
        } catch {
          // Ignore
        }
      }
    } catch {
      // Ignore directory errors
    }
  }

  if (rotated > 0) {
    tasksCompleted.push(`Rotated ${rotated} log files`);
  }
}

/**
 * Task: Stale lock cleanup
 */
function taskStaleLockCleanup(pluginRoot: string): void {
  logHook('setup-maintenance', 'Task: Stale lock cleanup');

  const coordDb = `${pluginRoot}/.claude/coordination/.claude.db`;
  let cleaned = 0;

  if (existsSync(coordDb)) {
    try {
      execSync(`sqlite3 "${coordDb}" "DELETE FROM file_locks WHERE datetime(acquired_at) < datetime('now', '-24 hours');"`, {
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const lockCount = execSync(`sqlite3 "${coordDb}" "SELECT COUNT(*) FROM file_locks;"`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      logHook('setup-maintenance', `Coordination locks remaining: ${lockCount}`);
      cleaned = 1;
    } catch {
      // Ignore SQLite errors
    }
  }

  // Clean up .lock files older than 24 hours
  try {
    const walkAndClean = (dir: string, depth = 0) => {
      if (depth > 3) return;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = `${dir}/${entry.name}`;
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            walkAndClean(fullPath, depth + 1);
          } else if (entry.name.endsWith('.lock')) {
            try {
              const stats = statSync(fullPath);
              const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
              if (ageHours > 24) {
                unlinkSync(fullPath);
                cleaned++;
              }
            } catch {
              // Ignore
            }
          }
        }
      } catch {
        // Ignore
      }
    };
    walkAndClean(pluginRoot);
  } catch {
    // Ignore
  }

  if (cleaned > 0) {
    tasksCompleted.push('Cleaned stale locks');
  }
}

/**
 * Task: Session cleanup
 */
function taskSessionCleanup(pluginRoot: string): void {
  logHook('setup-maintenance', 'Task: Session cleanup');

  const sessionDir = `${pluginRoot}/.claude/context/sessions`;
  const archiveDir = `${pluginRoot}/.claude/context/archive`;

  if (!existsSync(sessionDir)) {
    return;
  }

  let archived = 0;

  try {
    mkdirSync(archiveDir, { recursive: true });
    const entries = readdirSync(sessionDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = `${sessionDir}/${entry.name}`;
      try {
        const stats = statSync(fullPath);
        const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageDays > 7) {
          renameSync(fullPath, `${archiveDir}/${entry.name}`);
          archived++;
        }
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore
  }

  // Clean up old temp files
  try {
    const entries = readdirSync('/tmp');
    for (const entry of entries) {
      if (!entry.startsWith('claude-session-')) continue;

      const fullPath = `/tmp/${entry}`;
      try {
        const stats = statSync(fullPath);
        const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageDays > 7 && stats.isDirectory()) {
          execSync(`rm -rf "${fullPath}"`, { stdio: ['pipe', 'pipe', 'pipe'] });
        }
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore
  }

  if (archived > 0) {
    tasksCompleted.push(`Archived ${archived} old sessions`);
  }
}

/**
 * Task: Memory Fabric cleanup
 */
function taskMemoryFabricCleanup(projectDir: string): void {
  logHook('setup-maintenance', 'Task: Memory Fabric cleanup');

  let cleaned = 0;
  const logsDir = `${projectDir}/.claude/logs`;

  // Clean up old pending sync files (older than 7 days)
  if (existsSync(logsDir)) {
    try {
      const files = readdirSync(logsDir);
      for (const file of files) {
        if (!file.startsWith('.mem0-pending-sync-')) continue;

        const fullPath = `${logsDir}/${file}`;
        try {
          const stats = statSync(fullPath);
          const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
          if (ageDays > 7) {
            unlinkSync(fullPath);
            cleaned++;
          }
        } catch {
          // Ignore
        }
      }
    } catch {
      // Ignore
    }
  }

  // Clean up global pending sync if stale
  const globalSync = `${process.env.HOME || process.env.USERPROFILE || '/tmp'}/.claude/.mem0-pending-sync.json`;
  if (existsSync(globalSync)) {
    try {
      const stats = statSync(globalSync);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      if (ageHours > 24) {
        unlinkSync(globalSync);
        cleaned++;
      }
    } catch {
      // Ignore
    }
  }

  if (cleaned > 0) {
    tasksCompleted.push(`Cleaned ${cleaned} Memory Fabric files`);
  }
}

/**
 * Task: Health validation
 */
function taskHealthValidation(pluginRoot: string, markerFile: string): void {
  logHook('setup-maintenance', 'Task: Full health validation');

  let issues = 0;

  // Validate all hooks are executable
  let nonExec = 0;
  const checkExecutable = (dir: string, depth = 0) => {
    if (depth > 4) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          checkExecutable(fullPath, depth + 1);
        } else if (entry.name.endsWith('.sh')) {
          try {
            const stats = statSync(fullPath);
            if (!(stats.mode & 0o111)) {
              chmodSync(fullPath, 0o755);
              nonExec++;
            }
          } catch {
            // Ignore
          }
        }
      }
    } catch {
      // Ignore
    }
  };

  checkExecutable(`${pluginRoot}/hooks`);
  if (nonExec > 0) {
    logHook('setup-maintenance', `WARN: ${nonExec} hooks were not executable`);
    issues++;
  }

  // Validate config.json
  const configFile = `${pluginRoot}/.claude/defaults/config.json`;
  if (existsSync(configFile)) {
    try {
      JSON.parse(readFileSync(configFile, 'utf-8'));
    } catch {
      logHook('setup-maintenance', 'WARN: config.json is invalid');
      issues++;
    }
  }

  // Update health check timestamp
  updateMarkerField(markerFile, 'last_health_check', new Date().toISOString());

  if (issues === 0) {
    tasksCompleted.push('Health validation passed');
  } else {
    tasksCompleted.push(`Health validation found ${issues} issues (auto-fixed)`);
  }
}

/**
 * Task: Version migration
 */
function taskVersionMigration(markerFile: string): void {
  logHook('setup-maintenance', 'Task: Version migration');

  const markerVersion = getMarkerField(markerFile, 'version') as string | null;

  if (!markerVersion || markerVersion === CURRENT_VERSION) {
    return;
  }

  logHook('setup-maintenance', `Migrating from ${markerVersion} to ${CURRENT_VERSION}`);

  // Version-specific migrations would go here
  // For now, just log and update version

  updateMarkerField(markerFile, 'version', CURRENT_VERSION);
  tasksCompleted.push(`Migrated from ${markerVersion} to ${CURRENT_VERSION}`);
}

/**
 * Setup maintenance hook
 */
export function setupMaintenance(input: HookInput): HookResult {
  const pluginRoot = getPluginRoot();
  const projectDir = input.project_dir || getProjectDir();
  const markerFile = `${pluginRoot}/.setup-complete`;

  // Determine mode from argv
  const args = process.argv;
  let mode = 'auto';
  if (args.includes('--force')) {
    mode = 'force';
  } else if (args.includes('--migrate')) {
    mode = 'migrate';
  } else if (args.includes('--background')) {
    mode = 'background';
  }

  logHook('setup-maintenance', `Maintenance starting (mode: ${mode})`);

  const now = new Date().toISOString();
  const lastMaintenance = getMarkerField(markerFile, 'last_maintenance') as string | null;
  const hours = hoursSince(lastMaintenance);

  let runDaily = false;
  let runWeekly = false;

  switch (mode) {
    case 'force':
      runDaily = true;
      runWeekly = true;
      break;
    case 'migrate':
      taskVersionMigration(markerFile);
      break;
    case 'background':
    case 'auto':
      if (hours >= 24) {
        runDaily = true;
      }
      if (hours >= 168) {
        // 7 days
        runWeekly = true;
      }
      break;
  }

  // Run daily tasks
  if (runDaily) {
    logHook('setup-maintenance', 'Running daily maintenance tasks');
    taskLogRotation(pluginRoot);
    taskStaleLockCleanup(pluginRoot);
    taskSessionCleanup(pluginRoot);
    taskMemoryFabricCleanup(projectDir);
  }

  // Run weekly tasks
  if (runWeekly) {
    logHook('setup-maintenance', 'Running weekly maintenance tasks');
    taskHealthValidation(pluginRoot, markerFile);
  }

  // Update last maintenance timestamp
  updateMarkerField(markerFile, 'last_maintenance', now);

  // Build summary
  if (tasksCompleted.length > 0) {
    logHook('setup-maintenance', `Maintenance complete: ${tasksCompleted.length} tasks`);
    const summary = `Completed: ${tasksCompleted.join(', ')}`;

    if (mode === 'background') {
      return outputSilentSuccess();
    }

    return outputWithContext(`Maintenance: ${summary}`);
  }

  logHook('setup-maintenance', 'No maintenance tasks needed');
  return outputSilentSuccess();
}
