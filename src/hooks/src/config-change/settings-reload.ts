/**
 * ConfigChange Hook: Settings Drift Detector
 *
 * Fires when .claude/settings.json or project config changes mid-session (CC 2.1.49).
 * Reads the changed config, pattern-matches for dangerous states, and either
 * warns (risky) or blocks (dangerous) the change.
 *
 * Issue #962: Implement ConfigChange settings drift detector.
 *
 * @see https://docs.anthropic.com/en/docs/claude-code/hooks
 */

import { readFileSync, existsSync, appendFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { logHook, outputSilentSuccess, outputBlock, outputWarning, getEnvFile } from '../lib/common.js';
import { safeProjectDir } from '../lib/paths.js';
import { safeMkdirSync } from '../lib/safe-fs.js';
import { NOOP_CTX } from '../lib/context.js';

/** Credential-key patterns that should BLOCK the change (raw content scan). */
const BLOCK_PATTERNS = [
  { pattern: /"(API_KEY|SECRET_KEY|AUTH_TOKEN|DB_PASSWORD|PRIVATE_KEY)"\s*:/i, label: 'secret-exposure: credential key in config' },
];

/** Risky patterns that should WARN */
const WARN_PATTERNS = [
  { pattern: /"permissionMode"\s*:\s*"dontAsk"/, label: 'permission-mode: dontAsk bypasses all permission prompts' },
  { pattern: /"permissionMode"\s*:\s*"auto"/, label: 'permission-mode: auto uses classifier-based approval — PermissionDenied hooks still fire' },
  { pattern: /"allow"\s*:.*"Bash"/, label: 'permission-escalation: Bash added to allow list' },
  { pattern: /"deny"\s*:\s*\[\s*\]/, label: 'permission-gap: empty deny list' },
  { pattern: /"hooks"\s*:\s*\{\s*\}/, label: 'hooks-removed: all hooks cleared' },
];

const NO_VERIFY_RE = /--no-verify/;
const HOOK_BYPASS_LABEL = 'hook-bypass: --no-verify in config';

interface DriftResult {
  blocks: string[];
  warnings: string[];
}

/** True when a string grants the git hook bypass flag. */
function hasNoVerify(value: string): boolean {
  return NO_VERIFY_RE.test(value);
}

/**
 * Walk hook trees and return true if any `command` string grants --no-verify.
 * Does not match deny/ask rules or free-text notes (SC47 F3).
 */
function hooksGrantNoVerify(node: unknown): boolean {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some(hooksGrantNoVerify);
  if (typeof node !== 'object') return false;

  const obj = node as Record<string, unknown>;
  if (typeof obj.command === 'string' && hasNoVerify(obj.command)) return true;
  return Object.values(obj).some(hooksGrantNoVerify);
}

/**
 * Structured --no-verify check: only locations that *grant* the bypass count.
 * permissions.deny / permissions.ask / unrelated keys are ignored (SC47 F3).
 */
function grantsNoVerifyBypass(settings: Record<string, unknown>): boolean {
  const permissions = settings.permissions;
  if (permissions && typeof permissions === 'object') {
    const allow = (permissions as Record<string, unknown>).allow;
    if (Array.isArray(allow) && allow.some((e) => typeof e === 'string' && hasNoVerify(e))) {
      return true;
    }
  }

  if (settings.hooks != null && hooksGrantNoVerify(settings.hooks)) return true;

  const env = settings.env;
  if (env && typeof env === 'object') {
    for (const value of Object.values(env as Record<string, unknown>)) {
      if (typeof value === 'string' && hasNoVerify(value)) return true;
    }
  }

  return false;
}

/**
 * Read and scan a config file for dangerous/risky patterns.
 */
function scanConfigFile(filePath: string): DriftResult {
  const result: DriftResult = { blocks: [], warnings: [] };

  if (!existsSync(filePath)) return result;

  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return result;
  }

  // SC47 F3: never raw-regex --no-verify over the whole file — deny/ask rules
  // that forbid the flag would false-positive and block every reload.
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        && grantsNoVerifyBypass(parsed as Record<string, unknown>)) {
      result.blocks.push(HOOK_BYPASS_LABEL);
    }
  } catch {
    // Non-JSON settings: skip structured bypass check (no whole-file fallback).
  }

  for (const { pattern, label } of BLOCK_PATTERNS) {
    if (pattern.test(content)) {
      result.blocks.push(label);
    }
  }

  for (const { pattern, label } of WARN_PATTERNS) {
    if (pattern.test(content)) {
      result.warnings.push(label);
    }
  }

  return result;
}

/**
 * Check if security-critical hooks are missing from hooks.json.
 */
function checkHooksIntegrity(projectDir: string): string[] {
  const hooksPath = join(projectDir, '.claude', 'settings.json');
  if (!existsSync(hooksPath)) return [];

  let content: string;
  try {
    content = readFileSync(hooksPath, 'utf8');
  } catch {
    return [];
  }

  const findings: string[] = [];

  // Check if PreToolUse hooks exist (security-critical)
  if (content.includes('"PreToolUse"') && /"PreToolUse"\s*:\s*\[\s*\]/.test(content)) {
    findings.push('security-hooks-cleared: PreToolUse hooks array is empty');
  }

  // Check if PermissionRequest hooks exist
  if (content.includes('"PermissionRequest"') && /"PermissionRequest"\s*:\s*\[\s*\]/.test(content)) {
    findings.push('permission-hooks-cleared: PermissionRequest hooks array is empty');
  }

  return findings;
}

/**
 * Persist config change to JSONL audit trail.
 */
function writeAuditEntry(projectDir: string, entry: { session: string; action: string; details: string[] }): void {
  try {
    const logsDir = join(projectDir, '.claude', 'logs');
    safeMkdirSync(logsDir, { recursive: true });
    const line = `${JSON.stringify({ ...entry, timestamp: new Date().toISOString() })}\n`;
    appendFileSync(join(logsDir, 'config-changes.jsonl'), line);
  } catch {
    // Non-critical — never crash on audit write
  }
}

/**
 * Sync OrchestKit debug mode with CC's /debug toggle (CC 2.1.71).
 *
 * When /debug is toggled on, CC sets CLAUDE_DEBUG=1 in the process env.
 * Two channels, for two different readers (#3806, measured on CC 2.1.251):
 *   - the flag file (~/.claude/logs/ork/debug-mode.flag) is what HOOKS read,
 *     via getLogLevel() in lib/env.ts. No hook event receives a variable
 *     exported through CLAUDE_ENV_FILE, so this is the working path, not a
 *     fallback.
 *   - `export ORK_DEBUG=1` in CLAUDE_ENV_FILE reaches the Bash tool's
 *     environment only, so a shell command Claude runs sees $ORK_DEBUG.
 *
 * When /debug is toggled off, CLAUDE_DEBUG is unset; we clear ORK_DEBUG
 * via the env file and remove the flag file.
 */
function syncDebugMode(): void {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const flagDir = join(home, '.claude', 'logs', 'ork');
  const flagPath = join(flagDir, 'debug-mode.flag');

  if (process.env.CLAUDE_DEBUG) {
    // /debug is ON: env file for Bash tool commands, flag file for hooks (#3806)
    try {
      const envFile = getEnvFile();
      appendFileSync(envFile, `export ORK_DEBUG=1\n`);
    } catch {
      // Non-fatal — older CC versions may not provide CLAUDE_ENV_FILE
    }

    if (!existsSync(flagPath)) {
      safeMkdirSync(flagDir, { recursive: true });
      writeFileSync(flagPath, `enabled=${new Date().toISOString()}\nsession=${process.env.CLAUDE_SESSION_ID || 'unknown'}\n`);
    }
    logHook('config-change', 'Debug mode enabled — OrchestKit hooks now logging at debug level', 'info');
  } else {
    // /debug is OFF — clear ORK_DEBUG via env file and remove flag file
    try {
      const envFile = getEnvFile();
      appendFileSync(envFile, `export ORK_DEBUG=\n`);
    } catch {
      // Non-fatal
    }

    if (existsSync(flagPath)) {
      try { unlinkSync(flagPath); } catch { /* ok */ }
    }
    logHook('config-change', 'Debug mode disabled — OrchestKit hooks returning to warn level', 'info');
  }
}

export function settingsReload(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const sessionId = input.session_id || 'unknown';
  const projectDir = safeProjectDir(input.project_dir);

  ctx.log('config-change', `Settings changed mid-session (session: ${sessionId})`);

  // Sync debug mode with CC's /debug toggle (CC 2.1.71)
  syncDebugMode();

  // CC documents ConfigChange layer as `source` (not `config_source`):
  // https://docs.claude.com/en/docs/claude-code/hooks#configchange-input
  // A hook's block/warn is meaningless for `policy_settings` (managed policy
  // always takes effect — CC ignores the block) and `skills` (not a settings
  // file). Audit + silent-success for those. (#1264 Phase 3)
  // `config_source` is a legacy invented alias — still accepted as fallback.
  const configSource = (typeof input.source === 'string' ? input.source : undefined)
    ?? input.config_source;
  if (configSource === 'policy_settings' || configSource === 'skills') {
    writeAuditEntry(projectDir, { session: sessionId, action: 'skip', details: [configSource] });
    return outputSilentSuccess();
  }

  try {
    const projectSettings = join(projectDir, '.claude', 'settings.json');
    const userSettings = join(process.env.HOME || '', '.claude', 'settings.json');

    // CC sends optional `file_path` for the specific file that changed. When
    // present, scan only that file — do not re-block on an untouched sibling.
    const changedPath = typeof input.file_path === 'string' && input.file_path.length > 0
      ? input.file_path
      : undefined;
    const filesToScan = changedPath ? [changedPath] : [projectSettings, userSettings];

    const scanned = filesToScan.map(scanConfigFile);
    const allBlocks = scanned.flatMap((r) => r.blocks);
    const pathWarnings = scanned.flatMap((r) => r.warnings);

    const checkIntegrity = !changedPath || changedPath === projectSettings;
    const hooksFindings = checkIntegrity ? checkHooksIntegrity(projectDir) : [];

    const allWarnings = [...pathWarnings, ...hooksFindings];

    // BLOCK: dangerous patterns found
    if (allBlocks.length > 0) {
      const reason = `[ConfigChange] BLOCKED — dangerous config state detected:\n${allBlocks.map(b => `  - ${b}`).join('\n')}\n\nRevert the change or remove the dangerous pattern.`;
      ctx.log('config-change', `BLOCKED: ${allBlocks.join('; ')}`, 'warn');
      ctx.logPermission('deny', `ConfigChange blocked: ${allBlocks.join('; ')}`);
      writeAuditEntry(projectDir, { session: sessionId, action: 'block', details: allBlocks });
      return outputBlock(reason);
    }

    // WARN: risky patterns found
    if (allWarnings.length > 0) {
      const warningMsg = `Config change detected with risks:\n${allWarnings.map(w => `  - ${w}`).join('\n')}`;
      ctx.log('config-change', `WARNING: ${allWarnings.join('; ')}`, 'warn');
      ctx.logPermission('warn', `ConfigChange warning: ${allWarnings.join('; ')}`);
      writeAuditEntry(projectDir, { session: sessionId, action: 'warn', details: allWarnings });
      return outputWarning(warningMsg);
    }

    // SAFE: no issues. CC does NOT read additionalContext on ConfigChange (#1794),
    // so the prior advisory string was silently stripped — the audit row is the
    // record. (#1264 Phase 3: was a dead outputPromptContext.)
    writeAuditEntry(projectDir, { session: sessionId, action: 'pass', details: [] });
    return outputSilentSuccess();
  } catch (err) {
    // Never crash on config read errors — fall back to advisory
    ctx.log('config-change', `Error scanning config: ${(err as Error).message}`, 'error');
    return outputSilentSuccess();
  }
}
