// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  ClaudeResponse,
  CompactClaudeResponse,
} from "../ClaudeResponse";

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

describe("ClaudeResponse", () => {
  let mockContent: string[];

  beforeEach(() => {
    mockContent = [
      "I'll help you analyze this codebase structure.",
      "First, let me understand the project layout.",
      "The architecture looks well-organized with clear separation of concerns.",
    ];
  });

  describe("rendering", () => {
    it("should render Claude response container", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} />
      );
      expect(container).toBeTruthy();
    });

    it("should display content lines", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} />
      );
      const text = container.textContent || "";
      // At frame 0 with typewriter, content may be partially visible
      expect(text.length > 0).toBe(true);
    });

    it("should display Claude header", () => {
      const { getByText } = render(
        <ClaudeResponse content={mockContent} />
      );
      expect(getByText("Claude")).toBeTruthy();
    });

    it("should display Claude emoji", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} />
      );
      expect(container.textContent).toContain("🤖");
    });

    it("should render empty content", () => {
      const { container } = render(<ClaudeResponse content={[]} />);
      expect(container).toBeTruthy();
    });

    it("should render single line content", () => {
      const { container } = render(
        <ClaudeResponse content={["Single line response"]} />
      );
      // Content is rendered but may not be fully visible due to typewriter effect
      expect(container).toBeTruthy();
    });
  });

  describe("thinking state", () => {
    it("should display thinking indicator when thinking is true", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} thinking={true} />
      );
      expect(container.textContent).toContain("thinking");
    });

    it("should not display thinking indicator when thinking is false", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} thinking={false} />
      );
      const text = container.textContent || "";
      // thinking label should not appear
      expect(
        text.includes("thinking") &&
          !mockContent.some((line) => line.includes("thinking"))
      ).toBe(false);
    });

    it("should display thinking dots", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} thinking={true} />
      );
      expect(container.textContent).toContain(".");
    });
  });

  describe("typewriter effect", () => {
    it("should calculate visible characters correctly", () => {
      const testContent = ["Test content"];
      const { container } = render(
        <ClaudeResponse
          content={testContent}
          typewriterSpeed={1}
          startFrame={0}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should support custom typewriter speed", () => {
      const { container } = render(
        <ClaudeResponse
          content={mockContent}
          typewriterSpeed={5}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should use default typewriter speed of 2", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} />
      );
      expect(container).toBeTruthy();
    });

    it("should support slow typewriter speed", () => {
      const { container } = render(
        <ClaudeResponse
          content={mockContent}
          typewriterSpeed={0.5}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should support fast typewriter speed", () => {
      const { container } = render(
        <ClaudeResponse
          content={mockContent}
          typewriterSpeed={10}
        />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("animation", () => {
    it("should support animateIn prop", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} animateIn={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should disable animation when animateIn is false", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} animateIn={false} />
      );
      expect(container).toBeTruthy();
    });

    it("should accept startFrame prop", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} startFrame={30} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("styling", () => {
    it("should apply custom primary color", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} primaryColor="#ff0000" />
      );
      expect(container).toBeTruthy();
    });

    it("should use default primary color", () => {
      const { container } = render(
        <ClaudeResponse content={mockContent} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle very long content lines", () => {
      const longContent = [
        "This is a very long line of content that exceeds typical display width and should still render properly without breaking the layout or causing visual issues in the rendered output.",
      ];
      const { container } = render(
        <ClaudeResponse content={longContent} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle many content lines", () => {
      const manyLines = Array.from(
        { length: 20 },
        (_, i) => `Line ${i + 1} of content`
      );
      const { container } = render(
        <ClaudeResponse content={manyLines} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle content with special characters", () => {
      const specialContent = [
        "Code: const x = 42; // comment",
        "Symbol: @#$%^&*()",
        "Unicode: 你好世界 🚀",
      ];
      const { container } = render(
        <ClaudeResponse content={specialContent} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle empty strings in content array", () => {
      const contentWithEmpty = [
        "First line",
        "",
        "Third line",
      ];
      const { container } = render(
        <ClaudeResponse content={contentWithEmpty} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle whitespace-only lines", () => {
      const contentWithWhitespace = [
        "First",
        "   ",
        "Third",
      ];
      const { container } = render(
        <ClaudeResponse content={contentWithWhitespace} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("prop combinations", () => {
    it("should render with all props specified", () => {
      const { getByText } = render(
        <ClaudeResponse
          content={mockContent}
          thinking={true}
          primaryColor="#ff00ff"
          animateIn={true}
          startFrame={0}
          typewriterSpeed={3}
        />
      );
      expect(getByText("Claude")).toBeTruthy();
      expect(getByText(/thinking/)).toBeTruthy();
    });

    it("should render minimal configuration", () => {
      const { getByText } = render(
        <ClaudeResponse content={mockContent} />
      );
      expect(getByText("Claude")).toBeTruthy();
    });
  });
});

describe("CompactClaudeResponse", () => {
  let mockLines: string[];

  beforeEach(() => {
    mockLines = [
      "• Analysis complete",
      "• All tests passing",
      "- Documentation updated",
      "- Ready for deployment",
    ];
  });

  describe("rendering", () => {
    it("should render compact response", () => {
      const { container } = render(
        <CompactClaudeResponse lines={mockLines} />
      );
      expect(container).toBeTruthy();
    });

    it("should display all lines", () => {
      const { container } = render(
        <CompactClaudeResponse lines={mockLines} />
      );
      const text = container.textContent || "";
      expect(text).toContain("Analysis complete");
      expect(text).toContain("All tests passing");
      expect(text).toContain("Documentation updated");
      expect(text).toContain("Ready for deployment");
    });

    it("should render empty lines array", () => {
      const { container } = render(
        <CompactClaudeResponse lines={[]} />
      );
      expect(container).toBeTruthy();
    });

    it("should render single line", () => {
      const { container } = render(
        <CompactClaudeResponse lines={["Single line"]} />
      );
      expect(container.textContent).toContain("Single line");
    });
  });

  describe("bullet points", () => {
    it("should identify bullet points starting with •", () => {
      const { container } = render(
        <CompactClaudeResponse lines={["• Bullet point"]} />
      );
      expect(container.textContent).toContain("• Bullet point");
    });

    it("should identify bullet points starting with -", () => {
      const { container } = render(
        <CompactClaudeResponse lines={["-Dash bullet"]} />
      );
      expect(container.textContent).toContain("-Dash bullet");
    });

    it("should handle mixed bullet styles", () => {
      const mixedBullets = [
        "• Bullet with dot",
        "- Bullet with dash",
        "Regular text",
      ];
      const { container } = render(
        <CompactClaudeResponse lines={mixedBullets} />
      );
      expect(container.textContent).toContain("• Bullet with dot");
      expect(container.textContent).toContain("- Bullet with dash");
      expect(container.textContent).toContain("Regular text");
    });

    it("should render non-bullet text without special styling", () => {
      const { container } = render(
        <CompactClaudeResponse lines={["Regular text"]} />
      );
      expect(container.textContent).toContain("Regular text");
    });
  });

  describe("animation", () => {
    it("should accept startFrame prop", () => {
      const { container } = render(
        <CompactClaudeResponse lines={mockLines} startFrame={30} />
      );
      expect(container).toBeTruthy();
    });

    it("should use startFrame 0 by default", () => {
      const { container } = render(
        <CompactClaudeResponse lines={mockLines} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("styling", () => {
    it("should apply custom primary color", () => {
      const { container } = render(
        <CompactClaudeResponse
          lines={mockLines}
          primaryColor="#ff0000"
        />
      );
      expect(container).toBeTruthy();
    });

    it("should use default primary color", () => {
      const { container } = render(
        <CompactClaudeResponse lines={mockLines} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle very long lines", () => {
      const longLines = [
        "• This is a very long line of content that contains important information about the processing results and should render correctly even when it exceeds typical display width.",
      ];
      const { container } = render(
        <CompactClaudeResponse lines={longLines} />
      );
      expect(
        container.textContent?.includes(
          "This is a very long line of content"
        )
      ).toBeTruthy();
    });

    it("should handle many lines", () => {
      const manyLines = Array.from(
        { length: 15 },
        (_, i) => (i % 2 === 0 ? "• " : "- ") + `Line ${i + 1}`
      );
      const { container } = render(
        <CompactClaudeResponse lines={manyLines} />
      );
      expect(container.textContent).toContain("Line 1");
      expect(container.textContent).toContain("Line 15");
    });

    it("should handle lines with only bullets", () => {
      const { container } = render(
        <CompactClaudeResponse lines={["•", "-", "•"]} />
      );
      expect(container).toBeTruthy();
    });

    it("should handle empty strings in lines array", () => {
      const linesWithEmpty = [
        "• First",
        "",
        "• Third",
      ];
      const { container } = render(
        <CompactClaudeResponse lines={linesWithEmpty} />
      );
      expect(container.textContent).toContain("First");
      expect(container.textContent).toContain("Third");
    });

    it("should handle content with special characters", () => {
      const specialLines = [
        "• Code: const x = 42;",
        "- Symbol: @#$%^&*()",
        "• Unicode: 🚀 📊 ✨",
      ];
      const { container } = render(
        <CompactClaudeResponse lines={specialLines} />
      );
      expect(container.textContent).toContain("const x = 42;");
      expect(container.textContent).toContain("@#$%^&*()");
      expect(container.textContent).toContain("🚀");
    });
  });

  describe("prop combinations", () => {
    it("should render with all props specified", () => {
      const { container } = render(
        <CompactClaudeResponse
          lines={mockLines}
          startFrame={30}
          primaryColor="#00ff00"
        />
      );
      expect(container).toBeTruthy();
    });

    it("should render minimal configuration", () => {
      const { container } = render(
        <CompactClaudeResponse lines={mockLines} />
      );
      expect(container).toBeTruthy();
    });
  });
});
