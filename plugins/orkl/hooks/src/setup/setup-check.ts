/**
 * Setup Check - Entry point for CC 2.1.11 Setup hooks
 * Hook: Setup (triggered by --init, --init-only, --maintenance)
 * Also runs on SessionStart for fast validation
 *
 * This hook implements the hybrid marker file + validation approach:
 * 1. Check marker file for fast path (< 10ms when setup complete)
 * 2. Quick validation for self-healing (< 50ms)
 * 3. Triggers appropriate sub-hook based on state
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getPluginRoot, outputSilentSuccess, outputWithContext } from '../lib/common.js';

const CURRENT_VERSION = '4.25.0';

/**
 * Get marker field from marker file
 */
function getMarkerField(markerFile: string, field: string): unknown {
  if (!existsSync(markerFile)) {
    return null;
  }

  try {
    const content = JSON.parse(readFileSync(markerFile, 'utf-8'));
    // Simple dot notation parsing
    const parts = field.split('.');
    let value: unknown = content;
    for (const part of parts) {
      if (value === null || value === undefined) return null;
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * Quick validation - checks critical components exist (< 50ms target)
 */
function quickValidate(pluginRoot: string): number {
  let errors = 0;

  // Check 1: Config file exists and is valid JSON
  const configFile = `${pluginRoot}/.claude/defaults/config.json`;
  if (existsSync(configFile)) {
    try {
      JSON.parse(readFileSync(configFile, 'utf-8'));
    } catch {
      logHook('setup-check', 'WARN: config.json is invalid JSON');
      errors++;
    }
  }

  // Check 2: At least some hooks exist (simplified count)
  let hookCount = 0;
  if (existsSync(`${pluginRoot}/hooks`)) {
    try {
      const countShFiles = (dir: string, depth = 0): number => {
        if (depth > 3) return 0; // Limit depth
        let count = 0;
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries.slice(0, 100)) {
            // Limit entries
            const fullPath = `${dir}/${entry.name}`;
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              count += countShFiles(fullPath, depth + 1);
            } else if (entry.name.endsWith('.sh')) {
              count++;
            }
          }
        } catch {
          // Ignore
        }
        return count;
      };
      hookCount = countShFiles(`${pluginRoot}/hooks`);
    } catch {
      // Ignore
    }
  }

  if (hookCount < 10) {
    logHook('setup-check', `WARN: Only ${hookCount} hooks found (expected 50+)`);
    // Don't increment errors - just warn
  }

  // Check 3: Version matches
  const markerFile = `${pluginRoot}/.setup-complete`;
  const markerVersion = getMarkerField(markerFile, 'version') as string | null;
  if (markerVersion && markerVersion !== CURRENT_VERSION) {
    logHook('setup-check', `INFO: Version mismatch - marker: ${markerVersion}, current: ${CURRENT_VERSION}`);
    return 2; // Trigger migration
  }

  return errors;
}

/**
 * Check if maintenance is due
 */
function isMaintenanceDue(markerFile: string): boolean {
  const lastMaintenance = getMarkerField(markerFile, 'last_maintenance') as string | null;
  if (!lastMaintenance) {
    return true;
  }

  try {
    const lastEpoch = new Date(lastMaintenance).getTime();
    const nowEpoch = Date.now();
    const hoursSince = (nowEpoch - lastEpoch) / (1000 * 60 * 60);
    return hoursSince >= 24;
  } catch {
    return true;
  }
}

/**
 * Update marker field
 */
function updateMarker(markerFile: string, field: string, value: unknown): void {
  if (!existsSync(markerFile)) {
    return;
  }

  try {
    const content = JSON.parse(readFileSync(markerFile, 'utf-8'));
    content[field] = value;
    writeFileSync(markerFile, JSON.stringify(content, null, 2));
  } catch {
    // Ignore
  }
}

/**
 * Setup check hook
 */
export function setupCheck(input: HookInput): HookResult {
  // Check bypass flags
  if (process.env.ORCHESTKIT_SKIP_SETUP === '1' || process.env.ORCHESTKIT_SKIP_SLOW_HOOKS === '1') {
    return outputSilentSuccess();
  }

  const pluginRoot = getPluginRoot();
  const markerFile = `${pluginRoot}/.setup-complete`;
  const setupDir = `${pluginRoot}/hooks/setup`;

  logHook('setup-check', `Setup check starting (v${CURRENT_VERSION})`);

  // Check trigger mode from argv
  const args = process.argv;
  if (args.includes('--init') || args.includes('init')) {
    logHook('setup-check', 'Explicit --init: Running full setup');
    // In TS we can't exec, but the bash wrapper will handle this
    return {
      continue: true,
      systemMessage: 'Running first-run setup...',
    };
  }

  if (args.includes('--init-only') || args.includes('init-only')) {
    logHook('setup-check', 'CI/CD mode (--init-only): Running silent setup');
    return {
      continue: true,
      systemMessage: 'Running silent setup...',
    };
  }

  if (args.includes('--maintenance') || args.includes('maintenance')) {
    logHook('setup-check', 'Explicit --maintenance: Running maintenance tasks');
    return {
      continue: true,
      systemMessage: 'Running maintenance tasks...',
    };
  }

  // Auto mode: Check marker file first (fast path)
  if (!existsSync(markerFile)) {
    logHook('setup-check', 'No marker file found - first run detected');

    const hookEvent = input.hook_event || process.env.HOOK_EVENT;
    if (hookEvent === 'Setup') {
      return {
        continue: true,
        systemMessage: 'First run detected. Running setup...',
      };
    } else {
      // SessionStart - inform user but don't block
      const ctx = "OrchestKit setup not complete. Run 'claude --init' to configure the plugin.";
      return outputWithContext(ctx);
    }
  }

  // Marker exists - run quick validation
  logHook('setup-check', 'Marker file exists - running quick validation');

  const validationResult = quickValidate(pluginRoot);

  switch (validationResult) {
    case 0:
      // All checks passed - check if maintenance is due
      if (isMaintenanceDue(markerFile)) {
        logHook('setup-check', 'Maintenance due - queueing background tasks');
        // Run maintenance in background (spawn detached)
        const maintenanceScript = `${setupDir}/setup-maintenance.sh`;
        if (existsSync(maintenanceScript)) {
          const child = spawn(maintenanceScript, ['--background'], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        }
      }

      logHook('setup-check', 'Setup check passed (fast path)');
      return outputSilentSuccess();

    case 1:
      // Validation failed - trigger repair in background
      logHook('setup-check', 'Validation failed - triggering self-healing repair');
      const repairScript = `${setupDir}/setup-repair.sh`;
      if (existsSync(repairScript)) {
        const child = spawn(repairScript, [], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      }
      return outputWithContext('OrchestKit setup validation failed. Repair running in background.');

    case 2:
      // Version mismatch - run migration in background
      logHook('setup-check', 'Version mismatch - running migration');
      const maintenanceScript = `${setupDir}/setup-maintenance.sh`;
      if (existsSync(maintenanceScript)) {
        const child = spawn(maintenanceScript, ['--migrate'], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      }

      updateMarker(markerFile, 'version', CURRENT_VERSION);
      return outputWithContext(`OrchestKit upgraded to v${CURRENT_VERSION}.`);

    default:
      return outputSilentSuccess();
  }
}
