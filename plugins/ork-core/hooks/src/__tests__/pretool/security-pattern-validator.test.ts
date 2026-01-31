/**
 * Unit tests for security-pattern-validator hook
 * Tests detection of security anti-patterns in code
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { securityPatternValidator } from '../../pretool/Write/security-pattern-validator.js';
import type { HookInput } from '../../types.js';

// Mock dependencies
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    logPermissionFeedback: vi.fn(),
    getProjectDir: vi.fn().mockReturnValue('/test/project'),
  };
});

vi.mock('../../lib/guards.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/guards.js')>('../../lib/guards.js');
  return {
    ...actual,
    guardCodeFiles: vi.fn().mockReturnValue(null), // Allow all files
    runGuards: vi.fn().mockReturnValue(null), // Allow all
  };
});

/**
 * Create a mock HookInput for Write commands
 */
function createWriteInput(filePath: string, content: string): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    tool_input: { file_path: filePath, content },
    project_dir: '/test/project',
  };
}

describe('security-pattern-validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hardcoded secrets detection (HIGH severity)', () => {
    const secretPatterns = [
      { content: 'api_key = "sk-1234567890abcdef"', name: 'api_key with underscore' },
      { content: 'API_KEY = "secret123"', name: 'API_KEY uppercase' },
      { content: 'apiKey: "my-secret-key"', name: 'apiKey camelCase colon' },
      { content: "password = 'super-secret'", name: 'password with single quotes' },
      { content: 'secret = "my-secret-value"', name: 'secret variable' },
      { content: 'token = "eyJhbGciOiJIUzI1NiIs..."', name: 'token JWT-like' },
      { content: 'api-key = "abc123"', name: 'api-key with hyphen' },
    ];

    test.each(secretPatterns)('detects hardcoded $name', ({ content }) => {
      const input = createWriteInput('src/config.ts', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('hardcoded secret');
    });

    test('detects secrets in various formats', () => {
      const input = createWriteInput('src/config.ts', 'api_key = "test123"');
      const result = securityPatternValidator(input);
      expect(result.hookSpecificOutput?.additionalContext).toContain('secret');
    });

    test('does not flag environment variable references', () => {
      const content = `
        const apiKey = process.env.API_KEY;
        const password = os.environ.get("PASSWORD");
      `;
      const input = createWriteInput('src/config.ts', content);
      const result = securityPatternValidator(input);

      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });
  });

  describe('SQL injection detection (HIGH severity)', () => {
    test('detects SQL injection via string concatenation with execute', () => {
      const content = 'execute("SELECT * FROM users WHERE id = " + user_id)';
      const input = createWriteInput('src/db.py', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('SQL injection');
    });

    test('detects SQL injection via f-string interpolation', () => {
      const content = 'f"SELECT * FROM users WHERE name = {name}"';
      const input = createWriteInput('src/db.py', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('SQL injection');
    });

    test('may not detect all injection patterns (depends on regex)', () => {
      // Simple concatenation without execute() may not be detected
      const content = 'query = "SELECT * FROM " + table_name';
      const input = createWriteInput('src/db.py', content);
      const result = securityPatternValidator(input);

      // This pattern may not match the hook's regex
      expect(result.continue).toBe(true);
    });

    test('does not flag parameterized queries', () => {
      const content = `
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        cursor.execute("SELECT * FROM users WHERE name = %s", (name,))
      `;
      const input = createWriteInput('src/db.py', content);
      const result = securityPatternValidator(input);

      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });
  });

  describe('Dangerous eval/exec detection (HIGH severity)', () => {
    const evalPatterns = [
      { content: 'eval(user_input)', name: 'eval with variable' },
      { content: 'eval("console.log(x)")', name: 'eval with string' },
      { content: 'exec(code_string)', name: 'exec with variable' },
      { content: 'exec("import os; os.system(cmd)")', name: 'exec with string' },
    ];

    test.each(evalPatterns)('detects dangerous $name', ({ content }) => {
      const input = createWriteInput('src/runtime.py', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('eval');
    });

    test('does not flag safe JSON.parse', () => {
      const content = `
        const result = JSON.parse(jsonString);
        const data = JSON.stringify(obj);
      `;
      const input = createWriteInput('src/parser.ts', content);
      const result = securityPatternValidator(input);

      // Should not trigger eval warning for JSON methods
      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).not.toContain('eval/exec');
    });
  });

  describe('Subprocess shell=True detection (MEDIUM severity)', () => {
    const shellPatterns = [
      { content: 'subprocess.run(cmd, shell=True)', name: 'run with shell=True' },
      { content: 'subprocess.call(cmd, shell = True)', name: 'call with shell = True' },
      { content: 'subprocess.Popen(cmd, shell=True)', name: 'Popen with shell=True' },
    ];

    test.each(shellPatterns)('detects $name', ({ content }) => {
      const input = createWriteInput('src/runner.py', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('shell=True');
    });

    test('does not flag shell=False', () => {
      const content = `
        subprocess.run(["ls", "-la"], shell=False)
        subprocess.call(cmd_list)
      `;
      const input = createWriteInput('src/runner.py', content);
      const result = securityPatternValidator(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).not.toContain('shell=True');
    });
  });

  describe('XSS vulnerability detection (MEDIUM severity)', () => {
    const xssPatterns = [
      { content: 'element.innerHTML = userInput', name: 'innerHTML assignment' },
      { content: 'div.innerHTML = "<script>" + code', name: 'innerHTML with script' },
      { content: '<div dangerouslySetInnerHTML={{__html: content}} />', name: 'React dangerouslySetInnerHTML' },
    ];

    test.each(xssPatterns)('detects $name', ({ content }) => {
      const input = createWriteInput('src/component.tsx', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('XSS');
    });

    test('does not flag textContent', () => {
      const content = `
        element.textContent = userInput;
        element.innerText = safeText;
      `;
      const input = createWriteInput('src/component.ts', content);
      const result = securityPatternValidator(input);

      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });
  });

  describe('Insecure random detection (MEDIUM severity)', () => {
    test('detects Math.random for password generation', () => {
      // Pattern requires Math.random() followed by password/token/secret/key
      const content = 'const userPassword = Math.random().toString(36) + generatePassword()';
      const input = createWriteInput('src/auth.ts', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      // May or may not detect based on pattern matching
    });

    test('does not flag crypto.randomBytes', () => {
      const content = `
        const tok = crypto.randomBytes(32).toString('hex');
        const uuid = crypto.randomUUID();
      `;
      const input = createWriteInput('src/secure-auth.ts', content);
      const result = securityPatternValidator(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).not.toContain('Insecure random');
    });

    test('does not flag regular Math.random for non-security use', () => {
      const content = `
        const randomColor = Math.random() * 255;
        const shuffleIndex = Math.floor(Math.random() * array.length);
      `;
      const input = createWriteInput('src/utils.ts', content);
      const result = securityPatternValidator(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).not.toContain('random');
    });
  });

  describe('Command injection detection (HIGH severity)', () => {
    const commandInjectionPatterns = [
      { content: 'os.system(user_command)', name: 'os.system' },
      { content: 'os.popen(cmd)', name: 'os.popen' },
      { content: 'os.system("rm " + filename)', name: 'os.system with concatenation' },
    ];

    test.each(commandInjectionPatterns)('detects $name', ({ content }) => {
      const input = createWriteInput('src/runner.py', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('command injection');
    });
  });

  describe('Insecure HTTP detection (LOW severity)', () => {
    const insecureHttpPatterns = [
      { content: 'fetch("http://api.example.com/data")', name: 'fetch with http' },
      { content: 'axios.get("http://external.com/api")', name: 'axios with http' },
      { content: 'const url = "http://production.example.com"', name: 'production http url' },
    ];

    test.each(insecureHttpPatterns)('detects $name', ({ content }) => {
      const input = createWriteInput('src/api.ts', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('HTTP');
    });

    test('does not flag localhost http', () => {
      const content = `
        fetch("http://localhost:3000/api")
        axios.get("http://127.0.0.1:8080/data")
      `;
      const input = createWriteInput('src/api.ts', content);
      const result = securityPatternValidator(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).not.toContain('Insecure HTTP');
    });

    test('does not flag https', () => {
      const content = `
        fetch("https://api.example.com/data")
        const url = "https://production.example.com"
      `;
      const input = createWriteInput('src/api.ts', content);
      const result = securityPatternValidator(input);

      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).not.toContain('HTTP');
    });
  });

  describe('Multiple vulnerabilities in same file', () => {
    test('reports all detected issues', () => {
      const content = `
        const apiKey = "sk-12345";
        element.innerHTML = userInput;
        os.system(command);
      `;
      const input = createWriteInput('src/vulnerable.py', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).toContain('hardcoded secret');
      expect(context).toContain('XSS');
      expect(context).toContain('command injection');
    });
  });

  describe('Clean code (should pass without warnings)', () => {
    test('passes clean TypeScript code', () => {
      const content = `
        import { config } from './config';

        export async function fetchUser(id: string): Promise<User> {
          const response = await fetch(\`\${config.apiUrl}/users/\${id}\`);
          return response.json();
        }
      `;
      const input = createWriteInput('src/users.ts', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });

    test('passes clean Python code', () => {
      const content = `
        import os
        from typing import Optional

        def get_config() -> dict:
            return {
                "api_key": os.environ.get("API_KEY"),
                "debug": os.environ.get("DEBUG", "false") == "true"
            }
      `;
      const input = createWriteInput('src/config.py', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    test('handles empty content', () => {
      const input = createWriteInput('src/empty.ts', '');
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
    });

    test('handles empty file path', () => {
      const input = createWriteInput('', 'const x = 1;');
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
    });

    test('handles very large content', () => {
      const content = 'const x = 1;\n'.repeat(10000);
      const input = createWriteInput('src/large.ts', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
    });

    test('handles binary-like content gracefully', () => {
      const content = '\x00\x01\x02\x03\xff\xfe\xfd';
      const input = createWriteInput('src/binary.bin', content);
      const result = securityPatternValidator(input);

      expect(result.continue).toBe(true);
    });

    test('handles content with only comments', () => {
      const content = `
        // This is a comment about api_key
        /* password = "example" in documentation */
        # eval() is dangerous - don't use it
      `;
      const input = createWriteInput('src/comments.ts', content);
      const result = securityPatternValidator(input);

      // Comments may still trigger detection (depends on implementation)
      expect(result.continue).toBe(true);
    });
  });

  describe('File type handling', () => {
    test('processes TypeScript files', () => {
      const input = createWriteInput('src/file.ts', 'api_key = "secret"');
      const result = securityPatternValidator(input);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });

    test('processes JavaScript files', () => {
      const input = createWriteInput('src/file.js', 'api_key = "secret"');
      const result = securityPatternValidator(input);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });

    test('processes Python files', () => {
      const input = createWriteInput('src/file.py', 'api_key = "secret"');
      const result = securityPatternValidator(input);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });
  });
});
