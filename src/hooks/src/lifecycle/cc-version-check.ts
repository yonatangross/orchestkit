/**
 * CC Version Check — drift-warn hook (M130 #1487)
 *
 * Fires on SessionStart. Four branches:
 *   - Version unresolvable                    → additionalContext saying the check did NOT run
 *   - Below floor (< MIN_CC_VERSION)          → systemMessage warning to the user
 *   - Above latest-known (> LATEST_KNOWN_CC)  → additionalContext nudge to Claude with adoption pointer
 *   - In range                                → silent success
 *
 * The first branch is why this file changed (2026-08-28). It used to read
 * process.env.CLAUDE_CODE_VERSION and return outputSilentSuccess() when unset. CC does
 * not set that variable in the hook environment, so the hook has produced exactly one
 * outcome since it shipped: silence, on every session, whatever version was running.
 * The corroborating measurement is session-registrar, which reads the same variable and
 * recorded cc_version NULL in 3542 of 3542 rows of the local sessions.db. Nothing was
 * wrong with the version comparison; the input to it was never populated. See
 * resolveRunningCC() for the source chain that replaced the single lookup.
 *
 * Rate-limited to once per session via .claude/state/cc-version-check-<session_id>.flag
 * Opt-out: ORK_NO_CC_VERSION_CHECK=1
 *
 * Read shared/cc-support.json for canonical floor (Part C source of truth).
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { HookContext, HookInput, HookResult } from '../types.js';
import { outputSessionStartContext, outputSilentSuccess, outputWithNotification } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';
import { LATEST_KNOWN_CC, MIN_CC_VERSION, compareCCVersions } from '../lib/cc-version-matrix.js';

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

const SEMVER_RE = /^\d+\.\d+\.\d+/;
const TRANSCRIPT_SCAN_BYTES = 65536;

/**
 * Read the running CC version from the session transcript.
 *
 * CC stamps `"version":"<x.y.z>"` on user/assistant/system/attachment records. It does
 * NOT appear on the first record, so this scans a bounded prefix rather than reading
 * a transcript that can reach megabytes inside a 3s SessionStart budget.
 *
 * Returns null on a brand-new session whose transcript has no versioned record yet;
 * that is a real miss, not an error, and the caller must not treat it as "in range".
 */
function versionFromTranscript(transcriptPath: string | undefined): string | null {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  let fd: number | null = null;
  try {
    fd = openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(TRANSCRIPT_SCAN_BYTES);
    const read = readSync(fd, buf, 0, TRANSCRIPT_SCAN_BYTES, 0);
    if (read <= 0) return null;
    const m = /"version"\s*:\s*"(\d+\.\d+\.\d+)"/.exec(buf.toString('utf8', 0, read));
    return m ? m[1] : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* fd already gone; nothing to salvage */
      }
    }
  }
}

/**
 * Fall back to the version the `claude` launcher currently resolves to, e.g.
 * ~/.local/share/claude/versions/2.1.250.
 *
 * Deliberately weaker than the transcript: it reports what the launcher points at
 * NOW, which is not necessarily what this session is running (three versions are
 * commonly installed side by side, and an auto-update moves the pointer under a
 * live session). Used only when the transcript cannot answer.
 */
function versionFromInstallPath(): string | null {
  for (const candidate of [join(homedir(), '.local/bin/claude'), join(homedir(), '.claude/local/claude')]) {
    try {
      if (!existsSync(candidate)) continue;
      const m = /\/versions\/(\d+\.\d+\.\d+)/.exec(realpathSync(candidate));
      if (m) return m[1];
    } catch {
      /* unreadable candidate; try the next */
    }
  }
  return null;
}

/**
 * Resolve the running CC version, most authoritative source first.
 *
 * `CLAUDE_CODE_VERSION` stays the primary because it is the cheapest and the
 * documented contract, but it is NOT set in the hook environment on 2.1.250:
 * measured across every row of the local sessions.db, session-registrar recorded
 * cc_version NULL 3542 times out of 3542. This hook read the same var and returned
 * outputSilentSuccess(), so the floor warning and the adoption nudge have never
 * fired for anyone. Which is why the source list exists rather than one lookup.
 */
export function resolveRunningCC(input: HookInput): { version: string; source: string } | null {
  const env = process.env.CLAUDE_CODE_VERSION;
  if (env && SEMVER_RE.test(env)) return { version: env, source: 'env' };

  const fromTranscript = versionFromTranscript(input.transcript_path);
  if (fromTranscript) return { version: fromTranscript, source: 'transcript' };

  const fromInstall = versionFromInstallPath();
  if (fromInstall) return { version: fromInstall, source: 'install-path' };

  return null;
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

  const projectDir = input.project_dir || ctx.projectDir;
  const sessionId = input.session_id || 'no-session';
  if (!rateLimitOk(projectDir, sessionId)) return outputSilentSuccess();

  const resolved = resolveRunningCC(input);
  if (!resolved) {
    // Could-not-observe is its own outcome. The previous version returned
    // outputSilentSuccess() here, which is indistinguishable from "your version is
    // fine" — so a check that never once ran looked identical to a check that
    // passed, every session, for months. Say so instead of implying a verdict.
    ctx.log('cc-version-check', 'could not resolve the running CC version — check did NOT run');
    return outputSessionStartContext(
      '[cc-version-check] Could not determine the running Claude Code version (no CLAUDE_CODE_VERSION, ' +
        'no versioned transcript record, no resolvable install path). The support-floor and adoption ' +
        'checks did NOT run this session. This is not a pass. Set ORK_NO_CC_VERSION_CHECK=1 to silence.',
    );
  }
  const running = resolved.version;

  // Floor: prefer shared/cc-support.json (Part C SoT), fall back to MIN_CC_VERSION constant.
  const support = readSupportJson(projectDir);
  const floor = support?.supported_floor || MIN_CC_VERSION;
  const matrixLatest = LATEST_KNOWN_CC;

  if (compareCCVersions(running, floor) < 0) {
    ctx.log('cc-version-check', `running=${running} (via ${resolved.source}) < floor=${floor} — warning user`);
    return outputWithNotification(
      `⚠ Claude Code ${running} is below OrchestKit's supported floor (${floor}). Some hooks and skills may no-op or error. See shared/rules/cc-support-policy.md.`,
      undefined,
    );
  }

  if (compareCCVersions(running, matrixLatest) > 0) {
    ctx.log('cc-version-check', `running=${running} (via ${resolved.source}) > matrix=${matrixLatest} — adoption nudge to Claude`);
    return outputSessionStartContext(
      `[cc-version-check] Running CC ${running} — OrchestKit's feature matrix knows up to ${matrixLatest}. ` +
        `New features may be available for adoption. Suggest /release-notes (CC 2.1.173+) for the upstream notes; ` +
        `check shared/cc-adoption-gaps.json or open issues with label "cc-adoption".`,
    );
  }

  ctx.log('cc-version-check', `running=${running} (via ${resolved.source}) in [${floor}, ${matrixLatest}] — silent`);
  return outputSilentSuccess();
}
