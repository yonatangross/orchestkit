/**
 * Sound Notifications - Notification Hook
 * CC 2.1.7 Compliant: outputs JSON with suppressOutput
 *
 * Plays sounds for task completion using detached child processes
 * that survive after the hook's Node process exits.
 *
 * Version: 2.0.0 (spawn + detach for reliable playback)
 */

import { execSync, spawn } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SOUND_MAP: Record<string, string> = {
  permission_prompt: '/System/Library/Sounds/Sosumi.aiff',
  idle_prompt: '/System/Library/Sounds/Ping.aiff',
  auth_success: '/System/Library/Sounds/Glass.aiff',
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function hasAfplay(): boolean {
  try {
    execSync('command -v afplay', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function playSound(soundFile: string): void {
  try {
    // Spawn detached process so sound continues playing even after
    // this Node process exits (critical for async hooks).
    const child = spawn('afplay', [soundFile], {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
  } catch {
    // Ignore errors — notification sounds are best-effort
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function soundNotification(input: HookInput): HookResult {
  const toolInput = input.tool_input || {};
  const notificationType = (toolInput.notification_type as string) || '';

  logHook('sound', `Sound notification check: [${notificationType}]`);

  // Play sound based on notification_type (macOS only)
  if (hasAfplay()) {
    const soundFile = SOUND_MAP[notificationType];
    if (soundFile) {
      playSound(soundFile);
    }
  }

  return outputSilentSuccess();
}
