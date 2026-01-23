/**
 * Duplicate Code Detector Hook
 * BLOCKING: Detect duplicate/redundant code across worktrees
 * CC 2.1.7 Compliant
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, getProjectDir } from '../lib/common.js';
import { getRepoRoot } from '../lib/git.js';

/**
 * Extract function/class signatures from content
 */
function extractSignatures(content: string, filePath: string): string[] {
  const signatures: string[] = [];

  if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
    // TypeScript/JavaScript
    const matches = content.match(/(function|class|const|export function|export class)\s+[A-Za-z_][A-Za-z0-9_]*/g);
    if (matches) {
      signatures.push(...matches);
    }
  } else if (filePath.endsWith('.py')) {
    // Python
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^(def|class)\s+[A-Za-z_][A-Za-z0-9_]*/);
      if (match) signatures.push(match[0]);
    }
  }

  return [...new Set(signatures)];
}

/**
 * Find code files in directory (excluding common ignored paths)
 */
function findCodeFiles(dir: string, pattern: RegExp): string[] {
  const files: string[] = [];
  const ignoreDirs = ['node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build', '.next', '.git'];

  function walk(currentDir: string): void {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `${currentDir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.isFile() && pattern.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore access errors
    }
  }

  walk(dir);
  return files;
}

/**
 * Check for copy-paste patterns in content
 */
function checkCopyPastePatterns(content: string): string[] {
  const warnings: string[] = [];
  const lines = content.split('\n');
  let prev = '';
  let count = 0;
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && line === prev) {
      count++;
      if (count >= 3) {
        warnings.push(`Line ${startLine}: ${prev.substring(0, 50)}`);
      }
    } else {
      prev = line;
      count = 1;
      startLine = i + 1;
    }
  }

  return warnings;
}

/**
 * Check for utility patterns that should be centralized
 */
function checkUtilityPatterns(content: string, filePath: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
    // Check for date formatting
    if (/new Date.*toLocaleDateString/.test(content)) {
      errors.push('UTILITY: Direct date formatting detected');
      errors.push("  Use centralized date utilities: import { formatDate } from '@/lib/dates'");
    }

    // Check for multiple fetch calls
    const fetchCount = (content.match(/fetch\s*\(\s*['"]/g) || []).length;
    if (fetchCount > 2) {
      warnings.push(`UTILITY: Multiple fetch calls detected (${fetchCount})`);
      warnings.push('  Consider using centralized API client or custom hook');
    }

    // Check for multiple inline validations
    const validationCount = (content.match(/if\s*\([^)]*\.test\([^)]*\)/g) || []).length;
    if (validationCount > 3) {
      warnings.push(`UTILITY: Multiple inline validations detected (${validationCount})`);
      warnings.push('  Use Zod schemas: const schema = z.object({...})');
    }
  }

  if (filePath.endsWith('.py')) {
    // Check for multiple json.loads
    const jsonCount = (content.match(/json\.loads/g) || []).length;
    if (jsonCount > 3) {
      warnings.push(`UTILITY: Multiple json.loads detected (${jsonCount})`);
      warnings.push('  Consider centralized JSON handling with error recovery');
    }

    // Check for multiple environment variable access
    const envCount = (content.match(/os\.getenv|os\.environ/g) || []).length;
    if (envCount > 5) {
      warnings.push(`UTILITY: Multiple environment variable accesses (${envCount})`);
      warnings.push('  Use Settings/Config class with Pydantic validation');
    }
  }

  return { errors, warnings };
}

/**
 * Detect duplicate/redundant code across worktrees
 */
export function duplicateCodeDetector(input: HookInput): HookResult {
  const filePath = input.tool_input?.file_path || '';
  const content = input.tool_input?.content || (input as any).tool_result || '';

  if (!filePath || !content) return outputSilentSuccess();

  // Only validate code files
  if (!/\.(ts|tsx|js|jsx|py)$/.test(filePath)) {
    return outputSilentSuccess();
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Extract signatures and check for duplicates in main repo
  const signatures = extractSignatures(content, filePath);
  if (signatures.length > 0) {
    const projectRoot = getRepoRoot() || getProjectDir();
    const codeFiles = findCodeFiles(projectRoot, /\.(ts|tsx|js|jsx|py)$/);

    for (const signature of signatures) {
      const name = signature.split(/\s+/).pop() || '';
      if (!name) continue;

      // Search for duplicates
      for (const codeFile of codeFiles) {
        if (codeFile === filePath) continue;

        try {
          const fileContent = readFileSync(codeFile, 'utf8');
          // Word boundary check
          const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
          if (regex.test(fileContent)) {
            // Check for exact signature match
            if (fileContent.includes(signature)) {
              const relPath = codeFile.replace(projectRoot + '/', '');
              warnings.push(`DUPLICATE: '${name}' already exists in:`);
              warnings.push(`  - ${relPath}`);
              warnings.push('  Consider:');
              warnings.push('    1. Reusing existing implementation');
              warnings.push('    2. Extracting to shared utility');
              warnings.push('    3. Using different name if intentionally different');
              break;
            }
          }
        } catch {
          // Ignore file read errors
        }
      }
    }
  }

  // 2. Check for copy-paste patterns
  const copyPasteWarnings = checkCopyPastePatterns(content);
  if (copyPasteWarnings.length > 0) {
    warnings.push('COPY-PASTE: Repeated code blocks detected:');
    for (const w of copyPasteWarnings.slice(0, 5)) {
      warnings.push(`  ${w}`);
    }
    warnings.push('  Refactor repeated logic into functions');
  }

  // 3. Check for utility patterns
  const utilityCheck = checkUtilityPatterns(content, filePath);
  errors.push(...utilityCheck.errors);
  warnings.push(...utilityCheck.warnings);

  // Block on critical errors
  if (errors.length > 0) {
    const ctx = `Duplicate code violation in ${filePath}. See stderr for details.`;
    return outputWithContext(ctx);
  }

  // Warn but don't block
  if (warnings.length > 0) {
    const ctx = `Potential code duplication detected in ${filePath}. Review warnings on stderr.`;
    return outputWithContext(ctx);
  }

  return outputSilentSuccess();
}
