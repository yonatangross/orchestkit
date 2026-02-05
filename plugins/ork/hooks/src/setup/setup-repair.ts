/**
 * Setup Repair - Self-healing for broken installations
 *
 * INTERNAL HOOK: Called by setup-check when validation fails.
 * NOT registered in plugin.json (by design - it's a sub-hook).
 *
 * CC 2.1.11 Compliant
 *
 * Repair Actions:
 * - Restore missing/corrupt config files
 * - Fix hook permissions
 * - Regenerate marker file
 * - Run migrations for version mismatches
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  readdirSync,
  statSync,
  chmodSync,
} from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getPluginRoot, outputSilentSuccess, outputWithContext } from '../lib/common.js';

const CURRENT_VERSION = '4.25.0';

const repairsMade: string[] = [];
const repairsFailed: string[] = [];
let notifyUser = false;

/**
 * Repair: Restore config.json
 */
function repairConfig(pluginRoot: string): void {
  const configFile = `${pluginRoot}/.claude/defaults/config.json`;
  const configDir = `${pluginRoot}/.claude/defaults`;

  // Ensure directory exists
  try {
    mkdirSync(configDir, { recursive: true });
  } catch {
    // Ignore
  }

  // Check if config exists and is valid
  if (existsSync(configFile)) {
    try {
      JSON.parse(readFileSync(configFile, 'utf-8'));
      return; // Config is valid
    } catch {
      // Backup corrupt config
      const backup = `${configFile}.corrupt.${Date.now()}`;
      try {
        renameSync(configFile, backup);
        logHook('setup-repair', `Backed up corrupt config to ${backup}`);
        notifyUser = true;
      } catch {
        // Ignore rename errors
      }
    }
  }

  // Restore default config
  const defaultConfig = {
    preset: 'complete',
    description: 'Full AI-assisted development toolkit (restored by repair)',
    features: {
      skills: true,
      agents: true,
      hooks: true,
      mcp: true,
      coordination: true,
      statusline: true,
    },
    hook_groups: {
      safety: true,
      quality: true,
      productivity: true,
      observability: true,
    },
  };

  writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
  repairsMade.push('config.json restored');
  logHook('setup-repair', 'Restored default config.json');
}

/**
 * Repair: Fix hook permissions
 */
function repairHookPermissions(pluginRoot: string): void {
  let fixed = 0;

  const fixPermissions = (dir: string, depth = 0) => {
    if (depth > 5) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          fixPermissions(fullPath, depth + 1);
        } else if (entry.name.endsWith('.sh')) {
          try {
            const stats = statSync(fullPath);
            if (!(stats.mode & 0o111)) {
              chmodSync(fullPath, 0o755);
              fixed++;
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

  fixPermissions(`${pluginRoot}/hooks`);

  if (fixed > 0) {
    repairsMade.push(`${fixed} hook permissions fixed`);
    logHook('setup-repair', `Fixed permissions on ${fixed} hooks`);
  }
}

/**
 * Repair: Ensure required directories exist
 */
function repairDirectories(pluginRoot: string): void {
  let dirsCreated = 0;

  const requiredDirs = [
    `${pluginRoot}/.claude/defaults`,
    `${pluginRoot}/.claude/context/session`,
    `${pluginRoot}/.claude/context/knowledge`,
    `${pluginRoot}/.claude/logs`,
    `${pluginRoot}/.claude/coordination`,
  ];

  for (const dir of requiredDirs) {
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
        dirsCreated++;
      } catch {
        // Ignore
      }
    }
  }

  if (dirsCreated > 0) {
    repairsMade.push(`${dirsCreated} directories created`);
    logHook('setup-repair', `Created ${dirsCreated} missing directories`);
  }
}

/**
 * Repair: Regenerate marker file
 */
function repairMarker(pluginRoot: string): void {
  const now = new Date().toISOString();

  // Count components
  let hookCount = 0;
  let skillCount = 0;
  let agentCount = 0;

  const countFiles = (dir: string, pattern: RegExp, maxDepth = 5): number => {
    let count = 0;
    const walk = (d: string, depth: number) => {
      if (depth > maxDepth) return;
      try {
        const entries = readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = `${d}/${entry.name}`;
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            walk(fullPath, depth + 1);
          } else if (pattern.test(entry.name)) {
            count++;
          }
        }
      } catch {
        // Ignore
      }
    };
    walk(dir, 0);
    return count;
  };

  try {
    hookCount = countFiles(`${pluginRoot}/hooks`, /\.sh$/);
    skillCount = countFiles(`${pluginRoot}/skills`, /SKILL\.md$/);
    agentCount = countFiles(`${pluginRoot}/agents`, /\.md$/);
  } catch {
    // Ignore
  }

  const marker = {
    version: CURRENT_VERSION,
    setup_date: now,
    preset: 'complete',
    repaired_at: now,
    components: {
      hooks: { count: hookCount, valid: true },
      skills: { count: skillCount, valid: true },
      agents: { count: agentCount, valid: true },
    },
    last_health_check: now,
    last_maintenance: now,
    environment: {
      os: process.platform,
    },
    user_preferences: {
      onboarding_completed: true,
      mcp_configured: false,
      statusline_configured: false,
    },
  };

  const markerFile = `${pluginRoot}/.setup-complete`;
  writeFileSync(markerFile, JSON.stringify(marker, null, 2));
  repairsMade.push('marker file regenerated');
  logHook('setup-repair', 'Regenerated marker file');
}

/**
 * Check for critical missing components
 */
function checkCriticalComponents(pluginRoot: string): boolean {
  let criticalMissing = 0;

  // Count hooks
  let hookCount = 0;
  try {
    const countFiles = (dir: string): number => {
      let count = 0;
      const walk = (d: string, depth: number) => {
        if (depth > 4) return;
        try {
          const entries = readdirSync(d, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = `${d}/${entry.name}`;
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              walk(fullPath, depth + 1);
            } else if (entry.name.endsWith('.sh')) {
              count++;
            }
          }
        } catch {
          // Ignore
        }
      };
      walk(dir, 0);
      return count;
    };
    hookCount = countFiles(`${pluginRoot}/hooks`);
  } catch {
    // Ignore
  }

  if (hookCount < 20) {
    logHook('setup-repair', `CRITICAL: Only ${hookCount} hooks found (expected 50+)`);
    criticalMissing++;
  }

  // Count skills
  let skillCount = 0;
  try {
    const countFiles = (dir: string): number => {
      let count = 0;
      const walk = (d: string, depth: number) => {
        if (depth > 2) return;
        try {
          const entries = readdirSync(d, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = `${d}/${entry.name}`;
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              walk(fullPath, depth + 1);
            } else if (entry.name === 'SKILL.md') {
              count++;
            }
          }
        } catch {
          // Ignore
        }
      };
      walk(dir, 0);
      return count;
    };
    skillCount = countFiles(`${pluginRoot}/skills`);
  } catch {
    // Ignore
  }

  if (skillCount < 50) {
    logHook('setup-repair', `CRITICAL: Only ${skillCount} skills found (expected 100+)`);
    criticalMissing++;
  }

  // Check for common.sh library
  if (!existsSync(`${pluginRoot}/hooks/_lib/common.sh`)) {
    logHook('setup-repair', 'CRITICAL: hooks/_lib/common.sh missing');
    criticalMissing++;
  }

  if (criticalMissing >= 2) {
    repairsFailed.push('Multiple critical components missing - reinstall recommended');
    notifyUser = true;
    return false;
  }

  return true;
}

/**
 * Setup repair hook
 */
export function setupRepair(input: HookInput): HookResult {
  const pluginRoot = getPluginRoot();

  logHook('setup-repair', 'Setup repair starting');

  // Run repairs in order of importance
  repairDirectories(pluginRoot);
  repairConfig(pluginRoot);
  repairHookPermissions(pluginRoot);

  // Check for critical missing components
  if (!checkCriticalComponents(pluginRoot)) {
    logHook('setup-repair', 'WARN: Critical components missing, repair incomplete');
  }

  // Regenerate marker file last (after other repairs)
  repairMarker(pluginRoot);

  // Build output message
  let repairSummary = '';
  if (repairsMade.length > 0) {
    repairSummary = `Repairs: ${repairsMade.join(', ')}`;
  }

  if (repairsFailed.length > 0) {
    repairSummary = `${repairSummary ? repairSummary + '. ' : ''}Issues: ${repairsFailed.join(', ')}`;
    notifyUser = true;
  }

  logHook('setup-repair', `Repair complete: ${repairsMade.length} repairs made, ${repairsFailed.length} issues`);

  // Output result
  if (notifyUser && repairSummary) {
    return outputWithContext(`OrchestKit auto-repair: ${repairSummary}`);
  }

  return outputSilentSuccess();
}
