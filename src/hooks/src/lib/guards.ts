/**
 * Self-guard helpers for TypeScript hooks
 * Ported from hooks/_lib/common.sh guard functions
 *
 * Guards are predicates that determine if a hook should run.
 * They return `true` to run the hook, `false` to skip it.
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess } from './common.js';

/**
 * Guard result type - either continue (null) or skip with result
 */
export type GuardResult = HookResult | null;

/**
 * Create a guard that returns silent success if predicate fails
 */
export function createGuard(
  predicate: (input: HookInput) => boolean
): (input: HookInput) => GuardResult {
  return (input: HookInput) => (predicate(input) ? null : outputSilentSuccess());
}

// -----------------------------------------------------------------------------
// File Extension Guards
// -----------------------------------------------------------------------------

/**
 * Guard: Only run for specific file extensions
 */
export function guardFileExtension(
  input: HookInput,
  ...extensions: string[]
): GuardResult {
  const filePath = input.tool_input.file_path;
  if (!filePath) return outputSilentSuccess();

  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const normalizedExtensions = extensions.map((e) => e.toLowerCase().replace(/^\./, ''));

  if (normalizedExtensions.includes(ext)) {
    return null; // Continue with hook
  }

  return outputSilentSuccess();
}

/**
 * Guard: Only run for code files
 */
export function guardCodeFiles(input: HookInput): GuardResult {
  return guardFileExtension(input, 'py', 'ts', 'tsx', 'js', 'jsx', 'go', 'rs', 'java');
}

/**
 * Guard: Only run for Python files
 */
export function guardPythonFiles(input: HookInput): GuardResult {
  return guardFileExtension(input, 'py');
}

/**
 * Guard: Only run for TypeScript/JavaScript files
 */
export function guardTypescriptFiles(input: HookInput): GuardResult {
  return guardFileExtension(input, 'ts', 'tsx', 'js', 'jsx');
}

// -----------------------------------------------------------------------------
// Path Pattern Guards
// -----------------------------------------------------------------------------

/**
 * Guard: Only run for test files
 */
export function guardTestFiles(input: HookInput): GuardResult {
  const filePath = input.tool_input.file_path;
  if (!filePath) return outputSilentSuccess();

  const testPatterns = [/test/i, /spec/i, /__tests__/i];
  if (testPatterns.some((p) => p.test(filePath))) {
    return null; // Continue with hook
  }

  return outputSilentSuccess();
}

/**
 * Guard: Skip internal/generated files
 */
export function guardSkipInternal(input: HookInput): GuardResult {
  const filePath = input.tool_input.file_path || '';
  if (!filePath) return null; // No file path, continue

  // Skip these directories/patterns
  const skipPatterns = [
    /\/\.claude\//,
    /\/node_modules\//,
    /\/\.git\//,
    /\/dist\//,
    /\/build\//,
    /\/__pycache__\//,
    /\/\.venv\//,
    /\/venv\//,
    /\.lock$/,
  ];

  if (skipPatterns.some((p) => p.test(filePath))) {
    return outputSilentSuccess();
  }

  return null; // Continue with hook
}

/**
 * Guard: Only run for files matching path patterns
 */
export function guardPathPattern(input: HookInput, ...patterns: (string | RegExp)[]): GuardResult {
  const filePath = input.tool_input.file_path;
  if (!filePath) return outputSilentSuccess();

  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      // Simple glob-like matching
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
      if (regex.test(filePath)) return null;
    } else {
      if (pattern.test(filePath)) return null;
    }
  }

  return outputSilentSuccess();
}

// -----------------------------------------------------------------------------
// Tool Guards
// -----------------------------------------------------------------------------

/**
 * Guard: Only run for specific tool names
 */
export function guardTool(input: HookInput, ...tools: string[]): GuardResult {
  const toolName = input.tool_name;
  if (!toolName) return outputSilentSuccess();

  if (tools.includes(toolName)) {
    return null; // Continue with hook
  }

  return outputSilentSuccess();
}

/**
 * Guard: Only run for Write or Edit tools
 */
export function guardWriteEdit(input: HookInput): GuardResult {
  return guardTool(input, 'Write', 'Edit');
}

/**
 * Guard: Only run for Bash tool
 */
export function guardBash(input: HookInput): GuardResult {
  return guardTool(input, 'Bash');
}

// -----------------------------------------------------------------------------
// Command Guards
// -----------------------------------------------------------------------------

/**
 * Guard: Only run for non-trivial bash commands
 */
export function guardNontrivialBash(input: HookInput): GuardResult {
  const command = input.tool_input.command || '';

  // Skip trivial commands
  const trivialPatterns = [
    /^echo\s/,
    /^ls(\s|$)/,
    /^pwd$/,
    /^cat\s/,
    /^head\s/,
    /^tail\s/,
    /^wc\s/,
    /^date$/,
    /^whoami$/,
  ];

  if (trivialPatterns.some((p) => p.test(command))) {
    return outputSilentSuccess();
  }

  return null; // Continue with hook
}

/**
 * Guard: Only run for git commands
 */
export function guardGitCommand(input: HookInput): GuardResult {
  const command = input.tool_input.command || '';

  if (command.startsWith('git')) {
    return null; // Continue with hook
  }

  return outputSilentSuccess();
}

// -----------------------------------------------------------------------------
// Environment Guards
// -----------------------------------------------------------------------------

/**
 * Guard: Only run if multi-instance coordination is enabled
 */
export function guardMultiInstance(input: HookInput): GuardResult {
  const projectDir = input.project_dir || process.env.CLAUDE_PROJECT_DIR || '.';
  const dbPath = `${projectDir}/.claude/coordination/.claude.db`;

  try {
    const { existsSync } = require('node:fs');
    if (existsSync(dbPath)) {
      return null; // Continue with hook
    }
  } catch {
    // Ignore errors
  }

  return outputSilentSuccess();
}

// -----------------------------------------------------------------------------
// Composite Guards
// -----------------------------------------------------------------------------

/**
 * Run multiple guards in sequence, return first skip result or null to continue
 */
export function runGuards(input: HookInput, ...guards: ((input: HookInput) => GuardResult)[]): GuardResult {
  for (const guard of guards) {
    const result = guard(input);
    if (result !== null) {
      return result; // Skip with this result
    }
  }
  return null; // All guards passed, continue
}
