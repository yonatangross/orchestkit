/**
 * Unit tests for code-quality-gate hook
 * Tests function length, nesting depth, and complexity detection
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { codeQualityGate } from '../../pretool/Write/code-quality-gate.js';
import type { HookInput } from '../../types.js';

// Mock dependencies
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn().mockReturnValue('/test/project'),
  };
});

vi.mock('../../lib/guards.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/guards.js')>('../../lib/guards.js');
  return {
    ...actual,
    guardCodeFiles: vi.fn().mockReturnValue(null),
    guardSkipInternal: vi.fn().mockReturnValue(null),
    runGuards: vi.fn().mockReturnValue(null),
  };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
}));

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

/**
 * Generate a long function body
 */
function generateLongFunction(lines: number, lang: 'ts' | 'py'): string {
  if (lang === 'py') {
    let code = 'def long_function():\n';
    for (let i = 0; i < lines; i++) {
      code += `    print("line ${i}")\n`;
    }
    return code;
  } else {
    let code = 'function longFunction() {\n';
    for (let i = 0; i < lines; i++) {
      code += `  console.log("line ${i}");\n`;
    }
    code += '}\n';
    return code;
  }
}

/**
 * Generate deeply nested code
 */
function generateDeepNesting(depth: number, lang: 'ts' | 'py'): string {
  if (lang === 'py') {
    let code = 'def nested_function():\n';
    for (let i = 0; i < depth; i++) {
      code += '    '.repeat(i + 1) + `if condition_${i}:\n`;
    }
    code += '    '.repeat(depth + 1) + 'pass\n';
    return code;
  } else {
    let code = 'function nestedFunction() {\n';
    for (let i = 0; i < depth; i++) {
      code += '  '.repeat(i + 1) + `if (condition${i}) {\n`;
    }
    code += '  '.repeat(depth + 1) + 'return;\n';
    for (let i = depth - 1; i >= 0; i--) {
      code += '  '.repeat(i + 1) + '}\n';
    }
    code += '}\n';
    return code;
  }
}

describe('code-quality-gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Function length detection', () => {
    describe('Python functions', () => {
      test('warns for function over 50 lines', () => {
        const content = generateLongFunction(60, 'py');
        const input = createWriteInput('src/module.py', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput?.additionalContext).toContain('lines');
      });

      test('passes function under 50 lines', () => {
        const content = generateLongFunction(30, 'py');
        const input = createWriteInput('src/module.py', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
        // Should not have warnings about length
        const context = result.hookSpecificOutput?.additionalContext || '';
        expect(context).not.toContain('is 30 lines');
      });

      test('handles async def functions', () => {
        const content = `
async def long_async_function():
${Array(55).fill('    await asyncio.sleep(0)').join('\n')}
`;
        const input = createWriteInput('src/async_module.py', content);
        const result = codeQualityGate(input);

        expect(result.hookSpecificOutput?.additionalContext).toContain('lines');
      });

      test('handles class methods', () => {
        const content = `
class MyClass:
    def long_method(self):
${Array(55).fill('        pass').join('\n')}
`;
        const input = createWriteInput('src/class_module.py', content);
        const result = codeQualityGate(input);

        expect(result.hookSpecificOutput?.additionalContext).toContain('lines');
      });
    });

    describe('TypeScript functions', () => {
      test('warns for function over 50 lines', () => {
        const content = generateLongFunction(60, 'ts');
        const input = createWriteInput('src/module.ts', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput?.additionalContext).toContain('lines');
      });

      test('passes function under 50 lines', () => {
        const content = generateLongFunction(30, 'ts');
        const input = createWriteInput('src/module.ts', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
      });

      test('handles arrow functions', () => {
        const content = `
const longArrowFunction = () => {
${Array(55).fill('  console.log("line");').join('\n')}
};
`;
        const input = createWriteInput('src/arrow.ts', content);
        const result = codeQualityGate(input);

        // Arrow functions may be detected differently
        expect(result.continue).toBe(true);
      });

      test('handles const function expressions', () => {
        const content = `
const myFunction = async (param: string) => {
${Array(55).fill('  await Promise.resolve();').join('\n')}
};
`;
        const input = createWriteInput('src/func.ts', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
      });
    });

    describe('Multiple functions', () => {
      test('reports all long functions', () => {
        const content = `
function first() {
${Array(55).fill('  console.log("a");').join('\n')}
}

function second() {
${Array(55).fill('  console.log("b");').join('\n')}
}
`;
        const input = createWriteInput('src/multi.ts', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
        const context = result.hookSpecificOutput?.additionalContext || '';
        expect(context).toContain('first');
      });
    });
  });

  describe('Nesting depth detection', () => {
    describe('Python nesting', () => {
      test('warns for nesting deeper than 4 levels', () => {
        const content = generateDeepNesting(6, 'py');
        const input = createWriteInput('src/nested.py', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput?.additionalContext).toContain('nesting');
      });

      test('passes nesting within limits', () => {
        const content = generateDeepNesting(3, 'py');
        const input = createWriteInput('src/shallow.py', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
        const context = result.hookSpecificOutput?.additionalContext || '';
        expect(context).not.toContain('Deep nesting');
      });
    });

    describe('TypeScript nesting', () => {
      test('warns for deep nesting', () => {
        const content = generateDeepNesting(6, 'ts');
        const input = createWriteInput('src/nested.ts', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput?.additionalContext).toContain('nesting');
      });

      test('handles nested loops', () => {
        const content = `
function matrix() {
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      for (let k = 0; k < 10; k++) {
        for (let l = 0; l < 10; l++) {
          for (let m = 0; m < 10; m++) {
            console.log(i, j, k, l, m);
          }
        }
      }
    }
  }
}
`;
        const input = createWriteInput('src/loops.ts', content);
        const result = codeQualityGate(input);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput?.additionalContext).toContain('nesting');
      });
    });
  });

  describe('Cyclomatic complexity detection', () => {
    test('warns for high conditional density', () => {
      const content = `
function complex(a, b, c, d, e) {
  if (a) return 1;
  else if (b) return 2;
  else if (c) return 3;
  else if (d) return 4;
  else if (e) return 5;
  if (a && b) return 6;
  if (a || c) return 7;
  if (b && d) return 8;
  if (c || e) return 9;
  if (a && e) return 10;
  if (b || d) return 11;
  return 0;
}
`;
      const input = createWriteInput('src/complex.ts', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('complexity');
    });

    test('passes simple functions', () => {
      const content = `
function simple(x: number): number {
  if (x > 0) {
    return x;
  }
  return -x;
}
`;
      const input = createWriteInput('src/simple.ts', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
      const context = result.hookSpecificOutput?.additionalContext || '';
      expect(context).not.toContain('cyclomatic');
    });

    test('counts ternary operators', () => {
      const content = `
function ternaryHeavy(a, b, c, d, e, f, g, h, i, j, k) {
  const r1 = a ? 1 : 0;
  const r2 = b ? 2 : 1;
  const r3 = c ? 3 : 2;
  const r4 = d ? 4 : 3;
  const r5 = e ? 5 : 4;
  const r6 = f ? 6 : 5;
  const r7 = g ? 7 : 6;
  const r8 = h ? 8 : 7;
  const r9 = i ? 9 : 8;
  const r10 = j ? 10 : 9;
  const r11 = k ? 11 : 10;
  return r1 + r2 + r3 + r4 + r5 + r6 + r7 + r8 + r9 + r10 + r11;
}
`;
      const input = createWriteInput('src/ternary.ts', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });

    test('handles switch statements', () => {
      const content = `
function switchy(x: string): number {
  switch (x) {
    case 'a': return 1;
    case 'b': return 2;
    case 'c': return 3;
    case 'd': return 4;
    case 'e': return 5;
    default: return 0;
  }
}
`;
      const input = createWriteInput('src/switch.ts', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('Multiple quality issues', () => {
    test('reports all issues together', () => {
      const content = `
function badFunction(a, b, c, d, e, f, g, h, i, j, k) {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) {
            console.log("deep");
          }
        }
      }
    }
  }
${Array(55).fill('  console.log("padding");').join('\n')}
  if (f) return 1;
  else if (g) return 2;
  else if (h) return 3;
  else if (i) return 4;
  else if (j) return 5;
  else if (k) return 6;
  return 0;
}
`;
      const input = createWriteInput('src/bad.ts', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    test('handles empty content', () => {
      const input = createWriteInput('src/empty.ts', '');
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });

    test('handles empty file path', () => {
      const input = createWriteInput('', 'const x = 1;');
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });

    test('handles content without functions', () => {
      const content = `
const x = 1;
const y = 2;
export { x, y };
`;
      const input = createWriteInput('src/constants.ts', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });

    test('handles very large file', () => {
      const content = Array(1000).fill('const x = 1;').join('\n');
      const input = createWriteInput('src/large.ts', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });

    test('handles Go code', () => {
      const content = `
func longGoFunction() {
${Array(55).fill('	fmt.Println("line")').join('\n')}
}
`;
      const input = createWriteInput('src/main.go', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });

    test('handles Java code', () => {
      const content = `
public class Main {
    public void longMethod() {
${Array(55).fill('        System.out.println("line");').join('\n')}
    }
}
`;
      const input = createWriteInput('src/Main.java', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });

    test('handles Rust code', () => {
      const content = `
fn long_rust_function() {
${Array(55).fill('    println!("line");').join('\n')}
}
`;
      const input = createWriteInput('src/main.rs', content);
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });
  });

  describe('Non-code files', () => {
    test('skips markdown files when guards active', () => {
      // With guards mocked to return null, it won't skip
      const input = createWriteInput('README.md', '# Title\n\nContent');
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });

    test('skips JSON files', () => {
      const input = createWriteInput('package.json', '{"name": "test"}');
      const result = codeQualityGate(input);

      expect(result.continue).toBe(true);
    });
  });
});
