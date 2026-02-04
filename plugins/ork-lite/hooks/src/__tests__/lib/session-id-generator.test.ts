/**
 * Tests for Smart Session ID Generator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock modules
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import {
  getProjectName,
  getGitBranchForSession,
  formatDateComponent,
  formatTimeComponent,
  generateShortHash,
  sanitizeName,
  generateSmartSessionId,
  getCachedSessionId,
  cacheSessionId,
  getOrGenerateSessionId,
} from '../../lib/session-id-generator.js';

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

describe('Smart Session ID Generator', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockMkdirSync = vi.mocked(mkdirSync);
  const mockExecSync = vi.mocked(execSync);

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_SESSION_ID;
    delete process.env.ORCHESTKIT_SESSION_BRANCH;
  });

  describe('getProjectName', () => {
    it('should extract project name from directory path', () => {
      process.env.CLAUDE_PROJECT_DIR = '/Users/test/projects/my-awesome-project';

      const name = getProjectName();

      expect(name).toBe('my-awesome-project');
    });

    it('should sanitize special characters', () => {
      process.env.CLAUDE_PROJECT_DIR = '/path/to/My Project (2024)';

      const name = getProjectName();

      expect(name).toBe('my-project-2024');
    });

    it('should truncate long project names', () => {
      process.env.CLAUDE_PROJECT_DIR = '/path/to/this-is-a-very-long-project-name-that-exceeds-limit';

      const name = getProjectName();

      expect(name.length).toBeLessThanOrEqual(20);
    });

    it('should use provided project directory', () => {
      const name = getProjectName('/custom/path/orchestkit');

      expect(name).toBe('orchestkit');
    });
  });

  describe('getGitBranchForSession', () => {
    it('should return git branch when available', () => {
      mockExecSync.mockReturnValue('main\n');

      const branch = getGitBranchForSession('/test/project');

      expect(branch).toBe('main');
    });

    it('should sanitize feature branch names', () => {
      mockExecSync.mockReturnValue('feature/245-smart-sessions\n');

      const branch = getGitBranchForSession('/test/project');

      // Branch gets sanitized (/ → -) and truncated to 15 chars
      expect(branch).toBe('feature-245-sma');
    });

    it('should return nobranch when git fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const branch = getGitBranchForSession('/test/project');

      expect(branch).toBe('nobranch');
    });

    it('should cache branch in env var', () => {
      mockExecSync.mockReturnValue('develop\n');

      getGitBranchForSession('/test/project');

      expect(process.env.ORCHESTKIT_SESSION_BRANCH).toBe('develop');
    });

    it('should use cached branch', () => {
      process.env.ORCHESTKIT_SESSION_BRANCH = 'cached-branch';

      const branch = getGitBranchForSession('/test/project');

      expect(branch).toBe('cached-branch');
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('formatDateComponent', () => {
    it('should format date as MMDD', () => {
      const date = new Date(2026, 0, 30); // Jan 30, 2026

      const result = formatDateComponent(date);

      expect(result).toBe('0130');
    });

    it('should pad single-digit months', () => {
      const date = new Date(2026, 4, 5); // May 5, 2026

      const result = formatDateComponent(date);

      expect(result).toBe('0505');
    });

    it('should handle December', () => {
      const date = new Date(2026, 11, 25); // Dec 25, 2026

      const result = formatDateComponent(date);

      expect(result).toBe('1225');
    });
  });

  describe('formatTimeComponent', () => {
    it('should format time as HHMM', () => {
      const date = new Date(2026, 0, 30, 17, 45);

      const result = formatTimeComponent(date);

      expect(result).toBe('1745');
    });

    it('should pad single-digit hours', () => {
      const date = new Date(2026, 0, 30, 9, 5);

      const result = formatTimeComponent(date);

      expect(result).toBe('0905');
    });

    it('should handle midnight', () => {
      const date = new Date(2026, 0, 30, 0, 0);

      const result = formatTimeComponent(date);

      expect(result).toBe('0000');
    });
  });

  describe('generateShortHash', () => {
    it('should generate 4-character hex hash', () => {
      const hash = generateShortHash();

      expect(hash).toHaveLength(4);
      expect(hash).toMatch(/^[a-f0-9]{4}$/);
    });

    it('should generate different hashes on subsequent calls', () => {
      const hash1 = generateShortHash();
      const hash2 = generateShortHash();

      // With random component, these should differ
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('sanitizeName', () => {
    it('should lowercase input', () => {
      expect(sanitizeName('HELLO', 20)).toBe('hello');
    });

    it('should replace spaces with dashes', () => {
      expect(sanitizeName('my project', 20)).toBe('my-project');
    });

    it('should replace special characters with dashes', () => {
      expect(sanitizeName('feat/123_test', 20)).toBe('feat-123-test');
    });

    it('should collapse multiple dashes', () => {
      expect(sanitizeName('a--b---c', 20)).toBe('a-b-c');
    });

    it('should trim leading and trailing dashes', () => {
      expect(sanitizeName('-test-', 20)).toBe('test');
    });

    it('should truncate to max length', () => {
      expect(sanitizeName('this-is-very-long', 10)).toBe('this-is-ve');
    });
  });

  describe('generateSmartSessionId', () => {
    it('should generate valid session ID format', () => {
      process.env.CLAUDE_PROJECT_DIR = '/path/to/orchestkit';
      mockExecSync.mockReturnValue('main\n');
      const date = new Date(2026, 0, 30, 17, 45);

      const sessionId = generateSmartSessionId(undefined, date);

      expect(sessionId).toMatch(/^orchestkit-main-0130-1745-[a-f0-9]{4}$/);
    });

    it('should handle missing git branch', () => {
      process.env.CLAUDE_PROJECT_DIR = '/path/to/project';
      mockExecSync.mockImplementation(() => {
        throw new Error('not a git repo');
      });
      const date = new Date(2026, 0, 30, 17, 45);

      const sessionId = generateSmartSessionId(undefined, date);

      expect(sessionId).toMatch(/^project-nobranch-0130-1745-[a-f0-9]{4}$/);
    });

    it('should sanitize long branch names', () => {
      process.env.CLAUDE_PROJECT_DIR = '/path/to/app';
      mockExecSync.mockReturnValue('feature/very-long-branch-name-here\n');
      const date = new Date(2026, 0, 30, 9, 30);

      const sessionId = generateSmartSessionId(undefined, date);

      // Branch should be truncated
      expect(sessionId).toMatch(/^app-feature-very-lo-0130-0930-[a-f0-9]{4}$/);
    });
  });

  describe('getCachedSessionId', () => {
    it('should return undefined when cache file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = getCachedSessionId('/test/project');

      expect(result).toBeUndefined();
    });

    it('should return cached session ID when valid', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        session_id: 'cached-session-id',
        created_at: new Date().toISOString(),
      }));

      const result = getCachedSessionId('/test/project');

      expect(result).toBe('cached-session-id');
    });

    it('should return undefined when cache is expired (>24h)', () => {
      mockExistsSync.mockReturnValue(true);
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      mockReadFileSync.mockReturnValue(JSON.stringify({
        session_id: 'old-session-id',
        created_at: oldDate.toISOString(),
      }));

      const result = getCachedSessionId('/test/project');

      expect(result).toBeUndefined();
    });

    it('should return undefined on parse error', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');

      const result = getCachedSessionId('/test/project');

      expect(result).toBeUndefined();
    });
  });

  describe('cacheSessionId', () => {
    it('should write session ID to cache file', () => {
      mockExistsSync.mockReturnValue(true);

      cacheSessionId('new-session-id', '/test/project');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('session-id.json'),
        expect.stringContaining('new-session-id')
      );
    });

    it('should create .instance directory if missing', () => {
      mockExistsSync.mockReturnValue(false);

      cacheSessionId('new-session-id', '/test/project');

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.instance'),
        { recursive: true }
      );
    });

    it('should not throw on write error', () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => cacheSessionId('test-id', '/test/project')).not.toThrow();
    });
  });

  describe('getOrGenerateSessionId', () => {
    it('should return CLAUDE_SESSION_ID when set', () => {
      process.env.CLAUDE_SESSION_ID = 'env-session-id';

      const result = getOrGenerateSessionId('/test/project');

      expect(result).toBe('env-session-id');
    });

    it('should return cached session ID when available', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        session_id: 'cached-id',
        created_at: new Date().toISOString(),
      }));

      const result = getOrGenerateSessionId('/test/project');

      expect(result).toBe('cached-id');
    });

    it('should generate new session ID when nothing available', () => {
      mockExistsSync.mockReturnValue(false);
      process.env.CLAUDE_PROJECT_DIR = '/path/to/myproject';
      mockExecSync.mockReturnValue('develop\n');

      const result = getOrGenerateSessionId();

      // Should generate a smart session ID with expected format
      expect(result).toMatch(/^myproject-develop-\d{4}-\d{4}-[a-f0-9]{4}$/);
    });

    it('should attempt to cache generated session ID', () => {
      // Mock existsSync to return false for cache check, true for directory check
      let callCount = 0;
      mockExistsSync.mockImplementation(() => {
        callCount++;
        return callCount > 1; // First call (cache check) = false, second (dir check) = true
      });
      process.env.CLAUDE_PROJECT_DIR = '/path/to/myproject';
      mockExecSync.mockReturnValue('develop\n');

      getOrGenerateSessionId();

      // Should attempt to write cache file
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('session-id.json'),
        expect.any(String)
      );
    });
  });
});
