/**
 * HookContext factory — constructs the production context from real environment.
 * Called once per hook process in run-hook.mjs.
 */

import type { HookContext } from '../types.js';
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
