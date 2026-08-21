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
  outputAsk,
  logHook,
} from '../../lib/common.js';
import { realpathSync, existsSync, readFileSync } from 'node:fs';
import { resolve, isAbsolute, extname, basename } from 'node:path';
import { NOOP_CTX } from '../../lib/context.js';
import { isBypassMode } from '../../lib/guards.js';

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

/**
 * Project the post-write body for this tool call.
 *
 * Returns null when projection is impossible, which this guard treats as
 * pass-through: it must never block on its own failure.
 *
 * Edit inputs carry an old_string/new_string diff rather than the full body,
 * so the projection reads the current file and applies the replacement. Sizing
 * only `Write` was the #3552 bug: the identical body landed friction-free via
 * Edit, so the guard gated TOOL CHOICE rather than file size, and an
 * already-long file could be grown indefinitely one Edit at a time.
 */
function projectBody(input: HookInput): string | null {
  const ti = input.tool_input as {
    file_path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
    replace_all?: boolean;
  };
  if (!ti?.file_path) return null;

  // Write: the new content IS the full body.
  if (input.tool_name === 'Write' && typeof ti.content === 'string') {
    return ti.content;
  }

  // Edit: read current body, apply the replacement, measure the result.
  if (
    input.tool_name === 'Edit' &&
    typeof ti.old_string === 'string' &&
    typeof ti.new_string === 'string'
  ) {
    if (!existsSync(ti.file_path)) return null; // Edit on a missing file fails upstream anyway
    let body: string;
    try {
      body = readFileSync(ti.file_path, 'utf8');
    } catch {
      return null; // unreadable (permissions/race) — fail open, Edit itself will surface it
    }
    if (!body.includes(ti.old_string)) return null; // Edit will error upstream; nothing to project
    return ti.replace_all
      ? body.split(ti.old_string).join(ti.new_string)
      : body.replace(ti.old_string, ti.new_string);
  }

  return null;
}

/** Lines currently on disk, or 0 when the file is new or unreadable. */
function currentLineCount(filePath: string): number {
  if (!existsSync(filePath)) return 0;
  try {
    return readFileSync(filePath, 'utf8').split('\n').length;
  } catch {
    return 0;
  }
}

function checkFileSizeAndBloat(input: HookInput, ctx: HookContext): HookResult | null {
  // Confirmation-only: nothing here denies, so it is skipped entirely under
  // `--dangerously-skip-permissions`, matching context-file-budget-guard.
  if (isBypassMode(input)) return null;

  const filePath = input.tool_input.file_path || '';
  if (!filePath) return null;

  const ext = extname(filePath).toLowerCase().replace('.', '');
  if (!CODE_EXTENSIONS.has(ext)) return null;

  const projected = projectBody(input);
  if (projected === null || projected === '') return null;

  const lineCount = projected.split('\n').length;
  const limit = isTestFile(filePath) ? MAX_TEST_FILE_LINES : MAX_FILE_LINES;
  const bloatSignals = detectBloatPatterns(projected);

  if (lineCount > limit) {
    const current = currentLineCount(filePath);

    // Never stand in the way of SHRINKING a file that is already over the cap.
    // Comparing only against the fixed limit made the guard un-satisfiable on
    // exactly the files it most wants smaller: a 458-line file could not be
    // rewritten to 400 any more than to 600, so the only way to comply was to
    // stop using Write (#3552).
    if (current > limit && lineCount <= current) {
      logHook(
        'file-guard',
        `Allowing ${filePath}: ${current} → ${lineCount} lines, still over ${limit} but improving`
      );
      return null;
    }

    const fileType = isTestFile(filePath) ? 'test' : 'source';
    const bloatDetails = bloatSignals.length > 0
      ? `\n\nBloat patterns detected:\n${bloatSignals.map(s => `- ${s.name}: ${s.detail}`).join('\n')}`
      : '';
    const currentNote = current > 0 ? `, currently ${current}` : '';
    const envVar = isTestFile(filePath)
      ? 'ORCHESTKIT_MAX_TEST_FILE_LINES'
      : 'ORCHESTKIT_MAX_FILE_LINES';

    // ASK, not DENY. Crossing the limit can be a deliberate, informed choice,
    // and a deny here repeats the #2947 display-lint mistake: blocking correct
    // work and teaching users the escape hatch. Same call the sibling
    // context-file-budget-guard already makes.
    const reason =
      `[file-guard] This ${input.tool_name} puts ${basename(filePath)} at ` +
      `${lineCount}/${limit} lines (${fileType}${currentNote}).${bloatDetails} ` +
      `Approve to write anyway, or split into smaller modules first. ` +
      `(Override: ${envVar}=<n>)`;

    logHook('file-guard', `ASK: ${filePath} projected ${lineCount} > limit ${limit}`);
    ctx.logPermission?.('ask', reason, input);
    return outputAsk(reason);
  }

  // Under limit but has bloat signals — note it, never block.
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

  // Check file size and bloat patterns (Write + Edit)
  const sizeResult = checkFileSizeAndBloat(input, ctx);
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
