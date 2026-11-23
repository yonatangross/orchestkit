import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { win32 } from 'node:path';

import { asciiLint } from '../../posttool/ascii-lint.js';
import { autoLint } from '../../posttool/auto-lint.js';
import type { HookInput } from '../../types.js';

vi.mock('node:path', async (importOriginal) => {
  const path = await importOriginal<typeof import('node:path')>();
  return { ...path, ...path.win32, default: path.win32 };
});

vi.mock('node:fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('node:child_process', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  execFileSync: vi.fn(),
}));

const project = 'C:\\work\\project';
const uncProject = '\\\\server\\share\\project';
const cases = [
  { kind: 'drive-absolute', root: project, inputDir: win32.join(project, 'src') },
  { kind: 'UNC', root: uncProject, inputDir: win32.join(uncProject, 'src') },
  { kind: 'project-relative', root: project, inputDir: 'src' },
];

function writeInput(filePath: string): HookInput {
  return { tool_name: 'Write', session_id: 'test-session', tool_input: { file_path: filePath } };
}

describe('lint hooks with Windows paths', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('SKIP_AUTO_LINT', undefined);
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each(cases)('auto-lint formats a $kind path', ({ root, inputDir }) => {
    // Arrange
    vi.stubEnv('CLAUDE_PROJECT_DIR', root);
    const filePath = win32.join(root, 'src', 'app.ts');
    const configPath = win32.join(root, 'biome.json');
    vi.mocked(existsSync).mockImplementation((path) => {
      const normalized = win32.normalize(String(path));
      return normalized === filePath || normalized === configPath;
    });
    vi.mocked(readFileSync).mockReturnValue('const app = 1;');
    vi.mocked(execFileSync).mockReturnValue('');

    // Act
    autoLint(writeInput(win32.join(inputDir, 'app.ts')));

    // Assert
    const args = vi.mocked(execFileSync).mock.calls.find(([command]) => command === 'biome')?.[1];
    expect(args && [args[0], args[1], win32.normalize(args[2])]).toEqual(['check', '--write', filePath]);
  });

  it.each(cases)('ascii-lint reports a finding for a $kind path', ({ root, inputDir }) => {
    // Arrange
    vi.stubEnv('CLAUDE_PROJECT_DIR', root);
    const filePath = win32.join(root, 'src', 'guide.md');
    vi.mocked(existsSync).mockImplementation((path) => path === filePath);
    vi.mocked(readFileSync).mockReturnValue(['```', `┌${'─'.repeat(79)}┐`, '```'].join('\n'));

    // Act
    const result = asciiLint(writeInput(win32.join(inputDir, 'guide.md')));

    // Assert
    expect(readFileSync).toHaveBeenCalledWith(filePath, 'utf-8');
    expect(result.systemMessage).toContain('finding(s) in guide.md\n');
    expect(result.systemMessage).toContain('[width-80]');
  });

  it.each([80, 81])('ascii-lint measures a %i-character CRLF line without the terminator', (width) => {
    vi.stubEnv('CLAUDE_PROJECT_DIR', project);
    const filePath = win32.join(project, 'src', 'guide.md');
    vi.mocked(existsSync).mockImplementation((path) => path === filePath);
    vi.mocked(readFileSync).mockReturnValue(['```', `───${'a'.repeat(width - 3)}`, '```'].join('\r\n'));

    const result = asciiLint(writeInput(filePath));

    expect(readFileSync).toHaveBeenCalledWith(filePath, 'utf-8');
    if (width === 80) {
      expect(result.systemMessage).toBeUndefined();
    } else {
      expect(result.systemMessage).toContain('width 81 > 80');
    }
  });

  it('auto-lint does not pick up config above a Windows project root with different separators', () => {
    // Arrange
    vi.stubEnv('CLAUDE_PROJECT_DIR', 'C:/work/project');
    const filePath = win32.join(project, 'src', 'app.ts');
    const parentConfig = win32.join(project, '..', 'biome.json');
    vi.mocked(existsSync).mockImplementation((path) => path === filePath || path === parentConfig);
    vi.mocked(readFileSync).mockReturnValue('const app = 1;');
    vi.mocked(execFileSync).mockReturnValue('');

    // Act
    autoLint(writeInput(filePath));

    // Assert
    expect(readFileSync).toHaveBeenCalledWith(filePath);
    expect(existsSync).not.toHaveBeenCalledWith(parentConfig);
  });

  it.each(['.claude', 'node_modules', '.git', 'dist'])('auto-lint skips Windows %s paths', (dir) => {
    // Arrange
    vi.stubEnv('CLAUDE_PROJECT_DIR', project);
    const input = writeInput(win32.join(project, dir, 'app.ts'));

    // Act
    autoLint(input);

    // Assert
    expect(existsSync).not.toHaveBeenCalled();
  });

  it.each(['node_modules', '.git'])('ascii-lint skips Windows %s paths under src', (dir) => {
    // Arrange
    vi.stubEnv('CLAUDE_PROJECT_DIR', project);
    const input = writeInput(win32.join(project, 'src', dir, 'guide.md'));

    // Act
    asciiLint(input);

    // Assert
    expect(existsSync).not.toHaveBeenCalled();
  });
});
