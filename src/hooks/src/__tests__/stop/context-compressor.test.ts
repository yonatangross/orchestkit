/**
 * Tests for Context Compressor Hook
 *
 * Tests end-of-session context compression and archiving.
 * Covers: session archiving, decision compression (>10 threshold),
 * compaction manifest writing, missing files, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PathLike } from 'node:fs';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock common utilities
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getProjectDir: vi.fn(() => '/test/project'),
}));

import { contextCompressor } from '../../stop/context-compressor.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { logHook, } from '../../lib/common.js';
import type { HookInput } from '../../types.js';

describe('Context Compressor Hook', () => {
  const mockExistsSync = vi.mocked(existsSync);
  const mockMkdirSync = vi.mocked(mkdirSync);
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockLogHook = vi.mocked(logHook);

  const defaultInput: HookInput = {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  // ===========================================================================
  // SECTION 1: Session Archiving
  // ===========================================================================
  describe('Session Archiving', () => {
    it('should archive session when state.json exists', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('session/state.json')) return true;
        return false;
      });
      const sessionState = {
        session_id: 'sess-123',
        current_task: { description: 'Test task' },
        files_touched: ['file1.ts'],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(sessionState));

      // Act
      const result = contextCompressor(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('archive/sessions'),
        { recursive: true }
      );
      // Should write: compaction manifest + archive file + reset state = 3 writes
      expect(mockWriteFileSync).toHaveBeenCalledTimes(3);
    });

    it('should include ended timestamp and archived flag in archive', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('session/state.json')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ session_id: 'sess-1' }));

      // Act
      contextCompressor(defaultInput);

      // Assert
      // First write is the compaction manifest or archive file
      const archiveCallArgs = mockWriteFileSync.mock.calls.find(
        call => String(call[0]).includes('archive/sessions/')
      );
      expect(archiveCallArgs).toBeDefined();
      const archived = JSON.parse(archiveCallArgs![1] as string);
      expect(archived.archived).toBe(true);
      expect(archived.ended).toBeTruthy();
    });

    it('should reset session state after archiving', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('session/state.json')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ session_id: 'sess-1' }));

      // Act
      contextCompressor(defaultInput);

      // Assert
      const resetCallArgs = mockWriteFileSync.mock.calls.find(
        call => String(call[0]).includes('session/state.json')
      );
      expect(resetCallArgs).toBeDefined();
      const resetState = JSON.parse(resetCallArgs![1] as string);
      expect(resetState.session_id).toBeNull();
      expect(resetState.$schema).toBe('context://session/v1');
    });

    it('should log no session state message when file does not exist', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      contextCompressor(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'context-compressor',
        'No session state to archive'
      );
    });
  });

  // ===========================================================================
  // SECTION 2: Decision Compression
  // ===========================================================================
  describe('Decision Compression', () => {
    it('should compress decisions when more than 10 exist', () => {
      // Arrange - session file doesn't exist, decisions file exists
      const decisions = Array.from({ length: 15 }, (_, i) => ({
        id: `decision-${i}`,
        what: `Decision ${i}`,
      }));
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('decisions/active.json')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ decisions }));

      // Act
      contextCompressor(defaultInput);

      // Assert
      // Should write archive file and updated active file
      const archiveCall = mockWriteFileSync.mock.calls.find(
        call => String(call[0]).includes('archive/decisions/')
      );
      expect(archiveCall).toBeDefined();
      const archivedDecisions = JSON.parse(archiveCall![1] as string);
      expect(archivedDecisions.length).toBe(5); // 15 - 10 = 5 archived

      const activeCall = mockWriteFileSync.mock.calls.find(
        call => String(call[0]).includes('decisions/active.json')
      );
      expect(activeCall).toBeDefined();
      const activeData = JSON.parse(activeCall![1] as string);
      expect(activeData.decisions.length).toBe(10); // keep last 10
    });

    it('should not compress when decisions count is <= 10', () => {
      // Arrange
      const decisions = Array.from({ length: 8 }, (_, i) => ({
        id: `decision-${i}`,
      }));
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('decisions/active.json')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ decisions }));

      // Act
      contextCompressor(defaultInput);

      // Assert - no archive write for decisions
      const archiveCall = mockWriteFileSync.mock.calls.find(
        call => String(call[0]).includes('archive/decisions/')
      );
      expect(archiveCall).toBeUndefined();
    });

    it('should log archived count when compressing', () => {
      // Arrange
      const decisions = Array.from({ length: 12 }, (_, i) => ({ id: `d-${i}` }));
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('decisions/active.json')) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ decisions }));

      // Act
      contextCompressor(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'context-compressor',
        'Archived 2 old decisions'
      );
    });
  });

  // ===========================================================================
  // SECTION 3: Compaction Manifest
  // ===========================================================================
  describe('Compaction Manifest', () => {
    it('should write compaction manifest when session file exists', () => {
      // Arrange
      mockExistsSync.mockImplementation((path: PathLike) => {
        if (String(path).includes('session/state.json')) return true;
        return false;
      });
      const sessionState = {
        session_id: 'sess-manifest-test',
        decisions_this_session: ['d1', 'd2'],
        files_touched: ['file1.ts', 'file2.ts'],
        blockers: ['blocker1'],
        next_steps: ['step1'],
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(sessionState));

      // Act
      contextCompressor(defaultInput);

      // Assert
      const manifestCall = mockWriteFileSync.mock.calls.find(
        call => String(call[0]).includes('compaction-manifest.json')
      );
      expect(manifestCall).toBeDefined();
      const manifest = JSON.parse(manifestCall![1] as string);
      expect(manifest.sessionId).toBe('sess-manifest-test');
      expect(manifest.compactedAt).toBeTruthy();
      expect(manifest.blockers).toEqual(['blocker1']);
      expect(manifest.nextSteps).toEqual(['step1']);
    });

    it('should skip manifest when no session file exists', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      contextCompressor(defaultInput);

      // Assert
      const manifestCall = mockWriteFileSync.mock.calls.find(
        call => String(call[0]).includes('compaction-manifest.json')
      );
      expect(manifestCall).toBeUndefined();
    });
  });

  // ===========================================================================
  // SECTION 4: Error Handling
  // ===========================================================================
  describe('Error Handling', () => {
    it('should handle missing files gracefully', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      const result = contextCompressor(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should handle JSON parse errors gracefully', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');

      // Act
      const result = contextCompressor(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
      expect(mockLogHook).toHaveBeenCalledWith(
        'context-compressor',
        expect.stringContaining('Error')
      );
    });

    it('should handle writeFileSync errors in archiving', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ session_id: 'test' }));
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      // Act
      const result = contextCompressor(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should always return outputSilentSuccess', () => {
      // Arrange
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Critical error');
      });

      // Act
      const result = contextCompressor(defaultInput);

      // Assert
      expect(result).toEqual({ continue: true, suppressOutput: true });
    });

    it('should log compression start and completion messages', () => {
      // Arrange
      mockExistsSync.mockReturnValue(false);

      // Act
      contextCompressor(defaultInput);

      // Assert
      expect(mockLogHook).toHaveBeenCalledWith(
        'context-compressor',
        'Starting end-of-session compression...'
      );
      expect(mockLogHook).toHaveBeenCalledWith(
        'context-compressor',
        'End-of-session compression complete'
      );
    });
  });
});
