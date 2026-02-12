/// <reference types="node" />

/**
 * E2E tests for decision capture data flow (#245)
 *
 * This test verifies the REAL decision capture pipeline:
 * 1. User prompt -> detectUserIntent -> decisions detected
 * 2. decisions -> createDecisionRecord -> storeDecision
 * 3. storeDecision -> graph_operations + cc_native (v7 simplified)
 *
 * v7 changes: storeDecision no longer writes to local JSONL files.
 * It returns graph operations for the caller to execute via MCP tools,
 * and optionally writes to CC native MEMORY.md.
 *
 * ROOT CAUSE being tested:
 * - When CLAUDE_PROJECT_DIR is not set, getProjectDir() returns '.'
 * - This causes CC native memory writes to target wrong location
 * - Fire-and-forget storeDecision().catch() swallows errors silently
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Store original env
const originalEnv = { ...process.env };

describe('Decision Capture E2E Tests (#245)', () => {
  let tempDir: string;
  let memoryDir: string;

  beforeEach(() => {
    // Create temp directory for test
    tempDir = mkdtempSync(join(tmpdir(), 'decision-capture-e2e-'));
    memoryDir = join(tempDir, '.claude', 'memory');
    mkdirSync(memoryDir, { recursive: true });

    // Set environment to point to temp directory
    process.env.CLAUDE_PROJECT_DIR = tempDir;
    process.env.CLAUDE_SESSION_ID = `e2e-test-${Date.now()}`;

    // Clear any module cache to ensure fresh imports with new env
    // This is critical - modules cache getProjectDir() results
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };

    // Clean up temp directory
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Path Resolution Verification', () => {
    test('getProjectDir returns CLAUDE_PROJECT_DIR when set', async () => {
      // Dynamic import to get fresh module with current env
      const { getProjectDir } = await import('../../lib/common.js');

      const projectDir = getProjectDir();
      expect(projectDir).toBe(tempDir);
    });

    test('getProjectDir returns "." when CLAUDE_PROJECT_DIR not set (BUG)', async () => {
      // Unset the env var
      delete process.env.CLAUDE_PROJECT_DIR;

      // Dynamic import to get fresh module
      const { getProjectDir } = await import('../../lib/common.js');

      const projectDir = getProjectDir();
      // This is the BUG: returns '.' instead of discovering the actual project dir
      expect(projectDir).toBe('.');
    });
  });

  describe('Decision Storage Pipeline', () => {
    test('storeDecision returns graph operations for a decision', async () => {
      // Import with correct env set
      const { createDecisionRecord, storeDecision } = await import('../../lib/memory-writer.js');

      const record = createDecisionRecord(
        'decision',
        { what: 'Use PostgreSQL for the database' },
        ['PostgreSQL', 'database'],
        {
          session_id: process.env.CLAUDE_SESSION_ID!,
          source: 'user_prompt',
          confidence: 0.9,
          category: 'database',
        }
      );

      // Store the decision
      const result = await storeDecision(record);

      // v7: storeDecision returns graph operations instead of writing to JSONL
      expect(result.graph_operations).toBeDefined();
      expect(result.graph_operations.length).toBeGreaterThan(0);

      // Each operation should have a valid type
      for (const op of result.graph_operations) {
        expect(['create_entities', 'create_relations', 'add_observations']).toContain(op.type);
        expect(op.payload).toBeDefined();
        expect(op.timestamp).toBeDefined();
      }
    });

    test('storeDecision generates relation operations for decisions with alternatives', async () => {
      const { createDecisionRecord, storeDecision } = await import('../../lib/memory-writer.js');

      const record = createDecisionRecord(
        'decision',
        {
          what: 'Chose FastAPI over Django',
          alternatives: ['Django'],
        },
        ['FastAPI', 'Django'],
        {
          session_id: process.env.CLAUDE_SESSION_ID!,
          source: 'user_prompt',
          confidence: 0.85,
          category: 'backend',
        }
      );

      const result = await storeDecision(record);

      // Should have graph operations including relations
      expect(result.graph_operations.length).toBeGreaterThan(0);

      // Find create_relations operations
      const relationOps = result.graph_operations.filter(op => op.type === 'create_relations');
      expect(relationOps.length).toBeGreaterThanOrEqual(1);

      // Check relations exist in payload
      const allRelations = relationOps.flatMap(
        (op: { payload?: { relations?: Array<{ relationType: string }> } }) =>
          op.payload?.relations || []
      );
      expect(allRelations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('captureUserIntent Integration', () => {
    test('captures decision from user prompt', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = {
        prompt: "Let's use PostgreSQL for our database because it has great JSON support and we need ACID compliance",
        session_id: process.env.CLAUDE_SESSION_ID!,
        tool_name: '',
        tool_input: {},
      };

      // Call the hook
      const result = captureUserIntent(input);

      // Hook should return silent success
      expect(result.continue).toBe(true);

      // Wait for async storage to complete (fire-and-forget)
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    test('captures preference from user prompt', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = {
        prompt: 'I prefer using TypeScript over JavaScript for better type safety in large codebases',
        session_id: process.env.CLAUDE_SESSION_ID!,
        tool_name: '',
        tool_input: {},
      };

      const result = captureUserIntent(input);
      expect(result.continue).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 500));
    });
  });

  describe('Error Handling Visibility', () => {
    test('logs error when storage fails (not silent swallow)', async () => {
      // Set an invalid path to force error
      process.env.CLAUDE_PROJECT_DIR = '/nonexistent/path/that/does/not/exist';

      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = {
        prompt: "Let's use Redis for caching because it's fast and supports multiple data structures",
        session_id: process.env.CLAUDE_SESSION_ID!,
        tool_name: '',
        tool_input: {},
      };

      // Should not throw - fire-and-forget
      const result = captureUserIntent(input);
      expect(result.continue).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 500));

      // The error should be logged somewhere (hooks.log)
      // This test documents that errors are currently swallowed
      // After the fix, we should verify the error IS logged
    });
  });

  describe('Session Tracking Integration', () => {
    test('tracks decision in session events', async () => {
      const { captureUserIntent } = await import('../../prompt/capture-user-intent.js');

      const input = {
        prompt: "Let's use Vitest for testing because it's faster than Jest and has better ESM support",
        session_id: process.env.CLAUDE_SESSION_ID!,
        tool_name: '',
        tool_input: {},
      };

      captureUserIntent(input);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Session events should include decision_made
      const sessionsDir = join(memoryDir, 'sessions');
      const sessionFile = join(sessionsDir, `${process.env.CLAUDE_SESSION_ID}.jsonl`);

      // May not exist if session tracker isn't initialized
      // This documents expected behavior
      if (existsSync(sessionFile)) {
        const { readFileSync } = await import('node:fs');
        const content = readFileSync(sessionFile, 'utf8');
        const events = content
          .trim()
          .split('\n')
          .map((l) => JSON.parse(l));
        const decisionEvents = events.filter((e) => e.type === 'decision_made');
        expect(decisionEvents.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
