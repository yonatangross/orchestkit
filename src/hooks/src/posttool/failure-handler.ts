/**
 * PostToolUseFailure Handler
 * CC 2.1.25: Error-path hook providing solution suggestions when tools fail
 *
 * Analyzes tool failures and injects helpful context via additionalContext
 */

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';
import { getLogDir } from '../lib/paths.js';
import { atomicWriteSync } from '../lib/atomic-write.js';
import { extractStructuredError } from '../lib/retry-manager.js';
import { NOOP_CTX } from '../lib/context.js';

// Common failure patterns and their solutions
const FAILURE_PATTERNS: Array<{ pattern: RegExp; suggestion: string }> = [
  {
    pattern: /ENOENT|no such file|not found/i,
    suggestion: 'File not found. Check the path exists. Use Glob to search for the correct filename.',
  },
  {
    pattern: /EACCES|permission denied/i,
    suggestion: 'Permission denied. The file may be read-only or owned by another user.',
  },
  {
    pattern: /ECONNREFUSED|ETIMEDOUT|network/i,
    suggestion: 'Network error. Check if the service is running and accessible.',
  },
  {
    pattern: /syntax error|SyntaxError|parse error/i,
    suggestion: 'Syntax error in the code. Review the file for missing brackets, quotes, or semicolons.',
  },
  {
    pattern: /command not found|not recognized/i,
    suggestion: 'Command not found. Check if the tool is installed and in PATH.',
  },
  {
    pattern: /timeout|timed out/i,
    suggestion: 'Command timed out. Consider increasing the timeout or breaking the command into smaller steps.',
  },
  {
    pattern: /ENOMEM|out of memory|heap/i,
    suggestion: 'Out of memory. Try processing smaller chunks or increasing available memory.',
  },
  {
    pattern: /merge conflict|CONFLICT/i,
    suggestion: 'Merge conflict detected. Resolve conflicts manually before continuing.',
  },
  {
    pattern: /lock|locked|ELOCK/i,
    suggestion: 'Resource is locked. Wait for the lock to be released or check for stale locks.',
  },
  {
    pattern: /type error|TypeError|cannot read prop/i,
    suggestion: 'Type error. Check for null/undefined values and ensure correct types are passed.',
  },
];

/** Track failures and auto-enable debug mode after 3 in a session */
const FAILURE_THRESHOLD = 3;

function getFailureCountPath(): string {
  return join(getLogDir(), 'failure-count.json');
}

function trackFailureAndMaybeEnableDebug(): void {
  try {
    const countPath = getFailureCountPath();
    const dir = getLogDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    let count = 0;
    if (existsSync(countPath)) {
      const data = JSON.parse(readFileSync(countPath, 'utf8')) as { count?: number };
      count = data.count ?? 0;
    }
    count++;
    atomicWriteSync(countPath, JSON.stringify({ count, last: new Date().toISOString() }));

    if (count === FAILURE_THRESHOLD) {
      // Auto-enable debug mode
      const home = process.env.HOME || process.env.USERPROFILE || '';
      const flagDir = join(home, '.claude', 'logs', 'ork');
      const flagPath = join(flagDir, 'debug-mode.flag');
      if (!existsSync(flagPath)) {
        mkdirSync(flagDir, { recursive: true });
        atomicWriteSync(flagPath, `enabled=${new Date().toISOString()}\nreason=auto-${count}-failures\n`);
        logHook('failure-handler', `Auto-enabled debug mode after ${count} failures`, 'warn');
        process.stderr.write(`[orchestkit] Debug mode auto-enabled after ${count} tool failures — hook diagnostics now active\n`);
      }
    }
  } catch {
    // Never crash on failure tracking
  }
}

export function failureHandler(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  // Get error information from the input
  const errorMessage = input.tool_error || '';
  const toolName = input.tool_name || 'unknown';

  // Skip if no error info
  if (!errorMessage) {
    return outputSilentSuccess();
  }

  ctx.log('failure-handler', `Tool ${toolName} failed: ${errorMessage.slice(0, 200)}`);

  // Track failures — auto-enable debug after threshold
  trackFailureAndMaybeEnableDebug();

  // Try RFC 9457 structured error first — deterministic, richer context
  const structured = extractStructuredError(errorMessage);
  if (structured) {
    ctx.log('failure-handler', `Structured error: ${structured.error_category} (retryable=${structured.retryable})`);
    const parts = [
      `[OrchestKit] Structured error from ${toolName} (${structured.error_category}):`,
      `- ${structured.title}`,
    ];
    if (structured.what_you_should_do) {
      parts.push(`- ${structured.what_you_should_do}`);
    }
    if (structured.retryable && structured.retry_after) {
      parts.push(`- Retryable: wait ${structured.retry_after}s before retrying`);
    } else if (!structured.retryable) {
      parts.push(`- Not retryable${structured.owner_action_required ? ' — owner action required' : ''}`);
    }
    return outputWithContext(parts.join('\n'));
  }

  // Fallback: regex pattern matching for unstructured errors
  const suggestions: string[] = [];
  for (const { pattern, suggestion } of FAILURE_PATTERNS) {
    if (pattern.test(errorMessage)) {
      suggestions.push(suggestion);
    }
  }

  // If no specific pattern matched, provide generic guidance
  if (suggestions.length === 0) {
    // Don't inject noise for every failure
    return outputSilentSuccess();
  }

  const context = [
    `[OrchestKit] Tool failure analysis for ${toolName}:`,
    ...suggestions.map(s => `- ${s}`),
  ].join('\n');

  return outputWithContext(context);
}
