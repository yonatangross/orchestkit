/**
 * Git utilities for TypeScript hooks
 * Ported from hooks/_lib/common.sh git functions
 */

import { execSync } from 'node:child_process';
import { getProjectDir } from './common.js';

/**
 * Get the current git branch
 */
export function getCurrentBranch(projectDir?: string): string {
  const dir = projectDir || getProjectDir();
  try {
    return execSync('git branch --show-current', {
      cwd: dir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Check if on a protected branch (dev, main, master)
 */
export function isProtectedBranch(branch?: string): boolean {
  const currentBranch = branch || getCurrentBranch();
  return ['dev', 'main', 'master'].includes(currentBranch);
}

/**
 * Get the repository root directory
 */
export function getRepoRoot(projectDir?: string): string {
  const dir = projectDir || getProjectDir();
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return dir;
  }
}

/**
 * Check if path is inside a git repository
 */
export function isGitRepo(projectDir?: string): boolean {
  const dir = projectDir || getProjectDir();
  try {
    execSync('git rev-parse --git-dir', {
      cwd: dir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get git status (short format)
 */
export function getGitStatus(projectDir?: string): string {
  const dir = projectDir || getProjectDir();
  try {
    return execSync('git status --short', {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(projectDir?: string): boolean {
  return getGitStatus(projectDir).length > 0;
}

/**
 * Get the default branch (main or master)
 */
export function getDefaultBranch(projectDir?: string): string {
  const dir = projectDir || getProjectDir();
  try {
    // Check if 'main' exists
    execSync('git rev-parse --verify main', {
      cwd: dir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return 'main';
  } catch {
    try {
      // Check if 'master' exists
      execSync('git rev-parse --verify master', {
        cwd: dir,
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return 'master';
    } catch {
      return 'main'; // Default to main
    }
  }
}

/**
 * Extract issue number from branch name
 * Supports patterns like: issue/123-description, feature/123, fix-123
 */
export function extractIssueNumber(branch: string): number | null {
  // Match common patterns
  const patterns = [
    /issue\/(\d+)/i,
    /feature\/(\d+)/i,
    /fix\/(\d+)/i,
    /bug\/(\d+)/i,
    /feat\/(\d+)/i,
    /^(\d+)-/,
    /-(\d+)$/,
    /#(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = branch.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Get list of staged files (ready to be committed)
 * Returns array of file paths
 */
export function getStagedFiles(projectDir?: string): string[] {
  const dir = projectDir || getProjectDir();
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return output ? output.split('\n').filter((f) => f.trim()) : [];
  } catch {
    return [];
  }
}

/**
 * Analyze staged files for atomicity
 * Returns an object describing the change characteristics
 */
export function analyzeStagedChanges(projectDir?: string): {
  files: string[];
  directories: Set<string>;
  extensions: Set<string>;
  hasTests: boolean;
  hasConfig: boolean;
  hasDocs: boolean;
  hasSource: boolean;
} {
  const files = getStagedFiles(projectDir);
  const directories = new Set<string>();
  const extensions = new Set<string>();
  let hasTests = false;
  let hasConfig = false;
  let hasDocs = false;
  let hasSource = false;

  for (const file of files) {
    // Extract top-level directory
    const parts = file.split('/');
    if (parts.length > 1) {
      directories.add(parts[0]);
      // Also track second-level for deeper analysis
      if (parts.length > 2) {
        directories.add(`${parts[0]}/${parts[1]}`);
      }
    }

    // Extension
    const ext = file.split('.').pop() || '';
    extensions.add(ext);

    // Classify file type
    if (/\.(test|spec)\.\w+$/.test(file) || /^tests?\//.test(file) || /__tests__\//.test(file)) {
      hasTests = true;
    } else if (/\.(md|mdx|txt|rst)$/.test(file) || /^docs?\//.test(file) || file === 'README.md') {
      hasDocs = true;
    } else if (
      /\.(json|ya?ml|toml|ini|cfg|env)$/.test(file) ||
      /config/i.test(file) ||
      file === 'package.json' ||
      file === 'tsconfig.json'
    ) {
      hasConfig = true;
    } else {
      hasSource = true;
    }
  }

  return { files, directories, extensions, hasTests, hasConfig, hasDocs, hasSource };
}

/**
 * Validate branch name format
 * Returns error message if invalid, null if valid
 */
export function validateBranchName(branch: string): string | null {
  // Skip validation for protected branches
  if (isProtectedBranch(branch)) {
    return null;
  }

  // Valid prefixes
  const validPrefixes = [
    'issue/',
    'feature/',
    'fix/',
    'bug/',
    'feat/',
    'chore/',
    'docs/',
    'refactor/',
    'test/',
    'ci/',
    'perf/',
    'style/',
    'release/',
    'hotfix/',
  ];

  const hasValidPrefix = validPrefixes.some((prefix) => branch.startsWith(prefix));
  if (!hasValidPrefix) {
    return `Branch name should start with a valid prefix: ${validPrefixes.join(', ')}`;
  }

  // Check for issue number in issue/ branches
  if (branch.startsWith('issue/') && !extractIssueNumber(branch)) {
    return 'issue/ branches should include an issue number (e.g., issue/123-description)';
  }

  return null;
}
