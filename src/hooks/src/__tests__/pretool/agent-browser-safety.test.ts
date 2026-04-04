/**
 * Unit tests for agent-browser-safety hook
 * Tests URL blocking and sensitive action detection for browser automation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => mockCommonBasic({
  getLogDir: vi.fn(() => '/tmp/test-orchestkit'),
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
import { createTestContext } from '../fixtures/test-context.js';

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('agent-browser-safety', () => {
  beforeEach(() => {
    testCtx = createTestContext({ logDir: '/tmp/test-orchestkit' });
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

  it('allows agent-browser navigating to localhost dev servers', () => {
    const input = createBashInput('agent-browser navigate "http://localhost:8080/admin"');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(true);
  });

  it('allows agent-browser navigating to localhost with any port', () => {
    const input3000 = createBashInput('agent-browser navigate "http://localhost:3000"');
    expect(agentBrowserSafety(input3000).continue).toBe(true);

    const input4550 = createBashInput('agent-browser navigate "http://localhost:4550"');
    expect(agentBrowserSafety(input4550).continue).toBe(true);

    const input5173 = createBashInput('agent-browser navigate "http://localhost:5173/dashboard"');
    expect(agentBrowserSafety(input5173).continue).toBe(true);
  });

  it('allows agent-browser navigating to subdomain.localhost', () => {
    const input = createBashInput('agent-browser navigate "http://hq-web.localhost:1355"');
    expect(agentBrowserSafety(input).continue).toBe(true);
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

  it('allows 127.0.0.1 for local dev servers', () => {
    const input = createBashInput('agent-browser navigate "http://127.0.0.1:3000/api/users"');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(true);
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

  it('warns about --allow-file-access flag (v0.16)', () => {
    const input = createBashInput('agent-browser --allow-file-access open "file:///tmp/test.html"');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('--allow-file-access');
    expect(result.hookSpecificOutput?.additionalContext).toContain('file:// URL');
  });

  it('blocks echoing AGENT_BROWSER_ENCRYPTION_KEY (v0.16)', () => {
    const input = createBashInput('echo $AGENT_BROWSER_ENCRYPTION_KEY');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('AGENT_BROWSER_ENCRYPTION_KEY');
  });

  it('blocks printf of AGENT_BROWSER_ENCRYPTION_KEY (v0.16)', () => {
    const input = createBashInput('printf "%s" "$AGENT_BROWSER_ENCRYPTION_KEY" > /tmp/key.txt');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('AGENT_BROWSER_ENCRYPTION_KEY');
  });

  it('warns about --user-agent spoofing (v0.16)', () => {
    const input = createBashInput('agent-browser --user-agent "Mozilla/5.0 Chrome/120" open "https://example.com"');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('--user-agent');
    expect(result.hookSpecificOutput?.additionalContext).toContain('spoof');
  });

  it('warns about DevTools inspect command (v0.18+)', () => {
    const input = createBashInput('agent-browser inspect');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('DevTools');
  });

  it('warns about get cdp-url command (v0.18+)', () => {
    const input = createBashInput('agent-browser get cdp-url');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('CDP');
  });

  it('warns about clipboard read (v0.19+)', () => {
    const input = createBashInput('agent-browser clipboard read');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('clipboard');
  });

  it('warns about HAR capture stop (v0.21+)', () => {
    const input = createBashInput('agent-browser network har stop /tmp/trace.har');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('HAR');
  });

  it('allows HAR capture start without warning (v0.21+)', () => {
    const input = createBashInput('agent-browser network har start');
    const result = agentBrowserSafety(input);
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
  });
});
