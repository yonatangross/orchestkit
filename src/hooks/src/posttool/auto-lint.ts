/**
 * Auto-Lint Hook - PostToolUse format-on-save for Write/Edit
 * CC 2.1.90: Safe to modify files in PostToolUse — "File content has changed" race fixed
 *
 * Automatically formats files after writes:
 * - Python: ruff check + format (Astral toolchain)
 * - JS/TS: biome check --write, falls back to prettier --write
 * - JSON/CSS: biome format --write, falls back to prettier --write
 *
 * #4945: a formatter runs only when the repo configures it (a config file
 * between the edited file and the project root), so an edit is never widened
 * into a whole-file rewrite by a tool CI does not enforce. `ruff check --fix`
 * can delete code (unused imports), so it also needs ORK_AUTO_LINT_FIX=1.
 *
 * Toggle off: SKIP_AUTO_LINT=1
 */

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { load as loadYaml } from 'js-yaml';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, getField } from '../lib/common.js';
import { basename, dirname } from 'node:path';
import { assertSafeCommandName } from '../lib/sanitize-shell.js';
import { safeProjectDir } from '../lib/paths.js';
import { NOOP_CTX } from '../lib/context.js';

/**
 * Get language from file extension
 */
function getLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
    case 'scss':
      return 'css';
    default:
      return null;
  }
}

/**
 * Check if a command exists
 */
function commandExists(cmd: string): boolean {
  try {
    assertSafeCommandName(cmd);
    execFileSync('which', [cmd], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

const RUFF_CONFIGS = ['ruff.toml', '.ruff.toml', 'pyproject.toml'] as const;
const BIOME_CONFIGS = ['biome.json', 'biome.jsonc', '.biome.json', '.biome.jsonc'] as const;
const PRETTIER_CONFIGS = [
  '.prettierrc', '.prettierrc.json', '.prettierrc.json5', '.prettierrc.yaml', '.prettierrc.yml',
  '.prettierrc.toml', '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs',
  '.prettierrc.ts', '.prettierrc.mts', '.prettierrc.cts',
  'prettier.config.js', 'prettier.config.cjs', 'prettier.config.mjs',
  'prettier.config.ts', 'prettier.config.mts', 'prettier.config.cts',
  'package.json',
  'package.yaml',
] as const;

/**
 * A pyproject.toml counts as ruff config only with a [tool.ruff] table, and a
 * package.json or package.yaml counts as prettier config only with a prettier key.
 */
function configApplies(candidate: string): boolean {
  const isPyproject = candidate.endsWith('pyproject.toml');
  const isPackageJson = candidate.endsWith('package.json');
  const isPackageYaml = candidate.endsWith('package.yaml');
  if (!isPyproject && !isPackageJson && !isPackageYaml) return true;
  try {
    const text = String(readFileSync(candidate, 'utf8'));
    if (isPyproject) return /^\[tool\.ruff[\].]/m.test(text);
    if (isPackageJson) {
      const pkg: unknown = JSON.parse(text);
      return typeof pkg === 'object' && pkg !== null && 'prettier' in pkg;
    }
    // package.yaml: YAML analog of `'prettier' in pkg`. Parsed as YAML so flow
    // mappings and an indented root count, like Prettier's own loader. Empty or
    // unparseable text is "no config" (the catch below), never a thrown hook.
    const doc: unknown = loadYaml(text);
    return typeof doc === 'object' && doc !== null && !Array.isArray(doc) && 'prettier' in doc;
  } catch {
    return false;
  }
}

/**
 * Whether one of `names` exists in the edited file's directory or any parent
 * up to the project root (#4945). Stops at the filesystem root when the file
 * sits outside the project.
 */
function hasConfig(filePath: string, projectDir: string, names: readonly string[]): boolean {
  let dir = dirname(filePath);
  while (dir) {
    for (const name of names) {
      const candidate = `${dir}/${name}`;
      if (existsSync(candidate) && configApplies(candidate)) return true;
    }
    if (dir === projectDir) return false;
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
  return false;
}

/**
 * Run auto-lint on written files
 */
export function autoLint(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const toolName = input.tool_name || '';

  // Self-guard: Only run for Write/Edit
  if (toolName !== 'Write' && toolName !== 'Edit') {
    return outputSilentSuccess();
  }

  const filePath = getField<string>(input, 'tool_input.file_path') || '';

  // Skip internal files
  if (!filePath || filePath.includes('/.claude/') ||
      filePath.includes('/node_modules/') ||
      filePath.includes('/.git/') ||
      filePath.includes('/dist/') ||
      filePath.endsWith('.lock')) {
    return outputSilentSuccess();
  }

  // Check if file exists
  // Defense in depth: resolve relative paths even though CC >= 2.1.88 guarantees absolute
  const projectDir = safeProjectDir();
  const fullPath = filePath.startsWith('/') ? filePath : `${projectDir}/${filePath}`;

  if (!existsSync(fullPath)) {
    return outputSilentSuccess();
  }

  // Skip if SKIP_AUTO_LINT is set
  if (process.env.SKIP_AUTO_LINT === '1') {
    return outputSilentSuccess();
  }

  const language = getLanguage(filePath);
  if (!language) {
    return outputSilentSuccess();
  }

  let lintIssues = 0;
  let fixesApplied = false;
  // execFileSync passes args as array — no shell injection risk, no need for assertSafeShellArg
  // (assertSafeShellArg rejects paths with spaces, breaking user projects)
  const safePath = fullPath;

  let hashBefore = '';
  try {
    // Hash file content before formatting to detect actual changes
    hashBefore = createHash('sha256').update(readFileSync(safePath)).digest('hex');
  } catch {
    return outputSilentSuccess(); // File gone between Write and PostToolUse
  }

  try {
    switch (language) {
      case 'python':
        if (commandExists('ruff') && hasConfig(fullPath, projectDir, RUFF_CONFIGS)) {
          try {
            const ruffCheck = execFileSync('ruff', ['check', '--output-format=concise', safePath], {
              encoding: 'utf8',
              timeout: 5000,
              stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
            });
            if (ruffCheck && process.env.ORK_AUTO_LINT_FIX === '1') {
              lintIssues = ruffCheck.split('\n').filter(Boolean).length;
              execFileSync('ruff', ['check', '--fix', '--unsafe-fixes=false', safePath], {
                stdio: 'ignore', windowsHide: true,
                timeout: 5000,
              });
              fixesApplied = true;
            }
          } catch {
            // ruff check returns non-zero when issues found
          }
          try {
            execFileSync('ruff', ['format', safePath], { stdio: 'ignore', windowsHide: true, timeout: 5000 });
          } catch {
            // Ignore format errors
          }
        }
        break;

      case 'typescript':
      case 'javascript':
        if (commandExists('biome') && hasConfig(fullPath, projectDir, BIOME_CONFIGS)) {
          try {
            const biomeOut = execFileSync('biome', ['check', '--write', safePath], {
              encoding: 'utf8',
              timeout: 5000,
              stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
            });
            if (biomeOut.includes('Fixed')) {
              fixesApplied = true;
            }
            if (biomeOut.includes('error')) {
              lintIssues = (biomeOut.match(/error/g) || []).length;
            }
          } catch {
            // Ignore biome errors
          }
        } else if (commandExists('prettier') && hasConfig(fullPath, projectDir, PRETTIER_CONFIGS)) {
          try {
            execFileSync('prettier', ['--write', safePath], {
              stdio: 'ignore', windowsHide: true,
              timeout: 5000,
            });
            fixesApplied = true;
          } catch {
            // Ignore prettier errors
          }
        }
        break;

      case 'json':
      case 'css':
        if (commandExists('biome') && hasConfig(fullPath, projectDir, BIOME_CONFIGS)) {
          try {
            execFileSync('biome', ['format', '--write', safePath], {
              stdio: 'ignore', windowsHide: true,
              timeout: 5000,
            });
            fixesApplied = true;
          } catch {
            // Ignore format errors
          }
        } else if (commandExists('prettier') && hasConfig(fullPath, projectDir, PRETTIER_CONFIGS)) {
          try {
            execFileSync('prettier', ['--write', safePath], {
              stdio: 'ignore', windowsHide: true,
              timeout: 5000,
            });
            fixesApplied = true;
          } catch {
            // Ignore prettier errors
          }
        }
        break;
    }
  } catch (error) {
    ctx.log('auto-lint', `Error: ${error}`);
  }

  // Stage file if formatter changed it (breaks edit→format→revert loop)
  if (fixesApplied) {
    try {
      const hashAfter = createHash('sha256').update(readFileSync(safePath)).digest('hex');
      if (hashBefore !== hashAfter) {
        execFileSync('git', ['add', safePath], { stdio: 'ignore', windowsHide: true, timeout: 5000 });
      }
    } catch {
      // Silently fail if not in a git repo
    }
  }

  // Build output message
  if (fixesApplied && lintIssues > 0) {
    const fileBasename = basename(filePath);
    return {
      continue: true,
      systemMessage: `Auto-lint: fixed issues, ${lintIssues} remaining in ${fileBasename}`,
    };
  }

  return outputSilentSuccess();
}
