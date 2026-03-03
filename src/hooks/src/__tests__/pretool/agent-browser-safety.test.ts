/**
 * Unit tests for agent-browser-safety hook
 * Tests URL blocking and sensitive action detection for browser automation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  logPermissionFeedback: vi.fn(),
  getLogDir: vi.fn(() => '/tmp/test-orchestkit'),
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
  outputAllowWithContext: vi.fn((ctx: string) => ({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: ctx,
      permissionDecision: 'allow',
    },
  })),
}));

// Mock node:fs to prevent actual file operations
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock child_process for robots.txt fetching
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
}));

import { agentBrowserSafety } from '../../pretool/bash/agent-browser-safety.js';
import type { HookInput } from '../../types.js';

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
  };
}

describe('agent-browser-safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns silent success for non-agent-browser commands', () => {
    // Arrange
    const input = createBashInput('npm run build');

    // Act
    const result = agentBrowserSafety(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('blocks agent-browser navigating to internal admin URLs', () => {
    // Arrange
    const input = createBashInput('agent-browser navigate "http://localhost:8080/admin"');

    // Act
    const result = agentBrowserSafety(input);

    // Assert
    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('blocked');
  });

  it('blocks agent-browser navigating to file:// URLs', () => {
    // Arrange
    const input = createBashInput('agent-browser goto "file:///etc/passwd"');

    // Act
    const result = agentBrowserSafety(input);

    // Assert
    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('blocked');
  });

  it('blocks navigation to OAuth provider login pages', () => {
    // Arrange
    const input = createBashInput('agent-browser navigate "https://accounts.google.com/signin"');

    // Act
    const result = agentBrowserSafety(input);

    // Assert
    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('blocked');
  });

  it('warns about sensitive actions like clicking delete buttons', () => {
    // Arrange
    const input = createBashInput('agent-browser click delete-account-button');

    // Act
    const result = agentBrowserSafety(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Sensitive browser action');
  });

  it('blocks 127.0.0.1 on any path, not just /admin', () => {
    const input = createBashInput('agent-browser navigate "http://127.0.0.1:3000/api/users"');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('blocked');
  });

  it('blocks AWS metadata endpoint (SSRF)', () => {
    const input = createBashInput('agent-browser navigate "http://169.254.169.254/latest/meta-data/"');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('blocked');
  });

  it('blocks GCP metadata endpoint (SSRF)', () => {
    const input = createBashInput('agent-browser navigate "http://metadata.google.internal/computeMetadata/v1/"');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('blocked');
  });

  it('blocks RFC 1918 private IPs', () => {
    const input10 = createBashInput('agent-browser navigate "http://10.0.0.1/secret"');
    expect(agentBrowserSafety(input10).continue).toBe(false);

    const input172 = createBashInput('agent-browser navigate "http://172.16.0.1/internal"');
    expect(agentBrowserSafety(input172).continue).toBe(false);

    const input192 = createBashInput('agent-browser navigate "http://192.168.1.1/admin"');
    expect(agentBrowserSafety(input192).continue).toBe(false);
  });

  it('allows safe agent-browser commands', () => {
    // Arrange
    const input = createBashInput('agent-browser navigate "https://example.com/docs"');

    // Act
    const result = agentBrowserSafety(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});
