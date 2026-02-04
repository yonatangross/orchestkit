/**
 * Unit tests for deployment-safety-check hook
 * Tests enforcement of deployment safety patterns for the deployment-manager agent
 *
 * Security Focus: Validates that production deployments are blocked,
 * rollback/infrastructure changes trigger warnings, and safe commands pass through
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputDeny: vi.fn((reason: string) => ({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-123'),
}));

import { deploymentSafetyCheck } from '../../agent/deployment-safety-check.js';
import { outputSilentSuccess, outputDeny, outputWithContext } from '../../lib/common.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for any tool
 */
function createToolInput(
  toolName: string,
  toolInput: Record<string, unknown> = {},
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: toolInput,
    ...overrides,
  };
}

// =============================================================================
// Deployment Safety Check Tests
// =============================================================================

describe('deployment-safety-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Production patterns blocked
  // ---------------------------------------------------------------------------

  describe('production patterns blocked', () => {
    test.each([
      ['deploy --env prod', '--env.*prod'],
      ['ENVIRONMENT=production npm start', 'production'],
      ['deploy main branch', 'deploy.*main'],
      ['deploy master branch', 'deploy.*master'],
      ['ENV=prod docker compose up', '\\bprod\\b'],
      ['ENVIRONMENT=prod start', 'ENVIRONMENT=prod'],
      ['run --env production', 'production'],
    ])('blocks production command: %s', (command, _expectedPattern) => {
      // Arrange
      const input = createToolInput('Bash', { command });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(outputDeny).toHaveBeenCalledTimes(1);
      expect(outputSilentSuccess).not.toHaveBeenCalled();
    });

    test('blocks command with word boundary prod', () => {
      // Arrange - "prod" as a standalone word
      const input = createToolInput('Bash', { command: 'deploy to prod' });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('does not block "product" or "produce" (word boundary check)', () => {
      // Arrange - "prod" embedded in a longer word should NOT match \bprod\b
      // However, "production" has its own pattern, so we test "product"
      const input = createToolInput('Bash', { command: 'build product page' });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert - "product" does not match \bprod\b
      expect(result.continue).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Rollback warnings (not blocks)
  // ---------------------------------------------------------------------------

  describe('rollback warnings', () => {
    test.each([
      ['rollback v1.2'],
      ['revert deployment to v1.0'],
      ['downgrade service to v0.9'],
      ['rollback last release'],
      ['revert the failed deploy'],
      ['downgrade database migration'],
    ])('warns (not blocks) on rollback command: %s', (command) => {
      // Arrange
      const input = createToolInput('Bash', { command });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputWithContext).toHaveBeenCalledTimes(1);
      expect(outputDeny).not.toHaveBeenCalled();
    });

    test('rollback warning mentions change management', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'rollback v1.2' });

      // Act
      deploymentSafetyCheck(input);

      // Assert
      const contextArg = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(contextArg).toContain('Deployment Safety');
      expect(contextArg).toContain('Rollback');
    });
  });

  // ---------------------------------------------------------------------------
  // Infrastructure warnings (not blocks)
  // ---------------------------------------------------------------------------

  describe('infrastructure warnings', () => {
    test.each([
      ['terraform apply'],
      ['terraform apply -auto-approve'],
      ['kubectl apply -f deployment.yaml'],
      ['kubectl apply -k overlays/staging'],
      ['helm upgrade my-release my-chart'],
      ['helm upgrade --install my-app ./chart'],
      ['docker push myregistry/myapp:latest'],
      ['docker push gcr.io/project/image:v1'],
    ])('warns (not blocks) on infrastructure command: %s', (command) => {
      // Arrange
      const input = createToolInput('Bash', { command });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputWithContext).toHaveBeenCalledTimes(1);
      expect(outputDeny).not.toHaveBeenCalled();
    });

    test('infrastructure warning mentions staging verification', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'terraform apply' });

      // Act
      deploymentSafetyCheck(input);

      // Assert
      const contextArg = vi.mocked(outputWithContext).mock.calls[0][0];
      expect(contextArg).toContain('Deployment Safety');
      expect(contextArg).toContain('Infrastructure change detected');
    });

    test('docker build is not flagged (only docker push)', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'docker build -t myapp .' });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
      expect(outputWithContext).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Safe commands allowed
  // ---------------------------------------------------------------------------

  describe('safe commands allowed', () => {
    test.each([
      ['deploy staging'],
      ['npm run dev'],
      ['docker build -t myapp .'],
      ['docker compose up'],
      ['git status'],
      ['npm test'],
      ['npm run build'],
      ['echo "deploying to staging"'],
    ])('allows safe command: %s', (command) => {
      // Arrange
      const input = createToolInput('Bash', { command });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
      expect(outputDeny).not.toHaveBeenCalled();
      expect(outputWithContext).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Deny output format
  // ---------------------------------------------------------------------------

  describe('deny output format', () => {
    test('deny output contains BLOCKED keyword', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'deploy --env prod',
      });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('BLOCKED');
    });

    test('deny output mentions Production deployment', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'ENVIRONMENT=production start',
      });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('Production deployment');
    });

    test('deny output contains matched pattern source', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'deploy main' });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('Pattern:');
      expect(result.stopReason).toContain('deploy.*main');
    });

    test('deny output mentions proper release processes', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'deploy --env prod' });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.stopReason).toContain('proper release processes');
    });

    test('deny result has proper CC 2.1.7 structure', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'deploy master' });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result).toMatchObject({
        continue: false,
        stopReason: expect.any(String),
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: expect.stringContaining('BLOCKED'),
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    test('handles empty command string', () => {
      // Arrange
      const input = createToolInput('Bash', { command: '' });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('handles missing command field', () => {
      // Arrange
      const input = createToolInput('Bash', {});

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('handles undefined command gracefully', () => {
      // Arrange
      const input = createToolInput('Bash', { command: undefined });

      // Act & Assert
      expect(() => deploymentSafetyCheck(input)).not.toThrow();
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
    });

    test('case insensitive matching for PRODUCTION', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'ENVIRONMENT=PRODUCTION deploy',
      });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('case insensitive matching for Prod', () => {
      // Arrange
      const input = createToolInput('Bash', {
        command: 'deploy to Prod environment',
      });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('production patterns checked before rollback warnings', () => {
      // Arrange - matches both production AND rollback
      const input = createToolInput('Bash', {
        command: 'rollback production to v1.0',
      });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert - production should take precedence (deny, not warn)
      expect(result.continue).toBe(false);
      expect(outputDeny).toHaveBeenCalledTimes(1);
      expect(outputWithContext).not.toHaveBeenCalled();
    });

    test('production patterns checked before infrastructure warnings', () => {
      // Arrange - matches both production AND infrastructure
      const input = createToolInput('Bash', {
        command: 'terraform apply --env prod',
      });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert - production should take precedence
      expect(result.continue).toBe(false);
      expect(outputDeny).toHaveBeenCalledTimes(1);
    });

    test('first matching production pattern is reported', () => {
      // Arrange - matches multiple production patterns
      const input = createToolInput('Bash', {
        command: 'deploy main --env prod production',
      });

      // Act
      const result = deploymentSafetyCheck(input);

      // Assert - first match triggers deny
      expect(result.continue).toBe(false);
      expect(outputDeny).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Pattern completeness
  // ---------------------------------------------------------------------------

  describe('pattern completeness', () => {
    test('all 7 production patterns are enforced', () => {
      // Arrange - one representative command per pattern
      const productionCommands = [
        'deploy to prod now',          // \bprod\b
        'ENVIRONMENT=production',       // production
        'deploy --env prod',            // --env.*prod
        'ENV=prod restart',             // ENV=prod
        'ENVIRONMENT=prod start',       // ENVIRONMENT=prod
        'deploy main release',          // deploy.*main
        'deploy master release',        // deploy.*master
      ];

      // Act & Assert
      for (const cmd of productionCommands) {
        vi.clearAllMocks();
        const input = createToolInput('Bash', { command: cmd });
        const result = deploymentSafetyCheck(input);
        expect(result.continue).toBe(false);
      }
    });

    test('rollback/revert/downgrade all trigger warnings', () => {
      // Arrange
      const rollbackCommands = ['rollback service', 'revert changes', 'downgrade version'];

      // Act & Assert
      for (const cmd of rollbackCommands) {
        vi.clearAllMocks();
        const input = createToolInput('Bash', { command: cmd });
        const result = deploymentSafetyCheck(input);
        expect(result.continue).toBe(true);
        expect(outputWithContext).toHaveBeenCalledTimes(1);
      }
    });

    test('terraform/kubectl/helm/docker push all trigger infrastructure warnings', () => {
      // Arrange
      const infraCommands = [
        'terraform apply',
        'kubectl apply -f pod.yaml',
        'helm upgrade chart',
        'docker push image:tag',
      ];

      // Act & Assert
      for (const cmd of infraCommands) {
        vi.clearAllMocks();
        const input = createToolInput('Bash', { command: cmd });
        const result = deploymentSafetyCheck(input);
        expect(result.continue).toBe(true);
        expect(outputWithContext).toHaveBeenCalledTimes(1);
      }
    });
  });
});
