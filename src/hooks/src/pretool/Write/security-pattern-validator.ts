/**
 * Security Pattern Validator Hook
 * Detects security anti-patterns before write
 * CC 2.1.7 Compliant: Self-contained hook with stdin reading and self-guard
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputWithContext,
  logHook,
  logPermissionFeedback,
} from '../../lib/common.js';
import { guardCodeFiles, runGuards } from '../../lib/guards.js';
import { basename } from 'node:path';

/**
 * Security patterns to detect
 */
interface SecurityPattern {
  name: string;
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
}

const SECURITY_PATTERNS: SecurityPattern[] = [
  {
    name: 'Potential hardcoded secret detected',
    pattern: /(api[_-]?key|password|secret|token)\s*[=:]\s*['"][^'"]+['"]/i,
    severity: 'high',
  },
  {
    name: 'Potential SQL injection vulnerability',
    pattern: /execute\s*\(\s*['"].*\+|f['"].*SELECT.*\{/,
    severity: 'high',
  },
  {
    name: 'Dangerous eval/exec usage detected',
    pattern: /eval\s*\(|exec\s*\(/,
    severity: 'high',
  },
  {
    name: 'Subprocess with shell=True detected',
    pattern: /subprocess\.(run|call|Popen).*shell\s*=\s*True/,
    severity: 'medium',
  },
  {
    name: 'Potential XSS vulnerability (innerHTML)',
    pattern: /\.innerHTML\s*=|dangerouslySetInnerHTML/,
    severity: 'medium',
  },
  {
    name: 'Insecure random number generation',
    pattern: /Math\.random\(\).*(?:password|token|secret|key)/i,
    severity: 'medium',
  },
  {
    name: 'Potential command injection',
    pattern: /os\.system\s*\(|os\.popen\s*\(/,
    severity: 'high',
  },
  {
    name: 'Insecure HTTP (should use HTTPS)',
    pattern: /http:\/\/(?!localhost|127\.0\.0\.1)/,
    severity: 'low',
  },
];

/**
 * Detect security issues in content
 */
function detectSecurityIssues(content: string): string[] {
  const issues: string[] = [];

  for (const { name, pattern } of SECURITY_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(name);
    }
  }

  return issues;
}

/**
 * Security pattern validator - detects anti-patterns before write
 */
export function securityPatternValidator(input: HookInput): HookResult {
  const filePath = input.tool_input.file_path || '';
  const content = input.tool_input.content || '';

  // Apply guards
  const guardResult = runGuards(input, guardCodeFiles);
  if (guardResult !== null) {
    return guardResult;
  }

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Detect security issues
  const securityIssues = detectSecurityIssues(content);

  if (securityIssues.length > 0) {
    logHook('security-pattern-validator', `SECURITY_WARN: ${filePath} - ${securityIssues.join(', ')}`);

    // Build warning message
    const warningMsg = `Security warnings for ${basename(filePath)}: ${securityIssues.join(', ')}`;
    logPermissionFeedback('warn', `Security issues in ${filePath}: ${securityIssues.join(', ')}`, input);

    // CC 2.1.9: Use additionalContext for warnings
    return outputWithContext(warningMsg);
  }

  logHook('security-pattern-validator', `SECURITY_OK: ${filePath}`);
  logPermissionFeedback('allow', `No security issues in ${filePath}`, input);
  return outputSilentSuccess();
}
