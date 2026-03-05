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

import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { logHook, outputSilentSuccess, outputBlock, outputWarning, outputPromptContext, logPermissionFeedback } from '../lib/common.js';

/** Dangerous patterns that should BLOCK the change */
const BLOCK_PATTERNS = [
  { pattern: /--no-verify/, label: 'hook-bypass: --no-verify in config' },
  { pattern: /"(API_KEY|SECRET_KEY|AUTH_TOKEN|DB_PASSWORD|PRIVATE_KEY)"\s*:/i, label: 'secret-exposure: credential key in config' },
];

/** Risky patterns that should WARN */
const WARN_PATTERNS = [
  { pattern: /"permissionMode"\s*:\s*"dontAsk"/, label: 'permission-mode: dontAsk bypasses all permission prompts' },
  { pattern: /"allow"\s*:.*"Bash"/, label: 'permission-escalation: Bash added to allow list' },
  { pattern: /"deny"\s*:\s*\[\s*\]/, label: 'permission-gap: empty deny list' },
  { pattern: /"hooks"\s*:\s*\{\s*\}/, label: 'hooks-removed: all hooks cleared' },
];

interface DriftResult {
  blocks: string[];
  warnings: string[];
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
    mkdirSync(logsDir, { recursive: true });
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    appendFileSync(join(logsDir, 'config-changes.jsonl'), line);
  } catch {
    // Non-critical — never crash on audit write
  }
}

export function settingsReload(input: HookInput): HookResult {
  const sessionId = input.session_id || 'unknown';
  const projectDir = input.project_dir || process.cwd();

  logHook('config-change', `Settings changed mid-session (session: ${sessionId})`);

  try {
    // Scan both project and user settings
    const projectSettings = join(projectDir, '.claude', 'settings.json');
    const userSettings = join(process.env.HOME || '', '.claude', 'settings.json');

    const projectResult = scanConfigFile(projectSettings);
    const userResult = scanConfigFile(userSettings);
    const hooksFindings = checkHooksIntegrity(projectDir);

    const allBlocks = [...projectResult.blocks, ...userResult.blocks];
    const allWarnings = [...projectResult.warnings, ...userResult.warnings, ...hooksFindings];

    // BLOCK: dangerous patterns found
    if (allBlocks.length > 0) {
      const reason = `[ConfigChange] BLOCKED — dangerous config state detected:\n${allBlocks.map(b => `  - ${b}`).join('\n')}\n\nRevert the change or remove the dangerous pattern.`;
      logHook('config-change', `BLOCKED: ${allBlocks.join('; ')}`, 'warn');
      logPermissionFeedback('deny', `ConfigChange blocked: ${allBlocks.join('; ')}`);
      writeAuditEntry(projectDir, { session: sessionId, action: 'block', details: allBlocks });
      return outputBlock(reason);
    }

    // WARN: risky patterns found
    if (allWarnings.length > 0) {
      const warningMsg = `Config change detected with risks:\n${allWarnings.map(w => `  - ${w}`).join('\n')}`;
      logHook('config-change', `WARNING: ${allWarnings.join('; ')}`, 'warn');
      logPermissionFeedback('warn', `ConfigChange warning: ${allWarnings.join('; ')}`);
      writeAuditEntry(projectDir, { session: sessionId, action: 'warn', details: allWarnings });
      return outputWarning(warningMsg);
    }

    // SAFE: no issues
    writeAuditEntry(projectDir, { session: sessionId, action: 'pass', details: [] });
    return outputPromptContext(
      '[ConfigChange] Project or user settings were modified during this session. ' +
      'Permission rules, hook configurations, or plugin settings may have changed. ' +
      'If a permission was just granted or revoked, it takes effect immediately.'
    );
  } catch (err) {
    // Never crash on config read errors — fall back to advisory
    logHook('config-change', `Error scanning config: ${(err as Error).message}`, 'error');
    return outputSilentSuccess();
  }
}
