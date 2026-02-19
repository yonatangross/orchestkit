/**
 * Unit tests for dependency-version-check lifecycle hook
 * Tests vulnerability scanning for package.json and requirements.txt
 * CC 2.1.7 Compliant: Non-blocking - always returns continue: true
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { HookInput } from '../../types.js';
import { dependencyVersionCheck } from '../../lifecycle/dependency-version-check.js';

// =============================================================================
// Mock Setup - BEFORE imports
// =============================================================================

vi.mock('../../lib/common.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/common.js')>();
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn(() => process.env.CLAUDE_PROJECT_DIR || '/test/project'),
    outputSilentSuccess: actual.outputSilentSuccess,
    outputWithContext: actual.outputWithContext,
  };
});

// =============================================================================
// Test Setup
// =============================================================================

const TEST_PROJECT_DIR = join(tmpdir(), `dependency-version-check-test-${Date.now()}`);
const TEST_SESSION_ID = `test-session-dep-${Date.now()}`;

/**
 * Store original environment values
 */
let originalEnv: {
  ORCHESTKIT_SKIP_SLOW_HOOKS?: string;
  CLAUDE_PROJECT_DIR?: string;
};

/**
 * Create realistic HookInput for testing
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: '',
    session_id: TEST_SESSION_ID,
    project_dir: TEST_PROJECT_DIR,
    tool_input: {},
    ...overrides,
  };
}

/**
 * Create package.json with dependencies
 */
function createPackageJson(deps: Record<string, string>, devDeps?: Record<string, string>): void {
  const pkg: Record<string, unknown> = { name: 'test-project', version: '1.0.0' };
  if (deps && Object.keys(deps).length > 0) {
    pkg.dependencies = deps;
  }
  if (devDeps && Object.keys(devDeps).length > 0) {
    pkg.devDependencies = devDeps;
  }
  writeFileSync(`${TEST_PROJECT_DIR}/package.json`, JSON.stringify(pkg, null, 2));
}

/**
 * Create requirements.txt with dependencies
 */
function createRequirementsTxt(deps: string[]): void {
  writeFileSync(`${TEST_PROJECT_DIR}/requirements.txt`, deps.join('\n'));
}

/**
 * Create pyproject.toml (marker file)
 */
function createPyprojectToml(): void {
  writeFileSync(
    `${TEST_PROJECT_DIR}/pyproject.toml`,
    `[project]\nname = "test"\nversion = "1.0.0"\n`
  );
}

/**
 * Create go.mod (marker file)
 */
function createGoMod(): void {
  writeFileSync(`${TEST_PROJECT_DIR}/go.mod`, `module test\n\ngo 1.21\n`);
}

/**
 * Clear dependency check cache
 */
function clearCache(): void {
  const cacheFile = `${TEST_PROJECT_DIR}/.claude/feedback/dependency-check-cache.json`;
  if (existsSync(cacheFile)) {
    rmSync(cacheFile, { force: true });
  }
}

beforeEach(() => {
  vi.clearAllMocks();

  // Store original environment
  originalEnv = {
    ORCHESTKIT_SKIP_SLOW_HOOKS: process.env.ORCHESTKIT_SKIP_SLOW_HOOKS,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
  };

  // Set environment
  process.env.CLAUDE_PROJECT_DIR = TEST_PROJECT_DIR;
  delete process.env.ORCHESTKIT_SKIP_SLOW_HOOKS;

  // Create test directory
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });
});

afterEach(() => {
  // Clean up test directory
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }

  // Restore original environment
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

// =============================================================================
// Tests
// =============================================================================

describe('dependency-version-check', () => {
  describe('skip conditions', () => {
    test('skips when ORCHESTKIT_SKIP_SLOW_HOOKS is set', () => {
      // Arrange
      process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';
      createPackageJson({ lodash: '4.17.20' }); // Known vulnerable
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('skips when no package files exist', () => {
      // Arrange
      const input = createHookInput();
      // No package.json, requirements.txt, etc.

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('package.json vulnerability detection', () => {
    test('detects vulnerable lodash version', () => {
      // Arrange
      clearCache();
      createPackageJson({ lodash: '4.17.20' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('lodash');
      expect(result.hookSpecificOutput?.additionalContext).toContain('CVE-2021-23337');
    });

    test('detects vulnerable minimist version', () => {
      // Arrange
      clearCache();
      createPackageJson({ minimist: '1.2.5' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('minimist');
      expect(result.hookSpecificOutput?.additionalContext).toContain('CVE-2021-44906');
    });

    test('detects vulnerable axios version', () => {
      // Arrange
      clearCache();
      createPackageJson({ axios: '0.21.1' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('axios');
      expect(result.hookSpecificOutput?.additionalContext).toContain('CVE-2021-3749');
    });

    test('detects vulnerable jsonwebtoken version', () => {
      // Arrange
      clearCache();
      createPackageJson({ jsonwebtoken: '8.5.1' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('jsonwebtoken');
      expect(result.hookSpecificOutput?.additionalContext).toContain('CVE-2022-23529');
    });

    test('no warnings for safe package versions', () => {
      // Arrange
      clearCache();
      // Use packages not in the vulnerability database
      createPackageJson({
        'safe-package-1': '1.0.0',
        'safe-package-2': '2.0.0',
        'safe-package-3': '3.0.0',
      });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('detects multiple vulnerabilities', () => {
      // Arrange
      clearCache();
      createPackageJson({
        lodash: '4.17.20',
        minimist: '1.2.5',
        'node-fetch': '2.6.0',
      });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('lodash');
      expect(context).toContain('minimist');
      expect(context).toContain('node-fetch');
    });

    test('handles devDependencies', () => {
      // Arrange
      clearCache();
      createPackageJson({}, { lodash: '4.17.20' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('lodash');
    });

    test.each([
      ['lodash', '^4.17.20', true],
      ['lodash', '~4.17.20', true],
      ['safe-package', '1.0.0', false],
      ['axios', '>=0.21.0', true], // Vulnerable range
      ['axios', '1.0.0', false],
    ])('handles version spec "%s@%s" vulnerable=%s', (pkg, version, expectVulnerable) => {
      // Arrange
      clearCache();
      createPackageJson({ [pkg]: version });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      if (expectVulnerable) {
        expect(result.hookSpecificOutput?.additionalContext).toContain(pkg);
      } else {
        expect(result.suppressOutput).toBe(true);
      }
    });
  });

  describe('requirements.txt vulnerability detection', () => {
    test('detects vulnerable django version', () => {
      // Arrange
      clearCache();
      createRequirementsTxt(['django==3.2.0']);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('django');
      expect(result.hookSpecificOutput?.additionalContext).toContain('CVE-2022-34265');
    });

    test('detects vulnerable pyyaml version', () => {
      // Arrange
      clearCache();
      createRequirementsTxt(['pyyaml==5.3.1']);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('pyyaml');
      expect(result.hookSpecificOutput?.additionalContext).toContain('CVE-2020-14343');
    });

    test('detects vulnerable urllib3 version', () => {
      // Arrange
      clearCache();
      createRequirementsTxt(['urllib3==1.26.0']);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('urllib3');
    });

    test('no warnings for safe Python package versions', () => {
      // Arrange
      clearCache();
      createRequirementsTxt([
        'django==4.2.0',
        'requests==2.31.0',
        'pyyaml==6.0',
      ]);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });

    test('handles various version specifiers', () => {
      // Arrange
      clearCache();
      createRequirementsTxt([
        'django>=3.2.0',
        'flask~=1.1.0',
        'requests!=2.28.0',
      ]);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles comments and blank lines', () => {
      // Arrange
      clearCache();
      createRequirementsTxt([
        '# This is a comment',
        'django==4.0.0',
        '',
        '  # Another comment',
        'requests==2.28.0',
      ]);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles requirements without version specifier', () => {
      // Arrange
      clearCache();
      createRequirementsTxt(['django', 'requests', 'flask']);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('caching behavior', () => {
    test('uses cached results within TTL', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      const cache = {
        warnings: 'DEPENDENCY SECURITY CHECK: Cached warning',
        timestamp: Date.now(),
      };
      writeFileSync(`${feedbackDir}/dependency-check-cache.json`, JSON.stringify(cache));
      createPackageJson({ lodash: '4.17.20' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('Cached warning');
    });

    test('ignores stale cache', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      const staleCache = {
        warnings: 'STALE: Old warning',
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      writeFileSync(`${feedbackDir}/dependency-check-cache.json`, JSON.stringify(staleCache));
      createPackageJson({ lodash: '4.17.20' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).not.toContain('STALE');
      expect(result.hookSpecificOutput?.additionalContext).toContain('lodash');
    });

    test('caches "none" when no vulnerabilities found', () => {
      // Arrange
      clearCache();
      // Use a package not in the vulnerability database
      createPackageJson({ 'unknown-safe-package': '1.0.0' });
      const input = createHookInput();

      // Act
      dependencyVersionCheck(input);

      // Assert
      const cacheFile = `${TEST_PROJECT_DIR}/.claude/feedback/dependency-check-cache.json`;
      expect(existsSync(cacheFile)).toBe(true);
      const cache = JSON.parse(readFileSync(cacheFile, 'utf-8'));
      expect(cache.warnings).toBe('none');
    });

    test('handles corrupted cache file', () => {
      // Arrange
      const feedbackDir = `${TEST_PROJECT_DIR}/.claude/feedback`;
      mkdirSync(feedbackDir, { recursive: true });
      writeFileSync(`${feedbackDir}/dependency-check-cache.json`, 'not valid json');
      createPackageJson({ lodash: '4.17.20' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('lodash');
    });
  });

  describe('severity classification', () => {
    test('identifies critical severity vulnerabilities', () => {
      // Arrange
      clearCache();
      createPackageJson({ minimist: '1.2.5' }); // Critical
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('critical');
    });

    test('identifies high severity vulnerabilities', () => {
      // Arrange
      clearCache();
      createPackageJson({ lodash: '4.17.20' }); // High
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('high');
    });

    test('includes vulnerability count summary', () => {
      // Arrange
      clearCache();
      createPackageJson({
        minimist: '1.2.5', // Critical
        lodash: '4.17.20', // High
        axios: '0.21.1', // High
      });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('critical');
      expect(result.hookSpecificOutput?.additionalContext).toContain('high');
    });
  });

  describe('file existence detection', () => {
    test('detects package.json', () => {
      // Arrange
      clearCache();
      createPackageJson({ 'safe-package': '1.0.0' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('detects requirements.txt', () => {
      // Arrange
      clearCache();
      createRequirementsTxt(['django==4.0.0']);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('detects pyproject.toml as marker', () => {
      // Arrange
      clearCache();
      createPyprojectToml();
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('detects go.mod as marker', () => {
      // Arrange
      clearCache();
      createGoMod();
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('checks both Node.js and Python files', () => {
      // Arrange
      clearCache();
      createPackageJson({ lodash: '4.17.20' });
      createRequirementsTxt(['django==3.2.0']);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('Node.js');
      expect(context).toContain('Python');
    });
  });

  describe('error handling', () => {
    test('handles corrupted package.json', () => {
      // Arrange
      clearCache();
      writeFileSync(`${TEST_PROJECT_DIR}/package.json`, 'not valid json');
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles non-existent project directory', () => {
      // Arrange
      const input = createHookInput({ project_dir: '/non/existent/path' });

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles undefined project_dir', () => {
      // Arrange
      const input = createHookInput({ project_dir: undefined });

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles package.json with missing dependencies field', () => {
      // Arrange
      clearCache();
      writeFileSync(`${TEST_PROJECT_DIR}/package.json`, JSON.stringify({ name: 'test' }));
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  describe('CC 2.1.7 compliance', () => {
    test('returns CC 2.1.7 compliant output structure', () => {
      // Arrange
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result).toHaveProperty('continue');
      expect(result.continue).toBe(true);
    });

    test('never blocks session start', () => {
      // Arrange
      clearCache();
      createPackageJson({ minimist: '1.2.5' }); // Critical vulnerability
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.stopReason).toBeUndefined();
    });

    test.each([
      ['no package files', () => {}],
      ['safe packages', () => createPackageJson({ 'safe-package': '1.0.0' })],
      ['vulnerable packages', () => {
        clearCache();
        createPackageJson({ lodash: '4.17.20' });
      }],
      ['skip slow hooks', () => {
        process.env.ORCHESTKIT_SKIP_SLOW_HOOKS = '1';
        createPackageJson({ lodash: '4.17.20' });
      }],
    ])('always returns continue: true for %s', (_, setup) => {
      // Arrange
      setup();
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('uses hookSpecificOutput.additionalContext for context injection', () => {
      // Arrange
      clearCache();
      createPackageJson({ lodash: '4.17.20' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput).toBeDefined();
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });
  });

  describe('output formatting', () => {
    test('includes audit command suggestion', () => {
      // Arrange
      clearCache();
      createPackageJson({ lodash: '4.17.20' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('npm audit');
    });

    test('includes pip-audit suggestion for Python', () => {
      // Arrange
      clearCache();
      createRequirementsTxt(['django==3.2.0']);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('pip-audit');
    });

    test('includes upgrade target version', () => {
      // Arrange
      clearCache();
      createPackageJson({ lodash: '4.17.20' });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.hookSpecificOutput?.additionalContext).toContain('upgrade to');
    });
  });

  describe('edge cases', () => {
    test('handles empty package.json dependencies', () => {
      // Arrange
      clearCache();
      createPackageJson({});
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles empty requirements.txt', () => {
      // Arrange
      clearCache();
      createRequirementsTxt([]);
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles packages with unusual names', () => {
      // Arrange
      clearCache();
      createPackageJson({
        '@scope/package': '1.0.0',
        'package-with-dashes': '2.0.0',
        _underscore_start: '1.0.0',
      });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles version strings with prerelease tags', () => {
      // Arrange
      clearCache();
      createPackageJson({
        'some-package': '4.17.21-beta.1',
        'another-package': '5.0.0-alpha.8',
      });
      const input = createHookInput();

      // Act
      const result = dependencyVersionCheck(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });
});
