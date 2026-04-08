/**
 * Common utilities — BARREL RE-EXPORT
 *
 * v7.29.0: Split into focused modules for testability.
 * This barrel re-exports everything so existing `import { x } from 'common.js'`
 * continues to work. New code should import from the specific module:
 *
 *   import { outputBlock } from '../lib/output.js';  // pure, never mock
 *   import { getProjectDir } from '../lib/env.js';   // mock only when path matters
 *   import { logHook } from '../lib/log.js';         // mock only when testing logs
 */

// Pure core — deterministic functions, zero side effects, NEVER needs mocking
export {
  outputSilentSuccess,
  outputSilentAllow,
  outputBlock,
  outputWithContext,
  outputPromptContext,
  outputPromptContextWithTitle,
  outputWithNotification,
  outputAllowWithContext,
  outputError,
  outputWarning,
  outputDeny,
  outputAsk,
  outputDefer,
  outputWithUpdatedInput,
  extractContext,
  estimateTokenCount,
  outputPromptContextBudgeted,
  normalizeLineEndings,
  normalizeCommand,
  escapeRegex,
  fnv1aHash,
  lineContainsAll,
  lineContainsAllCI,
  getField,
} from './output.js';

// Environment readers — read process.env, spawn git
export {
  getLogDir,
  getProjectDir,
  getPluginRoot,
  getPluginDataDir,
  getEnvFile,
  getSessionId,
  getCachedBranch,
  getLogLevel,
  shouldLog,
} from './env.js';

// Side effects — write to filesystem, stderr
export {
  logHook,
  logPermissionFeedback,
  outputStderrWarning,
  writeRulesFile,
  readHookInput,
} from './log.js';
