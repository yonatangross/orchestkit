/**
 * Setup Hooks Entry Point
 *
 * Hooks that run during setup (--init, --maintenance)
 * Bundle: setup.mjs (~15 KB estimated)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';

// Setup hooks (9)
import { unifiedSetupDispatcher } from '../setup/unified-dispatcher.js';
import { firstRunSetup } from '../setup/first-run-setup.js';
import { mem0AnalyticsDashboard } from '../setup/mem0-analytics-dashboard.js';
import { mem0BackupSetup } from '../setup/mem0-backup-setup.js';
import { mem0Cleanup } from '../setup/mem0-cleanup.js';
import { monorepoDetector } from '../setup/monorepo-detector.js';
import { setupCheck } from '../setup/setup-check.js';
import { setupMaintenance } from '../setup/setup-maintenance.js';
import { setupRepair } from '../setup/setup-repair.js';

import type { HookFn } from '../types.js';

/**
 * Setup hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'setup/unified-dispatcher': unifiedSetupDispatcher,
  'setup/first-run-setup': firstRunSetup,
  'setup/mem0-analytics-dashboard': mem0AnalyticsDashboard,
  'setup/mem0-backup-setup': mem0BackupSetup,
  'setup/mem0-cleanup': mem0Cleanup,
  'setup/monorepo-detector': monorepoDetector,
  'setup/setup-check': setupCheck,
  'setup/setup-maintenance': setupMaintenance,
  'setup/setup-repair': setupRepair,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
