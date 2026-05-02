/**
 * CC Version Check — drift-warn hook (M130 #1487)
 *
 * Fires on SessionStart. Three branches:
 *   - Below floor (< MIN_CC_VERSION)         → systemMessage warning to the user
 *   - Above matrix (> latestMatrixVersion)   → additionalContext nudge to Claude with adoption pointer
 *   - In range                                → silent success
 *
 * Rate-limited to once per session via .claude/state/cc-version-check-<session_id>.flag
 * Opt-out: ORK_NO_CC_VERSION_CHECK=1
 *
 * Read shared/cc-support.json for canonical floor (Part C source of truth).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookContext, HookInput, HookResult } from '../types.js';
import { outputPromptContext, outputSilentSuccess, outputWithNotification } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';
import { CC_FEATURE_MATRIX, MIN_CC_VERSION, compareCCVersions } from '../lib/cc-version-matrix.js';

const SUPPORT_JSON_REL = 'shared/cc-support.json';
const STATE_DIR_REL = '.claude/state';

interface SupportJson {
  latest?: string;
  supported_floor?: string;
}

function readSupportJson(projectDir: string): SupportJson | null {
  try {
    const path = join(projectDir, SUPPORT_JSON_REL);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as SupportJson;
  } catch {
    return null;
  }
}

function latestMatrixVersion(): string {
  let latest = MIN_CC_VERSION;
  for (const entry of CC_FEATURE_MATRIX) {
    if (compareCCVersions(entry.minVersion, latest) > 0) latest = entry.minVersion;
  }
  return latest;
}

function safeSessionId(raw: string): string {
  // CC supplies UUIDs, but hook input is untrusted by convention. A
  // session_id of `../../etc/passwd` would traverse outside .claude/state.
  // Restrict to a safe character set; truncate to keep filenames short.
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return cleaned || 'no-session';
}

function rateLimitOk(projectDir: string, sessionId: string): boolean {
  const dir = join(projectDir, STATE_DIR_REL);
  const flag = join(dir, `cc-version-check-${safeSessionId(sessionId)}.flag`);
  if (existsSync(flag)) return false;
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(flag, new Date().toISOString());
  } catch {
    // If the flag file can't be written, fall through and let the hook fire — better
    // to nudge twice than to silently never warn at all on a transient FS issue.
  }
  return true;
}

export function ccVersionCheck(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  if (process.env.ORK_NO_CC_VERSION_CHECK === '1') return outputSilentSuccess();

  const running = process.env.CLAUDE_CODE_VERSION;
  if (!running) return outputSilentSuccess();

  const projectDir = input.project_dir || ctx.projectDir;
  const sessionId = input.session_id || 'no-session';
  if (!rateLimitOk(projectDir, sessionId)) return outputSilentSuccess();

  // Floor: prefer shared/cc-support.json (Part C SoT), fall back to MIN_CC_VERSION constant.
  const support = readSupportJson(projectDir);
  const floor = support?.supported_floor || MIN_CC_VERSION;
  const matrixLatest = latestMatrixVersion();

  if (compareCCVersions(running, floor) < 0) {
    ctx.log('cc-version-check', `running=${running} < floor=${floor} — warning user`);
    return outputWithNotification(
      `⚠ Claude Code ${running} is below OrchestKit's supported floor (${floor}). Some hooks and skills may no-op or error. See shared/rules/cc-support-policy.md.`,
      undefined,
    );
  }

  if (compareCCVersions(running, matrixLatest) > 0) {
    ctx.log('cc-version-check', `running=${running} > matrix=${matrixLatest} — adoption nudge to Claude`);
    return outputPromptContext(
      `[cc-version-check] Running CC ${running} — OrchestKit's feature matrix knows up to ${matrixLatest}. ` +
        `New features may be available for adoption. Check shared/cc-adoption-gaps.json or open issues with label "cc-adoption".`,
    );
  }

  ctx.log('cc-version-check', `running=${running} in [${floor}, ${matrixLatest}] — silent`);
  return outputSilentSuccess();
}
