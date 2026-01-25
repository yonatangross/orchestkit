/**
 * Error Pattern Warner Hook
 * Warns before executing commands matching known bad patterns
 * CC 2.1.9 Enhanced: injects additionalContext with learned error patterns
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputWithContext,
  logHook,
  getProjectDir,
} from '../../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ErrorRule {
  tool: string;
  signature: string;
  pattern?: string;
  occurrence_count?: number;
  suggested_fix?: string;
  sample_input?: {
    command?: string;
  };
}

interface RulesFile {
  rules: ErrorRule[];
}

/**
 * Load error rules from file
 */
function loadErrorRules(projectDir: string): ErrorRule[] {
  const rulesFile = join(projectDir, '.claude', 'rules', 'error_rules.json');

  try {
    if (existsSync(rulesFile)) {
      const data: RulesFile = JSON.parse(readFileSync(rulesFile, 'utf8'));
      return data.rules || [];
    }
  } catch {
    // Ignore errors
  }

  return [];
}

/**
 * Count common words between two strings
 */
function countCommonWords(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  let count = 0;
  for (const word of words1) {
    if (words2.has(word) && word.length > 2) {
      count++;
    }
  }

  return count;
}

/**
 * Warn about commands matching known error patterns
 */
export function errorPatternWarner(input: HookInput): HookResult {
  const projectDir = getProjectDir();
  const command = input.tool_input.command || '';

  if (!command) {
    return outputSilentSuccess();
  }

  // Load error rules
  const rules = loadErrorRules(projectDir);
  if (rules.length === 0) {
    return outputSilentSuccess();
  }

  const hints: string[] = [];

  // Check for common database connection patterns that often fail
  if (/psql.*-U\s+(postgres|orchestkit|root)/.test(command)) {
    const dbRules = rules.filter(
      (r) => r.tool === 'Bash' && r.signature?.includes('role')
    );
    if (dbRules.length > 0) {
      hints.push('DB role error: use docker exec -it <container> psql -U orchestkit_user');
    }
  }

  // Check for MCP postgres tool issues
  if (command.includes('mcp__postgres')) {
    const mcpRules = rules.filter((r) => r.tool?.includes('postgres-mcp'));
    if (mcpRules.length > 0) {
      hints.push('MCP postgres: verify connection to correct database');
    }
  }

  // Check against high-occurrence error patterns
  for (const rule of rules) {
    if (!rule.pattern || (rule.occurrence_count || 0) < 5) continue;

    const sampleCommand = rule.sample_input?.command;
    if (sampleCommand && countCommonWords(command, sampleCommand) > 3) {
      logHook('error-pattern-warner', `Pattern match: ${rule.signature}`);
      if (rule.suggested_fix) {
        hints.push(`${rule.signature} (${rule.occurrence_count}x): ${rule.suggested_fix}`);
      } else {
        hints.push(`${rule.signature} (${rule.occurrence_count}x)`);
      }
    }
  }

  // CC 2.1.9: Inject additionalContext if we have pattern hints
  if (hints.length > 0) {
    let contextMsg = 'Learned error patterns | ' + hints.join(' | ');

    // Truncate if too long (keep under 200 chars for context budget)
    if (contextMsg.length > 200) {
      contextMsg = contextMsg.slice(0, 197) + '...';
    }

    return outputWithContext(contextMsg);
  }

  // No relevant patterns found
  return outputSilentSuccess();
}
