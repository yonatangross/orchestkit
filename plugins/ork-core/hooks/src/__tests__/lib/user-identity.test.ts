/**
 * Tests for User Identity System
 * Tests identity resolution, privacy settings, and scoped IDs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveUserIdentity,
  getPrivacySettings,
  canShare,
  getUserIdForScope,
  getProjectUserId,
  getGlobalScopeId,
  saveUserIdentityConfig,
  getIdentityContext,
  clearIdentityCache,
} from '../../lib/user-identity.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Mock modules
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  hostname: vi.fn(() => 'test-machine'),
}));

describe('User Identity System', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockMkdirSync = vi.mocked(mkdirSync);
  const mockExecSync = vi.mocked(execSync);

  beforeEach(() => {
    vi.clearAllMocks();
    clearIdentityCache();

    // Default env
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
    process.env.CLAUDE_SESSION_ID = 'test-session-123';
    delete process.env.USER;
    delete process.env.USERNAME;
    delete process.env.LOGNAME;
  });

  afterEach(() => {
    delete process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_SESSION_ID;
  });

  describe('resolveUserIdentity', () => {
    it('should resolve from explicit config file', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'alice@company.com',
        display_name: 'Alice Smith',
        team_id: 'backend-team',
      }));

      const identity = resolveUserIdentity();

      expect(identity.user_id).toBe('alice@company.com');
      expect(identity.display_name).toBe('Alice Smith');
      expect(identity.team_id).toBe('backend-team');
      expect(identity.source).toBe('config');
      expect(identity.email).toBe('alice@company.com');
    });

    it('should resolve from git config when no explicit config', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync
        .mockReturnValueOnce(('bob@example.com\n'))
        .mockReturnValueOnce(('Bob Jones\n'));

      const identity = resolveUserIdentity();

      expect(identity.user_id).toBe('bob@example.com');
      expect(identity.display_name).toBe('Bob Jones');
      expect(identity.source).toBe('git');
      expect(identity.email).toBe('bob@example.com');
    });

    it('should resolve from environment when git fails', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('git not configured');
      });
      process.env.USER = 'charlie';

      const identity = resolveUserIdentity();

      expect(identity.user_id).toBe('charlie@test-machine');
      expect(identity.display_name).toBe('charlie');
      expect(identity.source).toBe('env');
    });

    it('should resolve as anonymous when all sources fail', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('git not configured');
      });

      const identity = resolveUserIdentity();

      expect(identity.user_id).toMatch(/^anon-[a-f0-9]+$/);
      expect(identity.display_name).toBe('Anonymous');
      expect(identity.source).toBe('anonymous');
    });

    it('should cache identity on subsequent calls', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync
        .mockReturnValueOnce(('cached@example.com\n'))
        .mockReturnValueOnce(('Cached User\n'));

      const first = resolveUserIdentity();
      const second = resolveUserIdentity();

      expect(first).toBe(second);
      expect(mockExecSync).toHaveBeenCalledTimes(2); // Only called once for email + name
    });

    it('should generate anonymous_id hash for privacy', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'test@example.com',
      }));

      const identity = resolveUserIdentity();

      expect(identity.anonymous_id).toBeDefined();
      expect(identity.anonymous_id).toHaveLength(16);
      expect(identity.anonymous_id).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('getPrivacySettings', () => {
    it('should return default privacy settings', () => {
      mockExistsSync.mockReturnValue(false);

      const privacy = getPrivacySettings();

      expect(privacy.share_with_team).toBe(true);
      expect(privacy.share_globally).toBe(false);
      expect(privacy.share_decisions).toBe(true);
      expect(privacy.share_preferences).toBe(true);
      expect(privacy.share_skill_usage).toBe(false);
      expect(privacy.share_prompts).toBe(false);
      expect(privacy.anonymize_globally).toBe(true);
    });

    it('should merge config overrides with defaults', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        privacy: {
          share_globally: true,
          share_skill_usage: true,
        },
      }));

      clearIdentityCache(); // Clear privacy cache
      const privacy = getPrivacySettings();

      expect(privacy.share_globally).toBe(true);
      expect(privacy.share_skill_usage).toBe(true);
      expect(privacy.share_with_team).toBe(true); // Default preserved
    });
  });

  describe('canShare', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
    });

    it('should allow sharing decisions with team by default', () => {
      expect(canShare('decisions', 'team')).toBe(true);
    });

    it('should deny sharing decisions globally by default', () => {
      expect(canShare('decisions', 'global')).toBe(false);
    });

    it('should deny sharing prompts by default', () => {
      expect(canShare('prompts', 'team')).toBe(false);
      expect(canShare('prompts', 'global')).toBe(false);
    });

    it('should allow global sharing when enabled in config', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        privacy: {
          share_globally: true,
        },
      }));
      clearIdentityCache();

      expect(canShare('decisions', 'global')).toBe(true);
    });
  });

  describe('getUserIdForScope', () => {
    it('should return user_id for local scope', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'user@test.com',
      }));

      const userId = getUserIdForScope('local');

      expect(userId).toBe('user@test.com');
    });

    it('should return anonymous_id for global scope with anonymization', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'user@test.com',
        privacy: { anonymize_globally: true },
      }));
      clearIdentityCache();

      const userId = getUserIdForScope('global');

      expect(userId).not.toBe('user@test.com');
      expect(userId).toHaveLength(16);
    });
  });

  describe('getProjectUserId', () => {
    it('should generate project-scoped user ID', () => {
      process.env.CLAUDE_PROJECT_DIR = '/path/to/my-project';

      const userId = getProjectUserId('decisions');

      expect(userId).toBe('my-project-decisions');
    });

    it('should sanitize project name', () => {
      process.env.CLAUDE_PROJECT_DIR = '/path/to/My Project With Spaces';

      const userId = getProjectUserId('decisions');

      expect(userId).toBe('my-project-with-spaces-decisions');
    });
  });

  describe('getGlobalScopeId', () => {
    it('should generate global scope ID', () => {
      const userId = getGlobalScopeId('best-practices');

      expect(userId).toBe('orchestkit-global-best-practices');
    });
  });

  describe('saveUserIdentityConfig', () => {
    it('should save config to .claude directory', () => {
      mockExistsSync.mockReturnValue(true);
      mockWriteFileSync.mockReturnValue(undefined);

      const result = saveUserIdentityConfig({
        user_id: 'new@user.com',
        team_id: 'new-team',
      });

      expect(result).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/test/project/.claude/.user_identity.json',
        expect.stringContaining('new@user.com')
      );
    });

    it('should create .claude directory if missing', () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockReturnValue(undefined);
      mockWriteFileSync.mockReturnValue(undefined);

      saveUserIdentityConfig({ user_id: 'test@user.com' });

      expect(mockMkdirSync).toHaveBeenCalledWith(
        '/test/project/.claude',
        { recursive: true }
      );
    });
  });

  describe('getIdentityContext', () => {
    it('should return full identity context', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        user_id: 'context@test.com',
        team_id: 'test-team',
      }));
      clearIdentityCache();

      const ctx = getIdentityContext();

      expect(ctx.session_id).toBe('test-session-123');
      expect(ctx.user_id).toBe('context@test.com');
      expect(ctx.team_id).toBe('test-team');
      expect(ctx.machine_id).toBe('test-machine');
      expect(ctx.identity_source).toBe('config');
      expect(ctx.timestamp).toBeDefined();
    });
  });
});
