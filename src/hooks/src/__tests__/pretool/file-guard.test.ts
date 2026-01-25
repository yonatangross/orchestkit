/**
 * Unit tests for file-guard hook
 * Tests protection of sensitive files from modification
 *
 * Security Focus: Validates that credential files, private keys,
 * and environment files are protected from writes/edits.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookInput } from '../../types.js';
import { fileGuard } from '../../pretool/write-edit/file-guard.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for Write operations
 */
function createWriteInput(file_path: string, content: string = '', overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path, content },
    ...overrides,
  };
}

/**
 * Create a mock HookInput for Edit operations
 */
function createEditInput(file_path: string, overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Edit',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {
      file_path,
      old_string: 'old content',
      new_string: 'new content',
    },
    ...overrides,
  };
}

/**
 * Create base HookInput
 */
function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    ...overrides,
  };
}

// =============================================================================
// File Guard Tests
// =============================================================================

describe('file-guard', () => {
  describe('environment files protection', () => {
    test('blocks .env file', () => {
      // Arrange
      const input = createWriteInput('/project/.env', 'API_KEY=secret');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('.env');
      expect(result.stopReason).toContain('protected file');
      expect(result.hookSpecificOutput?.permissionDecision).toBe('deny');
    });

    test('blocks .env.local file', () => {
      // Arrange
      const input = createWriteInput('/project/.env.local', 'LOCAL_SECRET=value');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('protected file');
    });

    test('blocks .env.production file', () => {
      // Arrange
      const input = createWriteInput('/project/.env.production', 'PROD_SECRET=value');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('protected file');
    });

    test('blocks .env in nested directory', () => {
      // Arrange
      const input = createWriteInput('/project/backend/config/.env', 'SECRET=value');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('allows .env.example file', () => {
      // Arrange
      const input = createWriteInput('/project/.env.example', 'API_KEY=your_key_here');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows .env.sample file', () => {
      // Arrange
      const input = createWriteInput('/project/.env.sample', 'DATABASE_URL=...');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('credential files protection', () => {
    test('blocks credentials.json', () => {
      // Arrange
      const input = createWriteInput('/project/credentials.json', '{"key":"secret"}');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('credentials.json');
    });

    test('blocks secrets.json', () => {
      // Arrange
      const input = createWriteInput('/config/secrets.json', '{"password":"secret"}');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('secrets.json');
    });

    test('blocks credentials.json in nested path', () => {
      // Arrange
      const input = createWriteInput('/project/config/gcp/credentials.json', '{}');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  describe('private key protection', () => {
    test('blocks .pem files', () => {
      // Arrange
      const input = createWriteInput('/keys/private.pem', '-----BEGIN RSA PRIVATE KEY-----');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('.pem');
    });

    test('blocks private.key', () => {
      // Arrange
      const input = createWriteInput('/ssl/private.key', 'PRIVATE KEY');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('private.key');
    });

    test('blocks id_rsa', () => {
      // Arrange
      const input = createWriteInput('/home/user/.ssh/id_rsa', 'SSH PRIVATE KEY');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('id_rsa');
    });

    test('blocks id_ed25519', () => {
      // Arrange
      const input = createWriteInput('/home/user/.ssh/id_ed25519', 'ED25519 PRIVATE KEY');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('id_ed25519');
    });

    test('blocks .pem in any directory', () => {
      // Arrange
      const input = createWriteInput('/var/certs/server.pem', 'CERTIFICATE');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  describe('normal files are allowed', () => {
    test('allows TypeScript files', () => {
      // Arrange
      const input = createWriteInput('/src/app.ts', 'export const app = {}');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('allows Python files', () => {
      // Arrange
      const input = createWriteInput('/app/main.py', 'def main(): pass');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows JavaScript files', () => {
      // Arrange
      const input = createWriteInput('/src/index.js', 'console.log("hello")');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows markdown files', () => {
      // Arrange
      const input = createWriteInput('/README.md', '# Project');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows JSON files that are not credentials', () => {
      // Arrange
      const input = createWriteInput('/config/settings.json', '{"debug":true}');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows HTML files', () => {
      // Arrange
      const input = createWriteInput('/public/index.html', '<html></html>');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows CSS files', () => {
      // Arrange
      const input = createWriteInput('/src/styles.css', 'body { margin: 0; }');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows YAML files', () => {
      // Arrange
      const input = createWriteInput('/docker-compose.yml', 'version: "3"');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('config files are allowed (with warning)', () => {
    test('allows package.json', () => {
      // Arrange
      const input = createWriteInput('/package.json', '{"name":"app"}');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows pyproject.toml', () => {
      // Arrange
      const input = createWriteInput('/pyproject.toml', '[tool.poetry]');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows tsconfig.json', () => {
      // Arrange
      const input = createWriteInput('/tsconfig.json', '{"compilerOptions":{}}');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });
  });

  describe('Edit tool also protected', () => {
    test('blocks editing .env file', () => {
      // Arrange
      const input = createEditInput('/project/.env');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
      expect(result.stopReason).toContain('protected file');
    });

    test('blocks editing credentials.json', () => {
      // Arrange
      const input = createEditInput('/config/credentials.json');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('blocks editing private keys', () => {
      // Arrange
      const input = createEditInput('/keys/server.pem');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('handles empty file path', () => {
      // Arrange
      const input = createHookInput({
        tool_name: 'Write',
        tool_input: { content: 'test' },
      });

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('handles undefined file path', () => {
      // Arrange
      const input = createHookInput({
        tool_name: 'Write',
        tool_input: {},
      });

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('handles file path with only filename (no directory)', () => {
      // Arrange
      const input = createWriteInput('.env', 'SECRET=value');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('handles absolute paths', () => {
      // Arrange
      const input = createWriteInput('/absolute/path/to/.env', 'SECRET=value');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('handles relative paths', () => {
      // Arrange
      const input = createWriteInput('./relative/path/.env', 'SECRET=value');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('handles paths with special characters', () => {
      // Arrange
      const input = createWriteInput('/path/with spaces/and-dashes/.env', 'SECRET');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });
  });

  describe('symlink bypass prevention (ME-001 fix)', () => {
    // Note: These tests verify the pattern exists - actual symlink following
    // requires filesystem operations which are handled by the hook itself

    test('blocks file ending with protected pattern regardless of path complexity', () => {
      // Arrange - attacker might try weird paths
      const input = createWriteInput('/some/../project/./config/.env', 'SECRET');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(false);
    });

    test('error message includes resolved path information', () => {
      // Arrange
      const input = createWriteInput('/project/.env', 'SECRET');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.stopReason).toContain('Resolved path');
    });

    test('error message includes matched pattern', () => {
      // Arrange
      const input = createWriteInput('/project/.env', 'SECRET');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.stopReason).toContain('Matched pattern');
    });
  });

  describe('similar but safe filenames', () => {
    test('allows environment.ts (not .env)', () => {
      // Arrange
      const input = createWriteInput('/src/environment.ts', 'export const env = {}');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('allows config.json (not credentials.json)', () => {
      // Arrange
      const input = createWriteInput('/src/config.json', '{}');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('blocks public.pem (all .pem files blocked for safety)', () => {
      // Arrange - .pem is blocked regardless of public/private
      const input = createWriteInput('/keys/public.pem', 'PUBLIC KEY');

      // Act
      const result = fileGuard(input);

      // Assert - all .pem files are blocked for safety
      expect(result.continue).toBe(false);
    });

    test('allows id_rsa.pub (public key)', () => {
      // Arrange
      const input = createWriteInput('/home/user/.ssh/id_rsa.pub', 'ssh-rsa AAAA...');

      // Act
      const result = fileGuard(input);

      // Assert - .pub files are not blocked
      expect(result.continue).toBe(true);
    });
  });

  describe('output format compliance (CC 2.1.7)', () => {
    test('blocked file returns proper deny structure', () => {
      // Arrange
      const input = createWriteInput('/project/.env', 'SECRET');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result).toMatchObject({
        continue: false,
        stopReason: expect.stringContaining('protected file'),
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: expect.stringContaining('protected file'),
        },
      });
    });

    test('allowed file returns proper silent success structure', () => {
      // Arrange
      const input = createWriteInput('/src/app.ts', 'content');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result).toEqual({
        continue: true,
        suppressOutput: true,
      });
    });

    test('error message provides helpful guidance', () => {
      // Arrange
      const input = createWriteInput('/project/.env', 'SECRET');

      // Act
      const result = fileGuard(input);

      // Assert
      expect(result.stopReason).toContain('Protected files include');
      expect(result.stopReason).toContain('Environment files');
      expect(result.stopReason).toContain('Credential files');
      expect(result.stopReason).toContain('Private keys');
      expect(result.stopReason).toContain('manually outside Claude Code');
    });
  });

  describe('comprehensive protected patterns coverage', () => {
    test('blocks all known protected patterns', () => {
      // Arrange - test each protected pattern
      const protectedFiles = [
        '/path/.env',
        '/path/.env.local',
        '/path/.env.production',
        '/path/credentials.json',
        '/path/secrets.json',
        '/path/private.key',
        '/path/server.pem',
        '/path/id_rsa',
        '/path/id_ed25519',
      ];

      // Act & Assert
      for (const filePath of protectedFiles) {
        const input = createWriteInput(filePath, 'content');
        const result = fileGuard(input);
        expect(result.continue).toBe(false);
      }
    });
  });
});
