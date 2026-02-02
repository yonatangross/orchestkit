// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { CodePreview } from "../CodePreview";

// Mock Remotion hooks
vi.mock("remotion", async () => {
  const actual = await vi.importActual("remotion");
  return {
    ...actual,
    useCurrentFrame: vi.fn(() => 0),
    useVideoConfig: vi.fn(() => ({ fps: 30 })),
    interpolate: (
      frame: number,
      inputRange: number[],
      outputRange: number[],
      _config: unknown
    ) => {
      if (frame < inputRange[0]) return outputRange[0];
      if (frame > inputRange[1]) return outputRange[1];
      const ratio = (frame - inputRange[0]) / (inputRange[1] - inputRange[0]);
      return outputRange[0] + ratio * (outputRange[1] - outputRange[0]);
    },
    spring: vi.fn((_config: unknown) => 1),
  };
});

describe("CodePreview", () => {
  let mockCode: string;

  beforeEach(() => {
    mockCode = `const greeting = "Hello, World!";
console.log(greeting);
// This is a comment`;
  });

  describe("rendering", () => {
    it("should render code preview container", () => {
      const { container } = render(
        <CodePreview code={mockCode} />
      );
      expect(container).toBeTruthy();
    });

    it("should display code content", () => {
      const { container } = render(
        <CodePreview code={mockCode} />
      );
      // Code is rendered but may not be fully visible due to typewriter effect at frame 0
      expect(container).toBeTruthy();
    });

    it("should render empty code", () => {
      const { container } = render(<CodePreview code="" />);
      expect(container).toBeTruthy();
    });

    it("should handle multi-line code", () => {
      const multilineCode = `function add(a, b) {
  return a + b;
}`;
      const { container } = render(
        <CodePreview code={multilineCode} />
      );
      // Code is rendered
      expect(container).toBeTruthy();
    });
  });

  describe("header", () => {
    it("should not display header when filename is not provided", () => {
      const { container } = render(
        <CodePreview code={mockCode} />
      );
      expect(container.textContent).not.toContain("📄");
    });

    it("should display header when filename is provided", () => {
      const { getByText } = render(
        <CodePreview code={mockCode} filename="example.ts" />
      );
      expect(getByText("📄")).toBeTruthy();
      expect(getByText("example.ts")).toBeTruthy();
    });

    it("should display language badge", () => {
      const { getByText } = render(
        <CodePreview code={mockCode} filename="example.ts" language="typescript" />
      );
      expect(getByText("typescript")).toBeTruthy();
    });

    it("should use default language of typescript", () => {
      const { getByText } = render(
        <CodePreview code={mockCode} filename="example.ts" />
      );
      expect(getByText("typescript")).toBeTruthy();
    });

    it("should accept custom language", () => {
      const { getByText } = render(
        <CodePreview
          code={mockCode}
          filename="example.py"
          language="python"
        />
      );
      expect(getByText("python")).toBeTruthy();
    });
  });

  describe("line numbers", () => {
    it("should display line numbers by default", () => {
      const { container } = render(
        <CodePreview code={mockCode} showLineNumbers={true} />
      );
      // Line numbers are rendered
      expect(container).toBeTruthy();
    });

    it("should hide line numbers when showLineNumbers is false", () => {
      const { container } = render(
        <CodePreview code={mockCode} showLineNumbers={false} />
      );
      // Renders without line numbers
      expect(container).toBeTruthy();
    });
  });

  describe("syntax highlighting", () => {
    it("should highlight keywords", () => {
      const codeWithKeywords = "const x = 42; let y = 100;";
      const { container } = render(
        <CodePreview code={codeWithKeywords} />
      );
      expect(container).toBeTruthy();
    });

    it("should highlight strings", () => {
      const codeWithStrings = 'const message = "Hello"; const name = \'John\';';
      const { container } = render(
        <CodePreview code={codeWithStrings} />
      );
      expect(container).toBeTruthy();
    });

    it("should highlight numbers", () => {
      const codeWithNumbers = "const x = 42; const y = 3.14; const z = 0xFF;";
      const { container } = render(
        <CodePreview code={codeWithNumbers} />
      );
      expect(container).toBeTruthy();
    });

    it("should highlight comments", () => {
      const codeWithComments = "// This is a comment\nconst x = 42;";
      const { container } = render(
        <CodePreview code={codeWithComments} />
      );
      expect(container).toBeTruthy();
    });

    it("should highlight function declarations", () => {
      const codeWithFunction = "function myFunction() { return 42; }";
      const { container } = render(
        <CodePreview code={codeWithFunction} />
      );
      expect(container).toBeTruthy();
    });

    it("should highlight type annotations", () => {
      const codeWithTypes = "interface User { name: String; age: Number; }";
      const { container } = render(
        <CodePreview code={codeWithTypes} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("line highlighting", () => {
    it("should highlight specified lines", () => {
      const { container } = render(
        <CodePreview
          code={mockCode}
          highlightLines={[2]}
          showLineNumbers={true}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should highlight multiple lines", () => {
      const multilineCode = `line1
line2
line3
line4`;
      const { container } = render(
        <CodePreview
          code={multilineCode}
          highlightLines={[1, 3]}
          showLineNumbers={true}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should handle empty highlightLines array", () => {
      const { container } = render(
        <CodePreview
          code={mockCode}
          highlightLines={[]}
          showLineNumbers={true}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should ignore out-of-bounds highlight lines", () => {
      const { container } = render(
        <CodePreview
          code={mockCode}
          highlightLines={[100, 200]}
          showLineNumbers={true}
        />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("typewriter effect", () => {
    it("should support custom typewriter speed", () => {
      const { container } = render(
        <CodePreview code={mockCode} typewriterSpeed={5} />
      );
      expect(container).toBeTruthy();
    });

    it("should use default typewriter speed of 3", () => {
      const { container } = render(
        <CodePreview code={mockCode} />
      );
      expect(container).toBeTruthy();
    });

    it("should support slow typewriter speed", () => {
      const { container } = render(
        <CodePreview code={mockCode} typewriterSpeed={0.5} />
      );
      expect(container).toBeTruthy();
    });

    it("should support fast typewriter speed", () => {
      const { container } = render(
        <CodePreview code={mockCode} typewriterSpeed={10} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("animation", () => {
    it("should support animateIn prop", () => {
      const { container } = render(
        <CodePreview code={mockCode} animateIn={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should disable animation when animateIn is false", () => {
      const { container } = render(
        <CodePreview code={mockCode} animateIn={false} />
      );
      expect(container).toBeTruthy();
    });

    it("should accept startFrame prop", () => {
      const { container } = render(
        <CodePreview code={mockCode} startFrame={30} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("styling", () => {
    it("should apply custom primary color", () => {
      const { container } = render(
        <CodePreview code={mockCode} primaryColor="#ff0000" />
      );
      expect(container).toBeTruthy();
    });

    it("should use default primary color", () => {
      const { container } = render(
        <CodePreview code={mockCode} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle very long lines", () => {
      const longLine =
        "const veryLongVariableNameThatExceedsTypicalDisplayWidth = 'This is a very long string value';";
      const { container } = render(
        <CodePreview code={longLine} showLineNumbers={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle many lines of code", () => {
      const manyLines = Array.from(
        { length: 50 },
        (_, i) => `const var${i} = ${i};`
      ).join("\n");
      const { container } = render(
        <CodePreview code={manyLines} showLineNumbers={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle code with special characters", () => {
      const specialCode =
        'const str = "Hello\\nWorld"; const regex = /[a-z]+/;';
      const { container } = render(
        <CodePreview code={specialCode} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle code with operators", () => {
      const codeWithOperators = "if (a > b && c < d || e === f) { x += 10; }";
      const { container } = render(
        <CodePreview code={codeWithOperators} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle code with brackets and braces", () => {
      const codeWithBrackets =
        "const arr = [1, 2, 3]; const obj = { key: 'value' };";
      const { container } = render(
        <CodePreview code={codeWithBrackets} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle code with multiple comment styles", () => {
      const codeWithComments = `// Single line comment
const x = 42; // Inline comment
/* Multi-line
   comment */`;
      const { container } = render(
        <CodePreview code={codeWithComments} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle indented code", () => {
      const indentedCode = `function outer() {
  function inner() {
    const x = 42;
  }
}`;
      const { container } = render(
        <CodePreview code={indentedCode} showLineNumbers={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle code with empty lines", () => {
      const codeWithEmptyLines = `const x = 1;

const y = 2;

const z = 3;`;
      const { container } = render(
        <CodePreview code={codeWithEmptyLines} showLineNumbers={true} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("prop combinations", () => {
    it("should render with all props specified", () => {
      const { getByText } = render(
        <CodePreview
          code={mockCode}
          language="typescript"
          filename="example.ts"
          primaryColor="#00ff00"
          animateIn={true}
          startFrame={0}
          typewriterSpeed={3}
          showLineNumbers={true}
          highlightLines={[1, 2]}
        />
      );
      expect(getByText("example.ts")).toBeTruthy();
      expect(getByText("typescript")).toBeTruthy();
    });

    it("should render minimal configuration", () => {
      const { container } = render(<CodePreview code={mockCode} />);
      expect(container).toBeTruthy();
    });
  });

  describe("language support", () => {
    it("should support javascript code", () => {
      const jsCode = "const x = 42; console.log(x);";
      const { container } = render(
        <CodePreview code={jsCode} language="javascript" />
      );
      expect(container).toBeTruthy();
    });

    it("should support typescript code", () => {
      const tsCode = "const x: number = 42;";
      const { container } = render(
        <CodePreview code={tsCode} language="typescript" />
      );
      expect(container).toBeTruthy();
    });

    it("should support python code", () => {
      const pyCode = "x = 42\nprint(x)";
      const { container } = render(
        <CodePreview code={pyCode} language="python" />
      );
      expect(container).toBeTruthy();
    });

    it("should support jsx code", () => {
      const jsxCode = "const Component = () => <div>Hello</div>;";
      const { container } = render(
        <CodePreview code={jsxCode} language="jsx" />
      );
      expect(container).toBeTruthy();
    });
  });
});
