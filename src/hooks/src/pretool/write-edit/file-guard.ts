/**
 * File Guard Hook
 * Protects sensitive files from modification
 * CC 2.1.7 Compliant
 *
 * SECURITY: Resolves symlinks before checking patterns (ME-001 fix)
 * to prevent symlink-based bypasses of file protection.
 */

import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  logHook,
} from '../../lib/common.js';
import { realpathSync } from 'node:fs';
import { resolve, isAbsolute, extname, basename } from 'node:path';
import { NOOP_CTX } from '../../lib/context.js';

// ---------------------------------------------------------------------------
// File size gate — configurable via env vars
// ---------------------------------------------------------------------------

const MAX_FILE_LINES = parseInt(process.env.ORCHESTKIT_MAX_FILE_LINES || '300', 10);
const MAX_TEST_FILE_LINES = parseInt(process.env.ORCHESTKIT_MAX_TEST_FILE_LINES || '500', 10);

const CODE_EXTENSIONS = new Set(['py', 'ts', 'tsx', 'js', 'jsx', 'go', 'rs', 'java']);

function isTestFile(filePath: string): boolean {
  const name = basename(filePath);
  return /\.(test|spec)\.[^.]+$/.test(name)
      || /^test_/.test(name)
      || /_test\.[^.]+$/.test(name)
      || filePath.includes('__tests__/');
}

interface BloatSignal {
  name: string;
  detected: boolean;
  detail: string;
}

function detectBloatPatterns(content: string): BloatSignal[] {
  const signals: BloatSignal[] = [];
  const lines = content.split('\n');

  // 1. Too many exports (god file / barrel file)
  const exportCount = lines.filter(l => /^export\s/.test(l.trim())).length;
  if (exportCount > 15) {
    signals.push({
      name: 'god-file', detected: true,
      detail: `${exportCount} exports — split by domain`,
    });
  }

  // 2. Mixed concerns: types + logic in same file
  const hasTypes = lines.some(l => /^(export\s+)?(type|interface)\s/.test(l.trim()));
  const hasFunctions = lines.some(l => /^(export\s+)?(async\s+)?function\s/.test(l.trim()));
  const hasClasses = lines.some(l => /^(export\s+)?class\s/.test(l.trim()));
  if (hasTypes && (hasFunctions || hasClasses) && lines.length > 150) {
    signals.push({
      name: 'mixed-concerns', detected: true,
      detail: 'types + logic in same file — extract types to types.ts',
    });
  }

  // 3. Too many imports (coupling smell)
  const importCount = lines.filter(l => /^import\s/.test(l.trim())).length;
  if (importCount > 20) {
    signals.push({
      name: 'high-coupling', detected: true,
      detail: `${importCount} imports — file does too much, split by responsibility`,
    });
  }

  // 4. Multiple classes/components in one file
  const classCount = lines.filter(l => /^(export\s+)?(default\s+)?class\s/.test(l.trim())).length;
  const componentCount = lines.filter(l =>
    /^(export\s+)?(default\s+)?(const|function)\s+[A-Z]/.test(l.trim())
  ).length;
  if (classCount > 1) {
    signals.push({ name: 'multi-class', detected: true, detail: `${classCount} classes — one class per file` });
  }
  if (componentCount > 3) {
    signals.push({ name: 'multi-component', detected: true, detail: `${componentCount} components — one per file` });
  }

  return signals.filter(s => s.detected);
}

function checkFileSizeAndBloat(input: HookInput): HookResult | null {
  if (input.tool_name !== 'Write') return null;

  const filePath = input.tool_input.file_path || '';
  const content = input.tool_input.content || '';
  if (!filePath || !content) return null;

  const ext = extname(filePath).toLowerCase().replace('.', '');
  if (!CODE_EXTENSIONS.has(ext)) return null;

  const lineCount = content.split('\n').length;
  const limit = isTestFile(filePath) ? MAX_TEST_FILE_LINES : MAX_FILE_LINES;
  const bloatSignals = detectBloatPatterns(content);

  // Block if over line limit
  if (lineCount > limit) {
    const fileType = isTestFile(filePath) ? 'test' : 'source';
    const bloatDetails = bloatSignals.length > 0
      ? `\n\nBloat patterns detected:\n${bloatSignals.map(s => `- ${s.name}: ${s.detail}`).join('\n')}`
      : '';

    return outputDeny(
      `File too long: ${lineCount}/${limit} lines (${fileType}).${bloatDetails} Split into smaller modules.`
    );
  }

  // Under limit but has bloat signals — warn, don't block
  if (bloatSignals.length >= 2) {
    logHook('file-guard', `Bloat detected in ${filePath}: ${bloatSignals.map(s => s.name).join(', ')}`);
  }

  return null;
}

/**
 * Protected file patterns - files that should NEVER be modified
 */
const PROTECTED_PATTERNS: RegExp[] = [
  /\.env$/,
  /\.env\.local$/,
  /\.env\.production$/,
  /credentials\.json$/,
  /secrets\.json$/,
  /private\.key$/,
  /\.pem$/,
  /id_rsa$/,
  /id_ed25519$/,
  /\/\.husky\//, // CC 2.1.90: git hooks directory — prevent tampering with commit hooks
];

/**
 * Config patterns - files to warn about but allow
 */
const CONFIG_PATTERNS: RegExp[] = [
  /package\.json$/,
  /pyproject\.toml$/,
  /tsconfig\.json$/,
];

/**
 * Resolve file path, following symlinks
 */
function resolveRealPath(filePath: string, projectDir: string): string {
  try {
    // Defense in depth: resolve relative paths even though CC >= 2.1.88 guarantees absolute
    const absolutePath = isAbsolute(filePath)
      ? filePath
      : resolve(projectDir, filePath);

    // Call realpathSync directly — avoids TOCTOU race between existsSync and realpathSync
    return realpathSync(absolutePath);
  } catch {
    // ENOENT (file doesn't exist) or other errors — return best-effort absolute path
    return isAbsolute(filePath) ? filePath : resolve(projectDir, filePath);
  }
}

/**
 * Check if file matches protected patterns
 */
function isProtected(realPath: string): RegExp | null {
  for (const pattern of PROTECTED_PATTERNS) {
    if (pattern.test(realPath)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Check if file is a config file
 */
function isConfigFile(realPath: string): boolean {
  return CONFIG_PATTERNS.some((pattern) => pattern.test(realPath));
}

/**
 * Guard against modifying sensitive files
 */
export function fileGuard(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const filePath = input.tool_input.file_path || '';
  const projectDir = ctx.projectDir;

  if (!filePath) {
    return outputSilentSuccess();
  }

  ctx.log('file-guard', `File write/edit: ${filePath}`);

  // Resolve symlinks to prevent bypass attacks (ME-001 fix)
  const realPath = resolveRealPath(filePath, projectDir);
  ctx.log('file-guard', `Resolved path: ${realPath}`);

  // Check if file matches protected patterns
  const matchedPattern = isProtected(realPath);

  if (matchedPattern) {
    ctx.logPermission('deny', `Protected file blocked: ${filePath} (pattern: ${matchedPattern})`, input);
    ctx.log('file-guard', `BLOCKED: ${filePath} matches ${matchedPattern}`);

    return outputDeny(
      `Cannot modify protected file: ${filePath}

Resolved path: ${realPath}
Matched pattern: ${matchedPattern}

Protected files include:
- Environment files (.env, .env.local, .env.production)
- Credential files (credentials.json, secrets.json)
- Private keys (.pem, id_rsa, id_ed25519)

If you need to modify this file, do it manually outside Claude Code.`
    );
  }

  // Check file size and bloat patterns (Write only)
  const sizeResult = checkFileSizeAndBloat(input);
  if (sizeResult) return sizeResult;

  // Warn on config files (but allow)
  if (isConfigFile(realPath)) {
    ctx.log('file-guard', `WARNING: Config file modification: ${realPath}`);
    ctx.logPermission('warn', `Config file modification: ${filePath}`, input);
  }

  // Allow the write
  ctx.logPermission('allow', `File write allowed: ${filePath}`, input);
  return outputSilentSuccess();
}
