/**
 * HookContext factory — constructs the production context from real environment.
 * Called once per hook process in run-hook.mjs.
 */

import type { HookContext, LogLevel } from '../types.js';
import { getProjectDir, getLogDir, getPluginRoot, getPluginDataDir, getSessionId, getCachedBranch, getLogLevel, shouldLog } from './env.js';
import { logHook, logPermissionFeedback, writeRulesFile } from './log.js';

/**
 * Build the production HookContext from real environment.
 * All env reads happen HERE, once, at construction time.
 */
export function buildContext(): HookContext {
  const projectDir = getProjectDir();
  return {
    projectDir,
    logDir: getLogDir(),
    pluginRoot: getPluginRoot(),
    pluginDataDir: getPluginDataDir(),
    sessionId: getSessionId(),
    branch: getCachedBranch(projectDir),
    logLevel: getLogLevel(),
    log: logHook,
    logPermission: logPermissionFeedback,
    writeRules: writeRulesFile,
    shouldLog,
  };
}

// ---------------------------------------------------------------------------
// Fallback context — used as default parameter in hook signatures so that
// tests which call hook(input) without ctx still work at runtime.
// Production always passes the real context from run-hook.mjs.
// ---------------------------------------------------------------------------

const _noop = (): void => {};

/**
 * No-op HookContext for backward compatibility in tests.
 * All methods are silent no-ops; all paths return safe defaults.
 *
 * Hooks declare `ctx: HookContext = NOOP_CTX` so the TYPE is required
 * but the JS runtime won't crash if a test omits it.
 */
export const NOOP_CTX: HookContext = {
  projectDir: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  logDir: '',
  pluginRoot: '',
  pluginDataDir: null,
  sessionId: '',
  branch: '',
  logLevel: 'warn',
  log: _noop as HookContext['log'],
  logPermission: _noop as HookContext['logPermission'],
  writeRules: (() => false) as unknown as HookContext['writeRules'],
  shouldLog: ((_level: LogLevel) => false) as HookContext['shouldLog'],
};
