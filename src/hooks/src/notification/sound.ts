/**
 * Sound Notifications - Notification Hook
 * CC 2.1.7 Compliant: outputs JSON with suppressOutput
 *
 * Plays sounds for task completion using detached child processes
 * that survive after the hook's Node process exits.
 *
 * Version: 2.0.0 (spawn + detach for reliable playback)
 */

import { execFileSync, spawn } from 'node:child_process';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SOUND_MAP: Record<string, string> = {
  permission_prompt: '/System/Library/Sounds/Sosumi.aiff',
  idle_prompt: '/System/Library/Sounds/Ping.aiff',
  auth_success: '/System/Library/Sounds/Glass.aiff',
  task_complete: '/System/Library/Sounds/Glass.aiff',
  error: '/System/Library/Sounds/Basso.aiff',
  warning: '/System/Library/Sounds/Funk.aiff',
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

let _hasAfplay: boolean | null = null;

function hasAfplay(): boolean {
  if (_hasAfplay !== null) return _hasAfplay;
  try {
    execFileSync('which', ['afplay'], { stdio: 'ignore' });
    _hasAfplay = true;
  } catch {
    _hasAfplay = false;
  }
  return _hasAfplay;
}

/** @internal Test-only: reset the afplay cache */
export function _resetAfplayCacheForTesting(): void {
  _hasAfplay = null;
}

let _linuxPlayer: string | null | undefined ; // undefined = not checked

function getLinuxPlayer(): string | null {
  if (_linuxPlayer !== undefined) return _linuxPlayer;
  for (const player of ['pw-play', 'paplay', 'aplay']) {
    try {
      execFileSync('which', [player], { stdio: 'ignore' });
      _linuxPlayer = player;
      return player;
    } catch {
      // try next
    }
  }
  _linuxPlayer = null;
  return null;
}

/** @internal Test-only: reset the Linux player cache */
export function _resetLinuxPlayerCacheForTesting(): void {
  _linuxPlayer = undefined;
}

const LINUX_SOUND_MAP: Record<string, string> = {
  permission_prompt: '/usr/share/sounds/freedesktop/stereo/dialog-warning.oga',
  idle_prompt: '/usr/share/sounds/freedesktop/stereo/message-new-instant.oga',
  auth_success: '/usr/share/sounds/freedesktop/stereo/complete.oga',
  task_complete: '/usr/share/sounds/freedesktop/stereo/complete.oga',
  error: '/usr/share/sounds/freedesktop/stereo/dialog-error.oga',
  warning: '/usr/share/sounds/freedesktop/stereo/dialog-warning.oga',
};

function playSound(player: string, soundFile: string): void {
  try {
    // Spawn detached process so sound continues playing even after
    // this Node process exits (critical for async hooks).
    const child = spawn(player, [soundFile], {
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

export function soundNotification(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  // CC sends notification_type at root level; tool_input is a fallback
  const notificationType = input.notification_type
    || (input.tool_input?.notification_type as string)
    || '';

  ctx.log('sound', `Sound notification check: [${notificationType}]`);

  // Play sound based on notification_type — macOS first, then Linux
  if (hasAfplay()) {
    const soundFile = SOUND_MAP[notificationType];
    if (soundFile) {
      playSound('afplay', process.env[`ORK_SOUND_${notificationType.toUpperCase()}`] || soundFile);
    }
  } else {
    const linuxPlayer = getLinuxPlayer();
    if (linuxPlayer) {
      const soundFile = LINUX_SOUND_MAP[notificationType];
      if (soundFile) {
        playSound(linuxPlayer, process.env[`ORK_SOUND_${notificationType.toUpperCase()}`] || soundFile);
      }
    }
  }

  return outputSilentSuccess();
}
