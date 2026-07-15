/**
 * Sound Notifications - Notification Hook
 * CC 2.1.7 Compliant: outputs JSON with suppressOutput
 *
 * PRIMARY PATH (#1847): returns the top-level `terminalSequence` hook-output
 * field with a BEL (\u0007). CC emits it to the user's terminal, which rings
 * the terminal bell — zero process spawns, works on macOS + Linux, command
 * hooks only. Only known notification types (the SOUND_MAP keys) ring.
 *
 * LEGACY FALLBACK: set ORK_NOTIFY_OSASCRIPT=1 (shared with desktop.ts) to
 * restore the old behavior of spawning `afplay` (macOS) / pw-play|paplay|aplay
 * (Linux) with per-type sound files and ORK_SOUND_<TYPE> overrides — for
 * terminals with the bell muted or when distinct per-event sounds are wanted.
 *
 * Version: 3.0.0 (terminalSequence BEL primary, afplay legacy via env flag)
 */

import { execFileSync, spawn } from 'node:child_process';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';
import { outputTerminalSequence } from '../lib/output.js';
import { NOOP_CTX } from '../lib/context.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/** BEL — rings the terminal bell (primary path, #1847). */
const BEL = '\u0007';

const SOUND_MAP: Record<string, string> = {
  permission_prompt: '/System/Library/Sounds/Sosumi.aiff',
  idle_prompt: '/System/Library/Sounds/Ping.aiff',
  auth_success: '/System/Library/Sounds/Glass.aiff',
  task_complete: '/System/Library/Sounds/Glass.aiff',
  error: '/System/Library/Sounds/Basso.aiff',
  warning: '/System/Library/Sounds/Funk.aiff',
  // Background agent events (CC 2.1.198+)
  agent_needs_input: '/System/Library/Sounds/Ping.aiff',
  agent_completed: '/System/Library/Sounds/Glass.aiff',
};

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

let _hasAfplay: boolean | null = null;

function hasAfplay(): boolean {
  if (_hasAfplay !== null) return _hasAfplay;
  try {
    execFileSync('which', ['afplay'], { stdio: 'ignore', windowsHide: true });
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
      execFileSync('which', [player], { stdio: 'ignore', windowsHide: true });
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
  // Background agent events (CC 2.1.198+)
  agent_needs_input: '/usr/share/sounds/freedesktop/stereo/message-new-instant.oga',
  agent_completed: '/usr/share/sounds/freedesktop/stereo/complete.oga',
};

function playSound(player: string, soundFile: string): void {
  try {
    // Spawn detached process so sound continues playing even after
    // this Node process exits (critical for async hooks).
    const child = spawn(player, [soundFile], {
      stdio: 'ignore', windowsHide: true,
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
  // Global opt-out for OrchestKit Notification hooks (desktop banner + sound).
  // Mirrors desktop.ts + the ORK_NO_* opt-out convention (#2430).
  if (process.env.ORK_NO_NOTIFY === '1') return outputSilentSuccess();

  // CC sends notification_type at root level; tool_input is a fallback
  const notificationType = input.notification_type
    || (input.tool_input?.notification_type as string)
    || '';

  ctx.log('sound', `Sound notification check: [${notificationType}]`);

  // Unknown/unmapped notification types never make noise. The type string is
  // untrusted input — Object.hasOwn (not a bare truthy lookup) so prototype
  // keys like "constructor" can't slip through as a mapped type.
  if (!Object.hasOwn(SOUND_MAP, notificationType)) {
    return outputSilentSuccess();
  }

  // LEGACY fallback (#1847): explicit opt-in only. Spawns a native player
  // with per-type sound files instead of emitting the BEL terminalSequence.
  if (process.env.ORK_NOTIFY_OSASCRIPT === '1') {
    if (hasAfplay()) {
      playSound('afplay', process.env[`ORK_SOUND_${notificationType.toUpperCase()}`] || SOUND_MAP[notificationType]);
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

  // PRIMARY path (#1847): terminal bell via terminalSequence — no spawns.
  // terminalSequence is macOS/Linux only; skip on Windows.
  if (process.platform === 'win32') return outputSilentSuccess();

  return outputTerminalSequence(BEL);
}
