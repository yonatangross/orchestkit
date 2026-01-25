/**
 * Mem0 Backup Setup Hook - Configure scheduled exports
 * Hook: Setup (maintenance)
 * CC 2.1.7 Compliant
 *
 * Features:
 * - Configures scheduled exports
 * - Sets up backup workflow
 * - Defines backup retention policy
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getPluginRoot, outputSilentSuccess } from '../lib/common.js';

/**
 * Check if mem0 is available
 */
function isMem0Available(): boolean {
  return !!process.env.MEM0_API_KEY;
}

/**
 * Mem0 backup setup hook
 */
export function mem0BackupSetup(input: HookInput): HookResult {
  logHook('mem0-backup', 'Mem0 backup setup starting');

  // Check if mem0 is available
  if (!isMem0Available()) {
    logHook('mem0-backup', 'Mem0 not available, skipping backup setup');
    return outputSilentSuccess();
  }

  const projectDir = input.project_dir || getProjectDir();
  const backupConfig = `${projectDir}/.claude/mem0-backup-config.json`;

  // Backup configuration from environment
  const backupSchedule = process.env.MEM0_BACKUP_SCHEDULE || 'weekly';
  const backupRetention = parseInt(process.env.MEM0_BACKUP_RETENTION || '30', 10);

  // Create backup config
  try {
    mkdirSync(`${projectDir}/.claude`, { recursive: true });

    const config = {
      schedule: backupSchedule,
      retention_days: backupRetention,
      enabled: true,
    };

    writeFileSync(backupConfig, JSON.stringify(config, null, 2));
    logHook('mem0-backup', `Mem0 backup configured: schedule=${backupSchedule}, retention=${backupRetention} days`);
  } catch (error) {
    logHook('mem0-backup', `Failed to create backup config: ${error}`);
  }

  return outputSilentSuccess();
}
